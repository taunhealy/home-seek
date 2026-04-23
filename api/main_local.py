import os
import asyncio
import sys

# [STABILITY] Windows Subprocess Patch (v24.1)
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
from pathlib import Path
from dotenv import load_dotenv
import sys

# [STABILITY] Windows Terminal ASCII Scrubber
def print_safe(msg):
    try:
        # Purge non-ASCII to prevent charmap crashes on Windows
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except:
        pass

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
        print_safe(f"SUCCESS: Loaded Local Node .env from: {path}")
        break

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Union
from pydantic import BaseModel
from services.templates import get_match_template, get_subscription_template, get_invoice_template
import json
import asyncio
import time
import datetime as dt
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import sys
from scraper.engine import SniperEngine
from services.database import (
    get_db, 
    save_listing, 
    get_sources, 
    create_task, 
    create_listing_id,
    update_task, 
    get_user_alerts,
    get_user_profile,
    save_search
)
from services.notifications import EvolutionClient, MailerSendClient, ResendEmailClient

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

def verify_user_match(requested_id: str, uid: str = None):
    """Ensures that the developer owner is only accessing their own data (v45.0)."""
    # [IDENTITY BRIDGE] Universal Mapping
    aliased_ids = ["taunhealy", "taun_test_user"]
    if uid == "R4R2k7z2XAQGgRjB57ctZcOkEbp2" and requested_id in aliased_ids:
        return
        
    if uid and requested_id != uid:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Identity mismatch."
        )

def get_effective_user_id(requested_id: str, uid: str = "R4R2k7z2XAQGgRjB57ctZcOkEbp2") -> str:
    """Translates incoming requests to the primary identity (v45.0)."""
    if uid == "R4R2k7z2XAQGgRjB57ctZcOkEbp2":
        return "taun_test_user"
    return requested_id

@app.get("/user-profile/{user_id}")
async def fetch_user_profile(user_id: str):
    # LOCAL: We default to the master tester UID for dev convenience
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2" 
    effective_id = get_effective_user_id(user_id, dummy_uid)
    profile = await get_user_profile(effective_id)
    return {**profile, "id": user_id}

@app.get("/listings/{user_id}")
async def fetch_user_listings(user_id: str):
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    effective_id = get_effective_user_id(user_id, dummy_uid)
    db = get_db()
    docs = db.collection("users").document(effective_id).collection("listings")\
             .order_by("created_at", direction=firestore.Query.DESCENDING)\
             .limit(50).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

@app.get("/searches/{user_id}")
async def fetch_user_alerts(user_id: str):
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    effective_id = get_effective_user_id(user_id, dummy_uid)
    alerts = await get_user_alerts(effective_id)
    return alerts

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
        elif rental_type == 'pet-sitting':
            # [PET-SIT] 🐾 Specialized Logic: Identify rentals with pet-care obligations
            is_petsit = h.get("rental_type") == 'pet-sitting'
            if not is_petsit:
                content = (str(h.get("title", "")) + " " + str(h.get("description", ""))).lower()
                if any(k in content for k in ["pet sit", "house sit", "look after pets", "mind my", "care for pets"]):
                    is_petsit = True
            if not is_petsit: continue
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

        # [PETS] 2. PET FILTER (v56.0)
        if pets and not h.get("is_pet_friendly"): continue
            
        # [VIEW] 3. VISTA SEMANTIC FILTER
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
            "timestamp": dt.datetime.now().strftime("%H:%M:%S")
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/deploy-sniper")
async def deploy_sniper(mission: dict, background_tasks: BackgroundTasks):
    user_id = mission.get("user_id", "taun_test_user")
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    effective_id = get_effective_user_id(user_id, dummy_uid)
    query = mission.get("target_area") or mission.get("search_query", "")
    is_alert_save = mission.get("alert_enabled", False)
    
    if is_alert_save:
        # Normalize ID based on Target Area (Primary) or Search Query (Fallback)
        # This enforces 1 Area per Alert policy (v120.0)
        search_id = hashlib.md5(query.lower().strip().encode()).hexdigest()[:12]
        mission['search_id'] = search_id
        
        # [SECURITY] Backend Limit Enforcement
        profile = await get_user_profile(effective_id)
        tier = profile.get("tier", "free").lower()
        
        # Canonical Tier Limits (Backend Mirror)
        BACKEND_LIMITS = {"free": 0, "bronze": 1, "silver": 10, "gold": 100}
        tier_limit = BACKEND_LIMITS.get(tier, 0)
        
        from services.database import get_user_alerts, save_search
        existing_alerts = await get_user_alerts(effective_id)
        
        if len(existing_alerts) >= tier_limit:
            return {
                "status": "limited", 
                "message": f"Critical: Your {tier.upper()} station has reached its mission capacity ({tier_limit} Snipers). Please upgrade to authorize further deployments."
            }

        await save_search(effective_id, mission)
        
    task_id = await create_task(effective_id, query)
    
    # Multiplex: Always fetch all related subscribers so one scan hits many
    from services.database import get_user_alerts
    all_subs = await get_user_alerts(query)
    
    # [TARGET] Mark the initiator (The one who triggered the scan)
    initiator_found = False
    for s in all_subs:
        if s.get('user_id') == effective_id:
            s['is_initiator'] = True
            initiator_found = True
    
    # Ensure current user is in the list even if they didn't 'Save' the alert (Quick Search mode)
    if not initiator_found:
        all_subs.append({"user_id": effective_id, "config": mission, "is_initiator": True})

    background_tasks.add_task(run_local_scan, query, [], task_id, all_subs)
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

@app.post("/update-alert/{user_id}/{search_id}")
async def update_alert(user_id: str, search_id: str, payload: dict):
    db = get_db()
    db.collection("users").document(user_id).collection("alerts").document(search_id).set(payload, merge=True)
    return {"status": "ok"}

@app.post("/update-profile")
async def update_profile(payload: dict):
    user_id = payload.get("user_id")
    if not user_id: return {"status": "error", "message": "Missing user_id"}
    db = get_db()
    db.collection("users").document(user_id).set({
        "whatsapp": payload.get("whatsapp"),
        "email": payload.get("email"),
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)
    return {"status": "ok"}
    
@app.post("/listings/manual")
async def manual_post_listing(listing: dict):
    """Allows users to manually submit a listing via the local API."""
    try:
        from services.database import save_listing
        # Standardize listing
        listing["rental_type"] = listing.get("rental_type", "long-term")
        listing["platform"] = "Manual Post"
        listing["discovery_method"] = "manual_submission"
        
        # Save to Global Community Feed
        await save_listing("community_manual", listing)
        return {"status": "success", "message": "Intel shared with the community!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update-tier")
async def update_user_tier(payload: dict):
    user_id = payload.get("user_id")
    tier = payload.get("tier")
    sub_id = payload.get("subscription_id")
    
    if not user_id or not tier:
        return {"status": "error", "message": "Missing user_id or tier"}
        
    db = get_db()
    db.collection("users").document(user_id).set({
        "tier": tier.lower(),
        "subscription_id": sub_id,
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    from services.database import get_user_profile
    profile = await get_user_profile(user_id)
    email = profile.get("email")
    name = profile.get("name", "Hunter")
    
    if email:
        from services.notifications import ResendEmailClient
        email_client = ResendEmailClient()
        welcome_html = get_subscription_template(tier, name)
        asyncio.create_task(email_client.send_email(email, f"🏹 Welcome to the {tier.title()} Elite", welcome_html))
        
        amounts = {"bronze": 149, "silver": 299, "gold": 499}
        amount = amounts.get(tier.lower(), 0)
        if amount > 0:
            invoice_html = get_invoice_template(email, tier, amount)
            asyncio.create_task(email_client.send_email(email, f"🧾 Receipt: Home-Seek {tier.title()} Subscription", invoice_html))
            
    return {"status": "ok"}

@app.get("/unsubscribe/{user_id}")
async def unsubscribe_user(user_id: str):
    db = get_db()
    db.collection("users").document(user_id).set({
        "notify_email": False,
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)
    return {"status": "ok", "message": "You have been unsubscribed from property alerts."}

@app.get("/geofence/suburbs")
async def get_elite_suburbs():
    """Exposes the PREMIUM_SUBURBS list for frontend autocomplete."""
    from core.geofence import PREMIUM_SUBURBS
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
        print_safe(f"[LOCAL NODE] MULTIPLEX SCAN: {query} for {len(subscribers or [])} sub(s)")
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

            # [ZONAL] [FILTER] Precision Dispatch (v85.1)
            # Avoid searching irrelevant groups (e.g., searching "Big Bay" in "Sea Point" feeds).
            # This kills 'Something went wrong' errors by reducing bot-like behavior.
            from core.geofence import get_zone_for_area
            mission_zone = get_zone_for_area(query)
            source_zone = get_zone_for_area(source_name)
            
            if source_zone != "global" and source_zone != mission_zone:
                print_safe(f"[ZONAL] Skipping irrelevant source: '{source_name}' for mission '{query}'")
                continue

            # [INFO] [SOURCE IQ] Global Search Broadening (v82.0)
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
                # [MATCH] Part A: Fresh AI Extractions
                for listing in result.listings:
                    l_dict = listing.dict() if hasattr(listing, 'dict') else listing
                    l_dict['rental_type'] = source_type
                    all_raw.append(l_dict)
                
                # [RECALL] Part B: Memory Retrieval (Recall cached data for matching)
                if result.cached_hashes:
                    from services.database import get_listings_by_keys
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
                    
                    # [GLOBAL] GLOBAL RETENTION: Always save to global pool (v81.2)
                    # We pass None for user_id to trigger global-only save path if needed, 
                    # but save_listing handles double-push. 
                    # We create an 'Anonymous' save to the global collection first.
                    from services.database import save_listing
                    
                    # Save to GLOBAL list first (No user filters)
                    await save_listing("global_scout", l_dict) 

                    # [TARGET] BROADCAST: Check individual mission filters
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
                                print_safe(f"[RECON] [REJECT] Category Mismatch ({l_dict.get('rental_type')} vs {req_type})")
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
                                    print_safe(f"[RECON] [REJECT] Beds {listing_beds} < Required {min_val}")
                                    continue
                            elif min_b and listing_beds is None:
                                print_safe(f"[RECON] [PARTIAL] Partial Match: No beds assigned, treating as 'Any'")
                            
                            # [DEDUPE] Check if this is a fresh discovery for this user
                            doc_id = create_listing_id(l_dict)
                            user_seen = db.collection("users").document(user_id).collection("listings").document(doc_id).get().exists

                            # Valid match for this user!
                            print_safe(f"[RECON] [MATCH] VALID MATCH! Saving to User Feed: {user_id}")
                            await save_listing(user_id, l_dict)
                            
                            # --- [SIGNAL BURST] INSTANT NOTIFICATION (v103.5) ---
                            # Fetch user profile for contact details
                            user_profile = await get_user_profile(user_id)
                            if not user_profile: continue
                            
                            # [FILTER] Skip "Looking For" posts for alerts (v115.0)
                            if l_dict.get("is_looking_for"): continue
                            
                            # [GATE] TIER GATE (v106.0)
                            # Only high-tiers or the person who triggered the scan get the 'Ride-Along' alert.
                            # Bronze/Free still get the listing saved (Data Coverage), but they don't get the WhatsApp/Ping.
                            is_initiator = sub.get("is_initiator", False)
                            tier = user_profile.get("tier", "free").lower()
                            can_multiplex = tier in ['gold', 'silver', 'diamond']
                            
                            if not is_initiator and not can_multiplex:
                                print_safe(f"[RECON] [LOCKED] Retention Only: User '{user_id}' ({tier}) is riding along, but no instant alert fired.")
                                continue

                            if not user_seen:
                                try:
                                    whatsapp_number = user_profile.get("whatsapp")
                                    if whatsapp_number:
                                        wa_client = EvolutionClient()
                                        
                                        wa_msg = f"🏠 *Home-Seek Sniper: New Discovery*\n\n"
                                        wa_msg += f"*{l_dict.get('title')}*\n"
                                        wa_msg += f"💰 *Price:* R{(l_dict.get('price') or 0):,}\n"
                                        wa_msg += f"📍 *Area:* {l_dict.get('address', 'Cape Town')}\n"
                                        wa_msg += f"🛏️ *Specs:* {l_dict.get('bedrooms', 'N/A')} Beds | {l_dict.get('property_sub_type', 'Whole')}\n\n"
                                        wa_msg += f"--- \n"
                                        wa_msg += f"🧠 *AI INSIGHT:*\n"
                                        wa_msg += f"_{l_dict.get('ai_summary', 'Fresh listing matching your alert criteria.')}_\n\n"
                                        wa_msg += f"✅ *INTEL:*\n"
                                        wa_msg += f"• *View:* {l_dict.get('view_category', 'Other')}\n"
                                        wa_msg += f"• *Pet Friendly:* {'Yes' if l_dict.get('is_pet_friendly') else 'No'}\n\n"
                                        wa_msg += f"--- \n"
                                        wa_msg += f"🔗 *ACTION:*\n"
                                        wa_msg += f"{l_dict.get('source_url')}\n\n"
                                        wa_msg += f"---"

                                        asyncio.create_task(wa_client.send_whatsapp(whatsapp_number, wa_msg))
                                        print_safe(f"[SIGNAL] WhatsApp Alert Dispatched to {whatsapp_number}")
                                    
                                    user_email = user_profile.get("email")
                                    if user_email:
                                        email_client = ResendEmailClient()
                                        subject = f"🏹 Match: {l_dict.get('title')}"
                                        body = get_match_template(l_dict)
                                        asyncio.create_task(email_client.send_email(user_email, subject, body))
                                except Exception as notify_err:
                                    print_safe(f"[SIGNAL ERROR] Alert Dispatch Failed: {notify_err}")
        
        await update_task(task_id, "Complete", f"Aggregated scan finished for {query}.", completed=True)

# [PULSE] AUTONOMOUS HEARTBEAT: The 24/7 Tiered Sniper Pulse
PULSE_COUNT = 0 # Tracks how many 30-min cycles have passed

async def autonomous_pulse_heartbeat():
    """Background loop that executes tiered user alerts."""
    global PULSE_COUNT
    print_safe("[HEARTBEAT] Local Node Multiplex Pulse Engine initialized (1h cycles).")
    
    while True:
        try:
            PULSE_COUNT += 1
            print_safe(f"[{dt.datetime.now().strftime('%H:%M:%S')}] [HEARTBEAT] Cycle #{PULSE_COUNT} starting...")
            
            db = get_db()
            all_users = db.collection("users").stream()
            users = [{"id": u.id, **u.to_dict()} for u in all_users]

            # [TARGET] AGGREGATION HUB: Group alerts by Neighborhood (Multiplex v109.5)
            mission_map = {} 
            
            for user in users:
                tier = user.get("tier", "free").lower()
                
                # [IDENTITY BRIDGE] Ensure heartbeat recognizes the aliased ID
                raw_id = user["id"]
                user_id = get_effective_user_id(raw_id)
                
                alerts = await get_user_alerts(user_id)
                if not alerts: continue
                
                # --- [COST GUARD] TIER FREQUENCY (1h Base Pulse) ---
                is_due = False
                if PULSE_COUNT == 1: is_due = True # First pulse always runs
                elif tier == "gold": is_due = True # Every 1h
                elif tier == "silver":
                    if PULSE_COUNT % 4 == 0: is_due = True # Every 4h
                elif tier == "bronze" or tier == "free":
                    if PULSE_COUNT % 24 == 0: is_due = True # Every 24h
                
                if not is_due: continue
                
                alerts = await get_user_alerts(user_id)
                if not alerts: continue
                
                for a in alerts:
                    query = a.get("search_query", "").strip()
                    if not query: continue
                    if query not in mission_map: mission_map[query] = []
                    mission_map[query].append({"user_id": user_id, "config": a})

            # 🚀 EXECUTE MULTIPLEX MISSIONS
            for query, subs in mission_map.items():
                print_safe(f"[MULTIPLEX] Starting Aggregated Scan: '{query}' for {len(subs)} users...")
                task_id = await create_task(subs[0]['user_id'], query)
                await run_local_scan(query, [], task_id, subs)
                print_safe(f"[MULTIPLEX] Aggregated Scan complete for '{query}'.")

            print_safe(f"[{dt.datetime.now().strftime('%H:%M:%S')}] [HEARTBEAT] Cycle complete. Resting for 1 hour...")
            await asyncio.sleep(1 * 3600)
            
            if PULSE_COUNT >= 24: PULSE_COUNT = 0 # Full daily cycle reset
        except Exception as e:
            print_safe(f"[HEARTBEAT] Error: {e}")
            await asyncio.sleep(300)

@app.on_event("startup")
async def startup_event():
    # [BOOT] SINGLETON BOOT: Launch persistent browser
    await engine.start()
    
    # [SILENT] AUTOMATIC PULSE DISABLED (v46.0)
    # Background scraping only occurs when manually triggered via Sniper Hub GUI.
    print_safe("[HEARTBEAT] Local Node started in SILENT MODE. Waiting for manual mission triggers...")
    # asyncio.create_task(autonomous_pulse_heartbeat())

@app.on_event("shutdown")
async def shutdown_event():
    # 🛑 GRACEFUL EXIT: Close persistent browser
    await engine.stop()

@app.post("/force-pulse")
async def force_pulse():
    """Manual trigger to bypass the 30-minute timer for testing."""
    print_safe("[MANUAL OVERDRIVE] Force-triggering autonomous heartbeat cycle...")
    # This just runs the logic once in the background
    asyncio.create_task(autonomous_pulse_heartbeat_once())
    return {"status": "pulse_triggered_manually"}

async def autonomous_pulse_heartbeat_once():
    """Run the heartbeat logic exactly once (helper for force-pulse)."""
    try:
        from services.database import (get_user_alerts, get_db)
        db = get_db()
        all_users = db.collection("users").stream()
        users = [{"id": u.id, **u.to_dict()} for u in all_users]

        # [TARGET] AGGREGATION HUB: Group alerts by Neighborhood
        mission_map = {} 
        for user in users:
            raw_id = user["id"]
            # [IDENTITY BRIDGE] Ensure manual pulse finds aliased alerts
            user_id = get_effective_user_id(raw_id)
            
            alerts = await get_user_alerts(user_id)
            if not alerts: continue
            
            for a in alerts:
                query = a.get("search_query", "").strip()
                if not query: continue
                if query not in mission_map: mission_map[query] = []
                mission_map[query].append({"user_id": user_id, "config": a})

        # 🚀 EXECUTE MISSIONS
        for query, subs in mission_map.items():
            print_safe(f"[MANUAL] Triggering Aggregated Scan: '{query}'")
            task_id = await create_task(subs[0]['user_id'], query)
            asyncio.create_task(run_local_scan(query, [], task_id, subs))
            
    except Exception as e:
        print_safe(f"[MANUAL] Pulse Error: {e}")

if __name__ == "__main__":
    import uvicorn
    # Local Node usually runs on 8000 to match the frontend expectations
    uvicorn.run(app, host="0.0.0.0", port=8000)
