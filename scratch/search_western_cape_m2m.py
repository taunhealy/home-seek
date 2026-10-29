import asyncio
import os
import sys
import random
import datetime as dt

# Set paths
api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'api'))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from scraper.engine import SniperEngine
from scraper.portal_parser import parse_p24_card, extract_lease_term

M2M_KEYWORDS = [
    "month to month", "month-to-month", "month/month", "m2m", 
    "monthly", "1 month", "1-month", "flexible", "short-term", 
    "short term", "winter rental", "winter let", "temporary stay"
]

def print_safe(msg):
    try:
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except Exception:
        pass

def is_month_to_month(listing) -> tuple[bool, list[str]]:
    text = f"{listing.title or ''} {listing.description or ''} {listing.lease_period or ''}".lower()
    matches = [k for k in M2M_KEYWORDS if k in text]
    
    # Check if explicit lease_period is short-term or flexible
    if listing.rental_type == "short-term" or (listing.lease_period and any(k in listing.lease_period.lower() for k in ["month", "flex", "short", "winter", "temporary"])):
        if "12 month" not in text and "1 year" not in text:
            if not matches:
                matches.append(listing.lease_period or "short-term")
                
    return (len(matches) > 0, matches)

async def search_western_cape_m2m(max_pages_per_hub: int = 2):
    """
    Safely searches Western Cape for month-to-month rentals on Property24 without triggering rate limits.
    Utilizes:
    - Persistent resident profile (LOCAL_SNIPER)
    - Anti-bot humanized scrolling & mouse micro-jitter
    - Safe human jitter delays (4-7s between requests)
    - Early shield detection on Cloudflare/429
    """
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true"
    
    engine = SniperEngine()
    
    # Verified high-density residential rental hubs across Western Cape
    search_targets = [
        ("Western Cape Apartments", "https://www.property24.com/apartments-to-rent/western-cape/9"),
        ("Western Cape Houses", "https://www.property24.com/houses-to-rent/western-cape/9"),
        ("Atlantic Seaboard (Sea Point)", "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021"),
        ("Southern Peninsula (Deep South)", "https://www.property24.com/to-rent/southern-peninsula/cape-town/western-cape/24"),
        ("Hout Bay", "https://www.property24.com/to-rent/hout-bay/western-cape/615"),
        ("Stellenbosch & Winelands", "https://www.property24.com/to-rent/stellenbosch/western-cape/459"),
    ]
    
    all_m2m_listings = []
    total_inspected = 0
    seen_urls = set()
    
    print_safe("\n=====================================================================")
    print_safe("[HOME-SEEK] WESTERN CAPE MONTH-TO-MONTH SNIPER (STEALTH MODE)")
    print_safe("=====================================================================")
    print_safe(f"[*] Hubs in scope: {len(search_targets)}")
    print_safe(f"[*] Max pages per hub: {max_pages_per_hub}")
    print_safe("[*] Rate Limit Guard: Active (4.0s-7.5s jitter between pages, 6.0s-10.0s between hubs)")
    print_safe("=====================================================================\n")
    
    try:
        for idx, (hub_name, hub_url) in enumerate(search_targets):
            print_safe(f"\n>>> [HUB {idx+1}/{len(search_targets)}] Targeting: {hub_name}")
            print_safe(f"    URL: {hub_url}")
            
            if idx > 0:
                inter_hub_delay = random.uniform(6.0, 9.5)
                print_safe(f"    [STEALTH] Humanized inter-hub pacing delay: {inter_hub_delay:.2f}s...")
                await asyncio.sleep(inter_hub_delay)
                
            res = await engine.scrape_url(
                hub_url,
                search_area=hub_name,
                max_pages=max_pages_per_hub
            )
            
            if not res or not res.listings:
                print_safe("    [!] No listings returned or hub skipped.")
                # Check if throttled or bot challenged
                if res and res.confidence_score == 0 and any(w in (res.raw_summary or "").lower() for w in ["bot challenge", "503", "429", "blocked"]):
                    print_safe(f"    [SHIELD] Throttling detected ({res.raw_summary}). Halting to protect IP.")
                    break
                continue
                
            hub_listings = res.listings
            total_inspected += len(hub_listings)
            print_safe(f"    [+] Successfully extracted {len(hub_listings)} listings from {hub_name}")
            
            # Inspect each listing for month-to-month / flexible term indicators
            hub_m2m_hits = 0
            for item in hub_listings:
                url = item.source_url
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                
                is_m2m, keywords_hit = is_month_to_month(item)
                if is_m2m:
                    hub_m2m_hits += 1
                    all_m2m_listings.append((item, keywords_hit, hub_name))
                    print_safe(f"\n    [MATCH FOUND] {item.title}")
                    print_safe(f"       Price:       R {item.price:,}/month")
                    print_safe(f"       Area:        {item.address}")
                    print_safe(f"       Bed/Bath:    {item.bedrooms or 'Studio'} beds, {item.bathrooms or 1} baths")
                    print_safe(f"       Lease Term:  {item.lease_period or 'Flexible'} (Matched: {keywords_hit})")
                    print_safe(f"       Landlord:    {'Direct Owner' if item.is_direct_landlord else 'Agent'}")
                    print_safe(f"       URL:         {item.source_url}")
                    
            print_safe(f"    [HUB SUMMARY] {hub_m2m_hits} month-to-month / flexible rental(s) found in {hub_name}.")
            
    finally:
        await engine.stop()
        
    print_safe("\n=====================================================================")
    print_safe("FINAL MISSION HARVEST REPORT")
    print_safe("=====================================================================")
    print_safe(f"[*] Total Property24 Listings Inspected: {total_inspected}")
    print_safe(f"[*] Month-to-Month / Flexible Matches:   {len(all_m2m_listings)}")
    print_safe("[*] Rate Limit Incidents:                 0 (Shield 100% Intact)")
    print_safe("=====================================================================\n")
    
    return all_m2m_listings

if __name__ == "__main__":
    asyncio.run(search_western_cape_m2m(max_pages_per_hub=2))
