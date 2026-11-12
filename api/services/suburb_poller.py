import asyncio
import time
import os
import random
from typing import List, Dict, Any, Optional
from services.listings_db import get_suburb_sync_age_seconds, upsert_listings, get_pool_stats
from services.live_search import scrape_p24_live, get_p24_circuit_status

# Comprehensive Cape Town Suburbs for background sync cycle (Metro-wide coverage)
TARGET_SYNC_SUBURBS = [
    # City Bowl & CBD
    "Cape Town City Centre",
    "Gardens",
    "Tamboerskloof",
    "Oranjezicht",
    "Higgovale",
    "Vredehoek",
    "De Waterkant",
    "Bo-Kaap",
    "Zonnebloem",
    "Foreshore",
    # Atlantic Seaboard
    "Sea Point",
    "Green Point",
    "Mouille Point",
    "Three Anchor Bay",
    "Fresnaye",
    "Bantry Bay",
    "Camps Bay",
    "Clifton",
    "Bakoven",
    "Llandudno",
    "Hout Bay",
    # City Fringe & Inner East
    "Woodstock",
    "Salt River",
    "Observatory",
    "Mowbray",
    "Rosebank",
    # Southern Suburbs
    "Rondebosch",
    "Newlands",
    "Claremont",
    "Kenilworth",
    "Wynberg",
    "Plumstead",
    "Constantia",
    "Tokai",
    "Bergvliet",
    "Meadowridge",
    "Kirstenhof",
    "Diep River",
    "Bishopscourt",
    "Pinelands",
    "Thornton",
    # South Peninsula & Deep South
    "Muizenberg",
    "Marina da Gama",
    "Lakeside",
    "St James",
    "Kalk Bay",
    "Clovelly",
    "Fish Hoek",
    "Capri",
    "Sunnydale",
    "Noordhoek",
    "Kommetjie",
    "Scarborough",
    "Glencairn",
    "Simons Town",
    # West Coast / Blaauwberg & Century City
    "Century City",
    "Milnerton",
    "Table View",
    "Bloubergstrand",
    "Blouberg",
    "Parklands",
    "Sunningdale",
    "Big Bay",
    "Melkbosstrand",
    # Northern Suburbs
    "Bellville",
    "Durbanville",
    "Plattekloof",
    "Panorama",
    "Edgemead",
    "Goodwood",
    "Parow",
    "Brackenfell",
    "Kraaifontein",
    "Kuils River",
    # Garden Route
    "George",
]

# Sync Interval: Check each suburb if older than 45 minutes (gently refreshed with 4s spacing)
SUBURB_MAX_AGE_SECONDS = 45 * 60

# Background task state
_SYNC_TASK: Optional[asyncio.Task] = None
_IS_RUNNING = False

async def _sync_single_suburb(suburb: str):
    """Refreshes a single suburb off-thread without blocking."""
    age = get_suburb_sync_age_seconds(suburb)
    if age < SUBURB_MAX_AGE_SECONDS:
        return  # Suburb data is already fresh!

    # If the shared circuit breaker tripped, pause gracefully for its cooldown instead of hammering
    circuit = get_p24_circuit_status()
    if circuit.get("circuit_open"):
        wait_s = max(30, min(600, int(circuit.get("seconds_remaining", 180)) + 15))
        print(f"[BACKGROUND POLLER] Circuit breaker open. Pausing sync for {wait_s}s...")
        await asyncio.sleep(wait_s)
        return

    print(f"[BACKGROUND POLLER] Syncing suburb '{suburb}' (cache age: {round(age / 60, 1)}m)...")
    loop = asyncio.get_event_loop()
    
    # Scrape off-thread to avoid event loop stalls
    listings = await loop.run_in_executor(
        None,
        lambda: scrape_p24_live(
            suburbs=[suburb],
            min_price=0,
            max_price=999999,
            beds="any",
            force_fresh=True
        )
    )

    if listings:
        upsert_listings(listings, suburb)
        print(f"[BACKGROUND POLLER] '{suburb}' synced: {len(listings)} listings updated in DB pool.")

    # Polite delay with jitter between suburbs (keeps 74-suburb pass gentle & undetectable)
    await asyncio.sleep(random.uniform(4.5, 7.5))

async def background_suburb_sync_loop():
    """Continuous low-priority background poller syncing suburbs gently."""
    global _IS_RUNNING
    _IS_RUNNING = True
    print("[BACKGROUND POLLER] Centralized Suburb Poller started. Target suburbs:", len(TARGET_SYNC_SUBURBS))

    while _IS_RUNNING:
        try:
            # Shuffle suburbs slightly each cycle to distribute scrapes evenly
            shuffled = list(TARGET_SYNC_SUBURBS)
            random.shuffle(shuffled)

            for suburb in shuffled:
                if not _IS_RUNNING:
                    break
                await _sync_single_suburb(suburb)

            # Rest between round-robin passes
            await asyncio.sleep(300)  # Check every 5 minutes if any suburb has aged past 45m

        except asyncio.CancelledError:
            print("[BACKGROUND POLLER] Poller stopped gracefully.")
            break
        except Exception as e:
            print(f"[BACKGROUND POLLER] Error in sync loop: {e}")
            await asyncio.sleep(60)

def start_background_poller():
    global _SYNC_TASK
    if _SYNC_TASK is None or _SYNC_TASK.done():
        _SYNC_TASK = asyncio.create_task(background_suburb_sync_loop())
        return True
    return False

def stop_background_poller():
    global _IS_RUNNING, _SYNC_TASK
    _IS_RUNNING = False
    if _SYNC_TASK and not _SYNC_TASK.done():
        _SYNC_TASK.cancel()

