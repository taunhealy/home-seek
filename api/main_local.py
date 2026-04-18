
import os
from pathlib import Path
from dotenv import load_dotenv

# [SHIELD] LOCAL ELITE NODE (v24.0)
# Force-configured for high-trust residential operation
os.environ["LOCAL_SNIPER"] = "true"

# [SHIELD] SMART ENV LOADER
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
env_paths = [current_dir / ".env", project_root / ".env"]

for path in env_paths:
    if path.exists():
        load_dotenv(path)
        print(f"SUCCESS: Loaded Local Node .env from: {path}")
        break

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Union
from pydantic import BaseModel
import json
import asyncio
import time
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter
import sys
from scraper.engine import SniperEngine
from database import (
    get_db, 
    save_listing, 
    get_sources, 
    create_task, 
    update_task, 
    get_user_alerts,
    get_user_profile,
    save_search
)
from notifications import EvolutionClient, ResendEmailClient

# [STABILITY] Windows Terminal ASCII Scrubber
def print_safe(msg):
    try:
        # Purge non-ASCII to prevent charmap crashes on Windows
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except:
        pass

app = FastAPI(title="Home-Seek Local Elite Node", version="24.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [TOOL] State Management
engine = SniperEngine()
sniper_lock = asyncio.Lock()

@app.get("/listings/{user_id}")
async def fetch_user_listings(user_id: str):
    db = get_db()
    # Order by newest hits first (Past Listings logic)
    docs = db.collection("users").document(user_id).collection("listings")\
             .order_by("created_at", direction=firestore.Query.DESCENDING)\
             .limit(50).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

@app.get("/explore-listings")
async def fetch_explore_listings(
    rental_type: Optional[str] = None, 
    area: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    platform: Optional[str] = None,
    view: Optional[str] = None,
    pets: Optional[bool] = None
):
    """Global Feed for the Explore Page with Semantic Vista & Pet Filters (v56.0)."""
    db = get_db()
    # For Semantic Vista/Pet filtering, we use the Memory-Sort logic to scan
    docs = db.collection("listings").limit(500).stream()
    all_hits = [{"id": d.id, **d.to_dict()} for d in docs]
    
    res = []
    for h in all_hits:
        # 1. Standard Filters
        if rental_type == 'long-term':
            if h.get("rental_type") not in ['long-term', None]: continue
        elif rental_type and h.get("rental_type") != rental_type: continue
        
        price = h.get("price") or 0
        if min_price and price < min_price: continue
        if max_price and price > max_price: continue
        if platform and platform.lower() not in str(h.get("platform", "")).lower(): continue
        
        # Area Check (Fuzzy)
        area_hit = False
        if not area: area_hit = True
        else:
            search_str = (str(h.get("address", "")) + " " + str(h.get("title", ""))).lower()
            if area.lower() in search_str: area_hit = True
        if not area_hit: continue

        # 🐾 2. PET FILTER (v56.0)
        if pets and not h.get("is_pet_friendly"): continue
            
        # 🌊 3. VISTA SEMANTIC FILTER
        if view:
            content = (str(h.get("title", "")) + " " + str(h.get("description", ""))).lower()
            if view == "seaview":
                if not any(k in content for k in ["sea", "ocean", "beach", "atlantic", "seaview", "coast"]): continue
            elif view == "mountain":
                if not any(k in content for k in ["mountain", "table mountain", "mountainview", "peak", "lions head"]): continue

        res.append(h)
        
    res.sort(key=lambda x: str(x.get('created_at', '')), reverse=True)
    return res[:100]

@app.get("/system/stats")
async def get_system_stats():
    """Diagnostic endpoint to verify local-cloud bridge."""
    try:
        db = get_db()
        users = db.collection("users").get()
        alerts_count = 0
        active_users = []
        
        for u in users:
            alerts = db.collection("users").document(u.id).collection("alerts").get()
            if len(alerts) > 0:
                alerts_count += len(alerts)
                active_users.append(u.id)
        
        return {
            "node_status": "Operational (Forensic Stealth v1.0.9)",
            "monitored_alerts": alerts_count,
            "active_user_missions": active_users,
            "database_sync": "Verified (Firestore Global Registry)",
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/user-profile/{user_id}")
async def fetch_user_profile(user_id: str):
    return await get_user_profile(user_id)

@app.get("/searches/{user_id}")
async def fetch_user_searches(user_id: str):
    return await get_user_alerts(user_id)

@app.post("/deploy-sniper")
async def deploy_sniper(mission: dict, background_tasks: BackgroundTasks):
    user_id = mission.get("user_id", "taun_test_user")
    query = mission.get("search_query", "")
    is_alert_save = mission.get("alert_enabled", False)
    
    # Label correctly as a standard search (long-term)
    if is_alert_save:
        await save_search(user_id, mission)
        
    task_id = await create_task(user_id, query)
    background_tasks.add_task(run_local_scan, query, [], task_id, user_id, mission)
    return {"status": "deployed", "task_id": task_id}

@app.get("/tasks/{task_id}")
async def fetch_task_status(task_id: str):
    db = get_db()
    doc = db.collection("tasks").document(task_id).get()
    if doc.exists: return doc.to_dict()
    return {"status": "Not Found"}

@app.delete("/delete-alert/{user_id}/{search_id}")
async def remove_alert(user_id: str, search_id: str):
    db = get_db()
    db.collection("users").document(user_id).collection("alerts").document(search_id).delete()
    return {"status": "ok"}
    
@app.post("/listings/manual")
async def manual_post_listing(listing: dict):
    """Allows users to manually submit a listing via the local API."""
    try:
        from database import save_listing
        # Standardize listing
        listing["rental_type"] = listing.get("rental_type", "long-term")
        listing["platform"] = "Manual Post"
        listing["discovery_method"] = "manual_submission"
        
        # Save to Global Community Feed
        await save_listing("community_manual", listing)
        return {"status": "success", "message": "Intel shared with the community!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/geofence/suburbs")
async def get_elite_suburbs():
    """Exposes the PREMIUM_SUBURBS list for frontend autocomplete."""
    from geofence import PREMIUM_SUBURBS
    # Return as sorted title-case list for the UI
    return sorted([s.title() for s in PREMIUM_SUBURBS])

@app.post("/trigger-snipe")
async def trigger_targeted_snipe(data: dict, background_tasks: BackgroundTasks):
    query = data.get("query")
    source_ids = data.get("source_ids")
    user_id = data.get("user_id") 
    
    task_id = await create_task(user_id, query)
    
    # Wrap standard manual missions in a single-subscriber list for multiplex compatibility
    manual_sub = [{"user_id": user_id, "config": data}]
    
    background_tasks.add_task(run_local_scan, query, source_ids, task_id, manual_sub)
    return {"status": "local_node_dispatched", "task_id": task_id}

async def run_local_scan(query: str, source_ids: List[str], task_id: str, subscribers: List[dict] = None):
    """
    ELITE MULTIPLEX SCAN (v81.1): 
    Scans a neighborhood ONCE and broadcasts to many.
    - Global Pool: Saves ALL residential results.
    - Tiered Broadcast: Only saves to specific users if they match filters.
    """
    async with sniper_lock:
        print(f"[LOCAL NODE] MULTIPLEX SCAN: {query} for {len(subscribers or [])} sub(s)")
        db = get_db()
        
        if not source_ids:
            all_sources = await get_sources()
            source_ids = [s['id'] for s in all_sources]

        for sid in source_ids:
            source_doc = db.collection("sources").document(sid).get()
            if not source_doc.exists: continue
            source = source_doc.to_dict()
            source_name = source.get('name', '')
            source_type = source.get('type', 'long-term') 

            # 🗺️ [ZONAL FILTER] Precision Dispatch (v85.1)
            # Avoid searching irrelevant groups (e.g., searching "Big Bay" in "Sea Point" feeds).
            # This kills 'Something went wrong' errors by reducing bot-like behavior.
            from geofence import get_zone_for_area
            mission_zone = get_zone_for_area(query)
            source_zone = get_zone_for_area(source_name)
            
            if source_zone != "global" and source_zone != mission_zone:
                print_safe(f"[ZONAL] Skipping irrelevant source: '{source_name}' for mission '{query}'")
                continue

            # 💡 [SOURCE IQ] Global Search Broadening (v82.0)
            # Remove literal markers from the search bar to prevent "Zerio-Match" on strict queries.
            # The AI Extractor and Subscriber Config still enforce the pet-policy internally.
            clean_query = query
            for marker in ["(MUST BE PET FRIENDLY)", "PET FRIENDLY", "(PET FRIENDLY)"]:
                clean_query = clean_query.replace(marker, "").replace(marker.lower(), "")
            clean_query = clean_query.strip()

            await update_task(task_id, "Scouting", f"Node analyzing: {source_name}")
            result = await engine.scrape_url(source.get('url'), task_id=task_id, search_area=clean_query)
            
            if result:
                all_raw = []
                # 🟢 Part A: Fresh AI Extractions
                for listing in result.listings:
                    l_dict = listing.dict() if hasattr(listing, 'dict') else listing
                    l_dict['rental_type'] = source_type
                    all_raw.append(l_dict)
                
                # 🟡 Part B: Memory Retrieval (Recall cached data for matching)
                if result.cached_hashes:
                    from database import get_listings_by_keys
                    print_safe(f"[MEMORY] Recalling {len(result.cached_hashes)} listings from registry...")
                    cached_data = await get_listings_by_keys([], result.cached_hashes)
                    all_raw.append(cached_data) if isinstance(cached_data, dict) else all_raw.extend(cached_data)

                if all_raw:
                    print_safe(f"[MULTIPLEX] Processing {len(all_raw)} total hits for Mission Subscribers...")
                    for l_dict in all_raw:
                        # [LINK FIDELITY] Enforce Proper URLs (v81.0)
                        extracted_url = str(l_dict.get("source_url", ""))
                        is_malformed = any(bad in extracted_url for bad in ["example.com", "missing_url"]) or not extracted_url
                        
                        if is_malformed:
                            if "rentuncle" in source_name.lower():
                                l_dict["source_url"] = source.get("url")
                            else:
                                continue
                    
                    # 🌍 GLOBAL RETENTION: Always save to global pool (v81.2)
                    # We pass None for user_id to trigger global-only save path if needed, 
                    # but save_listing handles double-push. 
                    # We create an 'Anonymous' save to the global collection first.
                    from database import save_listing
                    
                    # Save to GLOBAL list first (No user filters)
                    await save_listing("global_scout", l_dict) 

                    # 🎯 BROADCAST: Check individual mission filters
                    if subscribers:
                        for sub in subscribers:
                            user_id = sub['user_id']
                            config = sub['config']
                            
                            # Apply Specific Filters (Price, Beds, Pets)
                            l_price = l_dict.get("price") or 0
                            if config.get("max_price") and l_price > config.get("max_price"): continue
                            if config.get("pet_friendly") and not l_dict.get("is_pet_friendly"): continue
                            
                            # [CATEGORY FILTER] Filter by rental type if specified
                            req_type = config.get("rental_type")
                            if req_type and req_type != "all" and l_dict.get("rental_type") != req_type:
                                print(f"[RECON] ❌ Rejected: Category Mismatch ({l_dict.get('rental_type')} vs {req_type})")
                                continue
                            
                            # [LAYOUT FILTER] Whole vs Shared (v90.0)
                            req_layout = config.get("property_sub_type")
                            if req_layout and req_layout != "all" and l_dict.get("property_sub_type") != req_layout:
                                continue
                            
                            # [BEDROOM FILTER] If no beds assigned, treat as 'Any' (v97.0)
                            min_b = config.get("min_bedrooms")
                            listing_beds = l_dict.get("bedrooms")
                            
                            if min_b and listing_beds is not None:
                                min_val = min(min_b) if isinstance(min_b, list) else min_b
                                if listing_beds < min_val:
                                    print(f"[RECON] ❌ Rejected: Beds {listing_beds} < Required {min_val}")
                                    continue
                            elif min_b and listing_beds is None:
                                print(f"[RECON] 🏗️ Partial Match: No beds assigned, treating as 'Any'")
                            
                            # Valid match for this user!
                            print(f"[RECON] ✅ VALID MATCH! Saving to User Feed: {user_id}")
                            await save_listing(user_id, l_dict)
                            
                            # --- [SIGNAL BURST] INSTANT NOTIFICATION (v103.5) ---
                            # Fetch user profile for contact details
                            user = await get_user_profile(user_id)
                            if not user: continue

                            try:
                                whatsapp_number = user.get("whatsapp")
                                if whatsapp_number:
                                    wa_client = EvolutionClient()
                                    msg = f"🎯 *Home-Seek Sniper Match!*\n\n"
                                    msg += f"🏠 *{l_dict.get('title')}*\n"
                                    msg += f"💰 Price: R{l_dict.get('price'):,}\n"
                                    msg += f"🔗 View: {l_dict.get('source_url')}\n\n"
                                    msg += f"_[Discovered for: {query}]_"
                                    asyncio.create_task(wa_client.send_whatsapp(whatsapp_number, msg))
                                    print_safe(f"[SIGNAL] WhatsApp Alert Dispatched to {whatsapp_number}")
                                
                                user_email = user.get("email")
                                if user_email:
                                    email_client = ResendEmailClient()
                                    subject = f"🏠 Home-Seek Match: {l_dict.get('title')}"
                                    body = f"<h2>Home-Seek Discovery</h2>"
                                    body += f"<p><b>Title:</b> {l_dict.get('title')}</p>"
                                    body += f"<p><b>Price:</b> R{l_dict.get('price'):,}</p>"
                                    body += f"<p><b>Location:</b> {l_dict.get('address')}</p>"
                                    body += f'<p><a href="{l_dict.get("source_url")}">Click here to view property</a></p>'
                                    asyncio.create_task(email_client.send_email(user_email, subject, body))
                            except Exception as notify_err:
                                print_safe(f"[SIGNAL ERROR] Alert Dispatch Failed: {notify_err}")
        
        await update_task(task_id, "Complete", f"Aggregated scan finished for {query}.", completed=True)

# [PULSE] AUTONOMOUS HEARTBEAT: The 24/7 Tiered Sniper Pulse
PULSE_COUNT = 0 # Tracks how many 30-min cycles have passed

async def autonomous_pulse_heartbeat():
    """Background loop that executes tiered user alerts."""
    global PULSE_COUNT
    print("[HEARTBEAT] Local Node Tiered Pulse Engine initialized.")
    
    while True:
        try:
            PULSE_COUNT += 1
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [HEARTBEAT] Cycle #{PULSE_COUNT}: Commencing tiered sniper pulse...")
            
            db = get_db()
            all_users = db.collection("users").stream()
            users = [{"id": u.id, **u.to_dict()} for u in all_users]

            # 🎯 AGGREGATION HUB: Group alerts by Neighborhood (Multiplex v81.1)
            mission_map = {} # { "Sea Point": [ {user_id, config}, ... ] }
            
            for user in users:
                tier = user.get("tier", "free").lower()
                user_id = user["id"]
                
                # --- [COST GUARD] TIER ENFORCEMENT LOGIC (v80.0) ---
                should_run = False
                if PULSE_COUNT == 1: should_run = True
                elif tier == "gold": should_run = True 
                elif tier == "silver":
                    if PULSE_COUNT % 72 == 0: should_run = True
                elif tier == "bronze":
                    if PULSE_COUNT % 144 == 0: should_run = True
                else: 
                    should_run = False
                
                if not should_run: continue
                
                alerts = await get_user_alerts(user_id)
                if not alerts: continue
                
                for a in alerts:
                    query = a.get("search_query", "").strip()
                    if not query: continue
                    if query not in mission_map: mission_map[query] = []
                    mission_map[query].append({"user_id": user_id, "config": a})

            # 🚀 EXECUTE MULTIPLEX MISSIONS
            for query, subs in mission_map.items():
                print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [MULTIPLEX] Starting Aggregated Pulse: '{query}' for {len(subs)} users...")
                # We use the first user's ID for task tracking (doesn't matter as it's multiplexed)
                task_id = await create_task(subs[0]['user_id'], query)
                await run_local_scan(query, [], task_id, subs)
                print_safe(f"    - Multiplex Complete for '{query}'.")

            # Reset counter occasionally to prevent overflow (LCM of our tiers)
            if PULSE_COUNT >= 288: PULSE_COUNT = 0
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [HEARTBEAT] Pulse cycle finished. Next cycle in 10 minutes...")
            await asyncio.sleep(600) # Wait 10 mins (Gold Frequency)
        except Exception as e:
            print(f"[HEARTBEAT] Error during tiered pulse: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    # Start the autonomous sniper pulse in the background
    asyncio.create_task(autonomous_pulse_heartbeat())

@app.post("/force-pulse")
async def force_pulse():
    """Manual trigger to bypass the 30-minute timer for testing."""
    print("[MANUAL OVERDRIVE] Force-triggering autonomous heartbeat cycle...")
    # This just runs the logic once in the background
    asyncio.create_task(autonomous_pulse_heartbeat_once())
    return {"status": "pulse_triggered_manually"}

async def autonomous_pulse_heartbeat_once():
    """Run the heartbeat logic exactly once (helper for force-pulse)."""
    try:
        from database import (get_user_alerts, get_db)
        db = get_db()
        all_users = db.collection("users").stream()
        users = [{"id": u.id, **u.to_dict()} for u in all_users]
        
        for user in users:
            user_id = user["id"]
            tier = user.get("tier", "free").lower()
            alerts = await get_user_alerts(user_id)
            if not alerts: continue
            
            print_safe(f"  [MANUAL] Pulsing {tier.upper()} alerts for {user_id}...")
            for a in alerts:
                task_id = await create_task(user_id, a.get("search_query"))
                asyncio.create_task(run_local_scan(a.get("search_query"), [], task_id, user_id, a))
    except Exception as e:
        print_safe(f"[MANUAL] Pulse Error: {e}")

if __name__ == "__main__":
    import uvicorn
    # Local Node usually runs on 8000 to match the frontend expectations
    uvicorn.run(app, host="0.0.0.0", port=8000)
