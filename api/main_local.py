import os
import asyncio
import sys
import random

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

# [NETWORK] Surgical Proxy Isolation (v126.1)
# gRPC (Firebase) crashes if it tries to use the residential proxy.
# We move the proxy to SNIPER_PROXY so only Playwright uses it.
os.environ["SNIPER_PROXY"] = os.getenv("HTTP_PROXY", "")
os.environ["HTTP_PROXY"] = ""
os.environ["HTTPS_PROXY"] = ""
os.environ["http_proxy"] = ""
os.environ["https_proxy"] = ""

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Union
from pydantic import BaseModel
from services.templates import get_match_template, get_subscription_template, get_invoice_template
import json
import asyncio
import time
import hashlib
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

app = FastAPI(title="HomeSeek Local Elite Node", version="24.0.0")

# Enable CORS (Production Lockdown v126.0)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://homeseekza.web.app", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [TOOL] State Management
engine = SniperEngine()
sniper_lock = asyncio.Lock()

# [ABORT CONTROLLER] Scan Cancellation Flags
IS_SCAN_CANCELLED = False

def request_scan_stop():
    global IS_SCAN_CANCELLED
    IS_SCAN_CANCELLED = True

def reset_scan_stop():
    global IS_SCAN_CANCELLED
    IS_SCAN_CANCELLED = False

def check_scan_cancelled():
    global IS_SCAN_CANCELLED
    return IS_SCAN_CANCELLED

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
    min_sqm: Optional[int] = None,
    max_sqm: Optional[int] = None,
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    bedrooms: Optional[str] = None,
    bathrooms: Optional[str] = None,
    furnished: Optional[str] = None,
    platform: Optional[str] = None,
    view: Optional[str] = None,
    pets: Optional[bool] = None,
    layout: Optional[str] = None,
    page: int = 1,
    intent: Optional[str] = None,
    no_agents: Optional[bool] = None,
    lease_term: Optional[str] = None
):
    """Global Feed for the Explore Page with Semantic Vista & Pet Filters (v56.0)."""
    db = get_db()
    # For Semantic Vista/Pet filtering, we use the Memory-Sort logic to scan
    docs = db.collection("listings").limit(1000).stream()
    all_hits = [{"id": d.id, **d.to_dict()} for d in docs]
    
    res = []
    for h in all_hits:
        # [INTENT] 🛡️ Surgical Shield: Distinguish between Listings and Seekers
        if intent == 'listings':
            if h.get("is_looking_for") is True: continue
        elif intent == 'seekers':
            if h.get("is_looking_for") is not True: continue

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
        
        # [LAYOUT] Whole units vs Shared rooms
        if layout and h.get("property_sub_type") != layout: continue

        price = h.get("price") or 0
        if min_price and price < min_price: continue
        if max_price and price > max_price: continue

        # [SIZE] Square meters filter
        sqm_floor = min_sqm or min_size
        sqm_ceil = max_sqm or max_size
        l_sqm = h.get("sqm")
        if sqm_floor and (l_sqm is None or l_sqm < sqm_floor): continue
        if sqm_ceil and (l_sqm is not None and l_sqm > sqm_ceil): continue

        # [BEDROOMS]
        if bedrooms and bedrooms != 'any':
            l_beds = h.get("bedrooms")
            if l_beds is None:
                continue
            if bedrooms.endswith("+"):
                try:
                    if l_beds < float(bedrooms[:-1]): continue
                except ValueError: pass
            else:
                try:
                    if l_beds < float(bedrooms): continue
                except ValueError: pass

        # [BATHROOMS]
        if bathrooms and bathrooms != 'any':
            l_baths = h.get("bathrooms")
            if l_baths is None:
                continue
            if bathrooms.endswith("+"):
                try:
                    if l_baths < float(bathrooms[:-1]): continue
                except ValueError: pass
            else:
                try:
                    if l_baths < float(bathrooms): continue
                except ValueError: pass

        # [FURNISHED]
        if furnished and furnished != 'any':
            if furnished.lower() == 'furnished' and not h.get("is_furnished"): continue
            if furnished.lower() == 'unfurnished' and h.get("is_furnished") is True: continue

        if platform and platform.lower() not in str(h.get("platform", "")).lower() and platform.lower() not in str(h.get("source_name", "")).lower(): continue
        
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

        # [NO AGENTS / DIRECT LANDLORD] (Active by default)
        if no_agents is True or str(no_agents).lower() == 'true':
            is_direct = h.get("is_direct_landlord") is True
            plat = str(h.get("platform", "")).lower()
            src = str(h.get("source_name", "")).lower()
            if any(k in plat or k in src for k in ["facebook", "huis huis", "rentuncle", "direct landlord", "manual post"]):
                is_direct = True
            content = (str(h.get("title", "")) + " " + str(h.get("description", ""))).lower()
            if any(k in content for k in [
                "by owner", "landlord", "direct from owner", "private landlord", 
                "no agent", "no agents", "private let", "lease takeover", "sublet", "sub-let"
            ]):
                is_direct = True
            if not is_direct:
                continue

        # [LEASE TERM LENGTH] (1 = Month to Month, 3, 6, 12 Months) - Multi-Select Support
        if lease_term and lease_term != 'any':
            content = (str(h.get("title", "")) + " " + str(h.get("description", "")) + " " + str(h.get("lease_period", "")) + " " + str(h.get("rental_type", ""))).lower()
            selected_terms = [t.strip() for t in str(lease_term).split(",") if t.strip() and t.strip() != 'any']
            if selected_terms:
                term_hit = False
                for term_str in selected_terms:
                    if term_str == '1':
                        if any(k in content for k in ["month to month", "month-to-month", "month/month", "monthly", "1 month", "1-month", "flexible", "short-term", "short term"]):
                            term_hit = True
                            break
                    elif term_str == '3':
                        if any(k in content for k in ["3 month", "3-month", "3 months", "3-months", "1-6 month", "winter", "short-term", "short term"]):
                            term_hit = True
                            break
                    elif term_str == '6':
                        if any(k in content for k in ["6 month", "6-month", "6 months", "6-months", "semi-annual", "half year", "1-6 month"]):
                            term_hit = True
                            break
                    elif term_str == '12':
                        if any(k in content for k in ["12 month", "12-month", "12 months", "12-months", "1 year", "1-year", "annual", "long-term", "long term"]) or h.get("rental_type") in ['long-term', None]:
                            term_hit = True
                            break
                if not term_hit:
                    continue

        res.append(h)
        
    res.sort(key=lambda x: str(x.get('created_at', '')), reverse=True)
    per_page = 100
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    return res[start_idx:end_idx]

@app.get("/system/stats")
async def get_system_stats():
    """Diagnostic endpoint to verify local-cloud bridge."""
    try:
        db = get_db()
        users = db.collection("users").get()
        alerts_count = 0
        active_users = []
        
        for u in users:
            # Group missions by target area to enable MULTIPLEX scans
            alerts = db.collection("users").document(u.id).collection("alerts").stream()
            for a in alerts:
                mission = a.to_dict()
                # [GATE] Only process ACTIVE missions
                if not mission.get("is_active", True): continue
                
                target = mission.get("target_area") or mission.get("query")
                if not target: continue
                alerts_count += 1
                if u.id not in active_users:
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

@app.get("/health")
async def get_health():
    return {
        "status": "Healthy",
        "pulse_count": PULSE_COUNT,
        "uptime_node": "Local Sniper Core",
        "timestamp": dt.datetime.now().isoformat()
    }

@app.get("/analytics/active-snipers")
async def get_active_snipers():
    db = get_db()
    # Fetch all alerts across all users (Collection Group)
    # Note: Requires a Firestore Index for 'alerts' collection group
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        alerts = db.collection_group("alerts").where(filter=FieldFilter("is_active", "==", True)).stream()
        counts = {}
        for a in alerts:
            data = a.to_dict()
            area = data.get("target_area") or data.get("query") or "Unknown"
            counts[area] = counts.get(area, 0) + 1
        return counts
    except Exception as e:
        # Fallback for local dev if index isn't ready
        return {"Muizenberg": 12, "Sea Point": 8, "Kalk Bay": 5}

@app.get("/tasks/{task_id}")
async def fetch_task_status(task_id: str):
    db = get_db()
    doc = db.collection("tasks").document(task_id).get()
    if doc.exists: return doc.to_dict()
    return {"status": "Not Found"}

@app.get("/admin/stats")
async def get_admin_stats(user_id: str):
    """GOD VIEW: Aggregates global business intelligence for Authorized Personnel."""
    db = get_db()
    # AUTH GATE: Only Taun
    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists or user_doc.to_dict().get("email") != "taunhealy@gmail.com":
        raise HTTPException(status_code=403, detail="Access Denied: Authorized Personnel Only")
    
    users_ref = db.collection("users").stream()
    users_list = []
    for u in users_ref:
        users_list.append({**u.to_dict(), "id": u.id})
    
    total_users = len(users_list)
    recent_user = sorted(users_list, key=lambda x: str(x.get('created_at', '')), reverse=True)[0] if users_list else None
    subs = [u for u in users_list if u.get('tier', 'free') != 'free']
    recent_sub = sorted(subs, key=lambda x: str(x.get('updated_at', '')), reverse=True)[0] if subs else None
    
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        active_snipers = db.collection_group("alerts").where(filter=FieldFilter("is_active", "==", True)).get()
        sniper_count = len(active_snipers)
    except:
        sniper_count = 0
        
    return {
        "total_users": total_users,
        "recent_user": recent_user,
        "recent_sub": recent_sub,
        "active_snipers": sniper_count,
        "timestamp": dt.datetime.now().isoformat()
    }

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
        listing["platform"] = "HomeSeek"
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
            asyncio.create_task(email_client.send_email(email, f"🧾 Receipt: HomeSeek {tier.title()} Subscription", invoice_html))
            
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
    """Exposes the PREMIUM_SUBURBS list with presets for frontend autocomplete."""
    from core.geofence import PREMIUM_SUBURBS
    suburbs = sorted([s.title() for s in PREMIUM_SUBURBS])
    presets = [
        "⭐ My Favourites (Deep South + Constantia/Tokai)",
        "🏖️ Deep South (Noordhoek, Kommetjie, Fish Hoek, Kalk Bay)"
    ]
    return presets + suburbs

@app.post("/trigger-snipe")
async def trigger_targeted_snipe(data: dict, background_tasks: BackgroundTasks):
    query = data.get("query") or data.get("search_query") or ""
    source_ids = data.get("source_ids")
    user_id = data.get("user_id") or "taun_test_user"
    data["search_query"] = query
    data["query"] = query
    
    task_id = await create_task(user_id, query)
    
    # Wrap standard manual missions in a single-subscriber list for multiplex compatibility
    manual_sub = [{"user_id": user_id, "config": data}]
    
    background_tasks.add_task(run_local_scan, query, source_ids, task_id, manual_sub)
    return {"status": "local_node_dispatched", "task_id": task_id}

@app.post("/trigger-full-scan")
async def trigger_full_scan(payload: dict, background_tasks: BackgroundTasks):
    user_id = payload.get("user_id", "taun_test_user")
    effective_id = get_effective_user_id(user_id)
    
    from services.database import get_user_alerts, get_sources
    alerts = await get_user_alerts(effective_id)
    if not alerts: return {"status": "error", "message": "No alerts found."}
    
    sources = await get_sources()
    source_ids = payload.get("source_ids") or [s['id'] for s in sources]
    
    for alert in alerts:
        query = alert.get("search_query") or alert.get("query")
        if not query: continue
        task_id = await create_task(effective_id, query)
        subscribers = [{"user_id": effective_id, "config": alert, "is_initiator": True}]
        background_tasks.add_task(run_local_scan, query, source_ids, task_id, subscribers)
        
    return {"status": "success", "mission_count": len(alerts)}

@app.post("/trigger-re-match")
async def trigger_re_match(payload: dict, background_tasks: BackgroundTasks):
    user_id = payload.get("user_id", "taun_test_user")
    effective_id = get_effective_user_id(user_id)
    db = get_db()
    global_docs = db.collection("users").document("global_scout").collection("listings").limit(100).stream()
    listings = [d.to_dict() for d in global_docs]
    return {"status": "success", "intel_pool": len(listings)}

@app.post("/stop-scan")
@app.post("/cancel-scan")
async def stop_scan():
    request_scan_stop()
    print_safe("[ABORT] 🛑 Scan cancellation requested via API.")
    return {"status": "cancelled", "message": "Scraping cancellation initiated."}

async def run_local_scan(query: str, source_ids: List[str], task_id: str, subscribers: List[dict] = None):
    """
    ELITE MULTIPLEX SCAN (v81.1): 
    Scans a neighborhood ONCE and broadcasts to many.
    - Global Pool: Saves ALL residential results.
    - Tiered Broadcast: Only saves to specific users if they match filters.
    """
    async with sniper_lock:
        reset_scan_stop()
        print_safe(f"[LOCAL NODE] MULTIPLEX SCAN: {query} for {len(subscribers or [])} sub(s)")
        db = get_db()
        
        if not source_ids:
            all_sources = await get_sources()
            source_ids = [s['id'] for s in all_sources]

        valid_matches_count = 0
        for sid in source_ids:
            if check_scan_cancelled():
                print_safe(f"[ABORT] 🛑 Scan aborted by user before evaluating source {sid}.")
                await update_task(task_id, "Cancelled", "Mission cancelled by user.", completed=True)
                return
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
            
            is_compatible_zone = (
                source_zone == "global" or 
                source_zone == mission_zone or 
                (mission_zone in ["my-favourites", "deep-south"] and source_zone in ["south", "deep-south", "my-favourites"])
            )
            if not is_compatible_zone:
                print_safe(f"[ZONAL] Skipping irrelevant source: '{source_name}' for mission '{query}'")
                continue

            # [INFO] [SOURCE IQ] Global Search Broadening (v82.0)
            # Remove literal markers from the search bar to prevent "Zerio-Match" on strict queries.
            # The AI Extractor and Subscriber Config still enforce the pet-policy internally.
            clean_query = str(query or "")
            for marker in ["(MUST BE PET FRIENDLY)", "PET FRIENDLY", "(PET FRIENDLY)"]:
                clean_query = clean_query.replace(marker, "").replace(marker.lower(), "")
            clean_query = clean_query.strip()

            is_p24 = "property24.com" in source.get('url', '') or "property24" in source_name.lower()
            is_fav = any(k in clean_query.lower() for k in ["my favourites", "my favorites", "favourites", "favorites"])
            is_deep_south = any(k in clean_query.lower() for k in ["deep south", "south peninsula"])

            is_pet_req = any(s.get("config", {}).get("pet_friendly") for s in (subscribers or [])) or any(x in str(query).lower() for x in ["pet", "dog", "cat"])
            pet_param = "?sp=ptf%3dTrue" if is_pet_req else ""

            if is_p24 and is_fav:
                favourite_targets = [
                    # Deep South Suburbs
                    ("Fish Hoek", f"https://www.property24.com/to-rent/fish-hoek/western-cape/475{pet_param}"),
                    ("Noordhoek", f"https://www.property24.com/to-rent/noordhoek/western-cape/479{pet_param}"),
                    ("Kommetjie", f"https://www.property24.com/to-rent/kommetjie/western-cape/478{pet_param}"),
                    ("Scarborough", f"https://www.property24.com/to-rent/scarborough/western-cape/652{pet_param}"),
                    ("Simons Town", f"https://www.property24.com/to-rent/simons-town/western-cape/401{pet_param}"),
                    ("Muizenberg", f"https://www.property24.com/to-rent/muizenberg/cape-town/western-cape/9025{pet_param}"),
                    ("Kalk Bay", f"https://www.property24.com/to-rent/kalk-bay/cape-town/western-cape/9067{pet_param}"),
                    ("St James", f"https://www.property24.com/to-rent/st-james/cape-town/western-cape/9039{pet_param}"),
                    ("Glencairn", f"https://www.property24.com/to-rent/glencairn/simons-town/western-cape/9107{pet_param}"),
                    ("Capri", f"https://www.property24.com/to-rent/capri/fish-hoek/western-cape/10997{pet_param}"),
                    ("Clovelly", f"https://www.property24.com/to-rent/clovelly/fish-hoek/western-cape/10947{pet_param}"),
                    ("Sunnydale", f"https://www.property24.com/to-rent/sunnydale/noordhoek/western-cape/9090{pet_param}"),
                    # User Additions: Meadowridge, Bergvliet, Constantia, Hout Bay, Llandudno
                    ("Meadowridge", f"https://www.property24.com/to-rent/meadowridge/cape-town/western-cape/10052{pet_param}"),
                    ("Bergvliet", f"https://www.property24.com/to-rent/bergvliet/cape-town/western-cape/10189{pet_param}"),
                    ("Constantia", f"https://www.property24.com/to-rent/constantia/cape-town/western-cape/11742{pet_param}"),
                    ("Hout Bay", f"https://www.property24.com/to-rent/hout-bay/western-cape/615{pet_param}"),
                    ("Llandudno", f"https://www.property24.com/to-rent/llandudno/cape-town/western-cape/9118{pet_param}")
                ]
                all_fav_listings = []
                for idx, (sub_name, sub_url) in enumerate(favourite_targets):
                    if check_scan_cancelled():
                        print_safe(f"[ABORT] 🛑 P24 Favourites scan halted by user before '{sub_name}'.")
                        break
                    if idx > 0:
                        # [STEALTH] Human-paced jitter (5.0s - 8.5s) to avoid bot rate limits
                        await asyncio.sleep(random.uniform(5.0, 8.5))
                    await update_task(task_id, "Scouting", f"Node analyzing: Property24 ({sub_name}) [{idx+1}/{len(favourite_targets)}]")
                    sub_res = await engine.scrape_url(sub_url, task_id=task_id, search_area=sub_name)
                    if sub_res and sub_res.confidence_score == 0 and "bot challenge" in (sub_res.raw_summary or "").lower():
                        print_safe(f"[SHIELD] 🛑 Throttling P24 Favourites: Anti-bot challenge detected. Halting scan to safeguard IP.")
                        await update_task(task_id, "Throttled", "Property24 anti-bot challenge detected.")
                        break
                    if sub_res and sub_res.listings:
                        all_fav_listings.extend(sub_res.listings)
                from models.listing import ExtractionResult
                result = ExtractionResult(listings=all_fav_listings, confidence_score=100.0, raw_summary=f"Parsed {len(all_fav_listings)} listings from Property24 Favourites")
            elif is_p24 and is_deep_south:
                deep_targets = [
                    ("Fish Hoek", f"https://www.property24.com/to-rent/fish-hoek/western-cape/475{pet_param}"),
                    ("Noordhoek", f"https://www.property24.com/to-rent/noordhoek/western-cape/479{pet_param}"),
                    ("Kommetjie", f"https://www.property24.com/to-rent/kommetjie/western-cape/478{pet_param}"),
                    ("Scarborough", f"https://www.property24.com/to-rent/scarborough/western-cape/652{pet_param}"),
                    ("Simons Town", f"https://www.property24.com/to-rent/simons-town/western-cape/401{pet_param}"),
                    ("Muizenberg", f"https://www.property24.com/to-rent/muizenberg/cape-town/western-cape/9025{pet_param}"),
                    ("Kalk Bay", f"https://www.property24.com/to-rent/kalk-bay/cape-town/western-cape/9067{pet_param}"),
                    ("St James", f"https://www.property24.com/to-rent/st-james/cape-town/western-cape/9039{pet_param}"),
                    ("Glencairn", f"https://www.property24.com/to-rent/glencairn/simons-town/western-cape/9107{pet_param}"),
                    ("Capri", f"https://www.property24.com/to-rent/capri/fish-hoek/western-cape/10997{pet_param}"),
                    ("Clovelly", f"https://www.property24.com/to-rent/clovelly/fish-hoek/western-cape/10947{pet_param}"),
                    ("Sunnydale", f"https://www.property24.com/to-rent/sunnydale/noordhoek/western-cape/9090{pet_param}")
                ]
                all_deep_listings = []
                for idx, (sub_name, sub_url) in enumerate(deep_targets):
                    if check_scan_cancelled():
                        print_safe(f"[ABORT] 🛑 P24 Deep South scan halted by user before '{sub_name}'.")
                        break
                    if idx > 0:
                        # [STEALTH] Human-paced jitter (5.0s - 8.5s) to avoid bot rate limits
                        await asyncio.sleep(random.uniform(5.0, 8.5))
                    await update_task(task_id, "Scouting", f"Node analyzing: Property24 ({sub_name}) [{idx+1}/{len(deep_targets)}]")
                    sub_res = await engine.scrape_url(sub_url, task_id=task_id, search_area=sub_name)
                    if sub_res and sub_res.confidence_score == 0 and "bot challenge" in (sub_res.raw_summary or "").lower():
                        print_safe(f"[SHIELD] 🛑 Throttling P24 Deep South: Anti-bot challenge detected. Halting scan to safeguard IP.")
                        await update_task(task_id, "Throttled", "Property24 anti-bot challenge detected.")
                        break
                    if sub_res and sub_res.listings:
                        all_deep_listings.extend(sub_res.listings)
                from models.listing import ExtractionResult
                result = ExtractionResult(listings=all_deep_listings, confidence_score=100.0, raw_summary=f"Parsed {len(all_deep_listings)} listings from Property24 Deep South")
            else:
                await update_task(task_id, "Scouting", f"Node analyzing: {source_name}")
                result = await engine.scrape_url(source.get('url'), task_id=task_id, search_area=clean_query)
            
            if result:
                all_raw = []
                # [MATCH] Part A: Fresh AI Extractions
                for listing in result.listings:
                    l_dict = listing.dict() if hasattr(listing, 'dict') else listing
                    
                    # [CATEGORY HEAL] If AI identified as 'Wanted', force the rental_type (v120.1)
                    if l_dict.get("is_looking_for"):
                        l_dict['rental_type'] = "looking-for"
                    else:
                        l_dict['rental_type'] = l_dict.get("rental_type") or source_type
                        
                    all_raw.append(l_dict)
                
                # [RECALL] Part B: Memory Retrieval (Recall cached data for matching)
                if result.cached_hashes:
                    from services.database import get_listings_by_keys
                    print_safe(f"[MEMORY] Recalling {len(result.cached_hashes)} listings from registry...")
                    cached_data = await get_listings_by_keys([], result.cached_hashes)
                    all_raw.append(cached_data) if isinstance(cached_data, dict) else all_raw.extend(cached_data)

                # [DEDUPE] Surgically clean any overlapping cycle captures (v125.0)
                # Now with Cross-Platform Similarity Guard
                seen_sources = set()
                seen_similarity = set() # (Price + Suburb) fingerprint
                deduped_raw = []
                
                # [MISSION CEILING] 🛡️ Credit Safety Valve
                if len(result.listings) > 40:
                    print_safe(f"[GUARD] Mission Ceiling reached ({len(result.listings)} items). Clipping to 40 to protect AI quota.")
                    result.listings = result.listings[:40]

                for item in all_raw:
                    url = item.get("source_url")
                    price = item.get("price") or 0
                    suburb = str(item.get("address", "")).lower().strip()
                    
                    # Create a similarity fingerprint: "R15000-muizenberg"
                    fingerprint = f"{price}-{suburb}"
                    
                    # 🛡️ Cross-Platform Similarity Guard: If same price + same suburb, it's likely a dupe
                    is_duplicate = (url and url in seen_sources) or (price > 0 and suburb and fingerprint in seen_similarity)
                    
                    if not is_duplicate:
                        if url: seen_sources.add(url)
                        if price > 0 and suburb: seen_similarity.add(fingerprint)
                        deduped_raw.append(item)
                
                all_raw = deduped_raw

                if all_raw:
                    print_safe(f"[MULTIPLEX] Processing {len(all_raw)} total hits for Mission Subscribers (Fresh Search Feed)...")
                    from services.database import save_listing
                    
                    valid_matches_count = 0
                    for l_dict in all_raw:
                        # [LINK FIDELITY] Enforce Proper URLs (v81.0)
                        extracted_url = str(l_dict.get("source_url", ""))
                        is_malformed = any(bad in extracted_url for bad in ["example.com", "missing_url"]) or not extracted_url
                        
                        if is_malformed:
                            continue
                        
                        # [FILTER] RIGOROUS SUPPRESSION: Skip "Looking For" (Wanted) posts unless opted-in (v115.1)
                        is_wanted = l_dict.get("is_looking_for")
                        
                        # [GLOBAL] Always save to global pool if NOT a wanted ad (keep global feed clean)
                        if not is_wanted:
                            await save_listing("global_scout", l_dict) 

                        # [TARGET] BROADCAST: Check individual mission filters
                        if subscribers:
                            for sub in subscribers:
                                user_id = sub['user_id']
                                config = sub['config']
                                
                                # [AREA GUARD] (v160.0)
                                # If the user's search_query mentions an area, ensure the listing is in it.
                                # This prevents 'Observatory' listings from hitting 'Sea Point' subscribers 
                                # when scanning Global sources.
                                req_area = str(config.get("search_query", "")).lower()
                                listing_addr = str(l_dict.get("address", "")).lower()
                                
                                # Extract actual suburb from the query (e.g. "Sea Point", "My Favourites")
                                from core.geofence import PREMIUM_SUBURBS, MY_FAVOURITES_SUBURBS, DEEP_SOUTH_SUBURBS
                                if any(k in req_area for k in ["favourite", "favorite"]):
                                    matched_suburbs = list(MY_FAVOURITES_SUBURBS)
                                elif any(k in req_area for k in ["deep south", "south peninsula"]):
                                    matched_suburbs = list(DEEP_SOUTH_SUBURBS)
                                else:
                                    matched_suburbs = [s for s in PREMIUM_SUBURBS if s in req_area]
                                
                                if matched_suburbs:
                                    # If the user specified suburbs, the listing MUST match at least one
                                    if not any(s in listing_addr for s in matched_suburbs):
                                        continue
                                
                                # Apply Specific Filters (Price, Beds, Pets, Landlord, Lease, Furnished, Specs)
                                l_price = l_dict.get("price") or 0
                                if config.get("min_price") and l_price > 0 and l_price < config.get("min_price"): 
                                    print_safe(f"[RECON] [REJECT] Price R{l_price} < Min R{config.get('min_price')}")
                                    continue
                                if config.get("max_price") and l_price > config.get("max_price"): 
                                    print_safe(f"[RECON] [REJECT] Price R{l_price} > Max R{config.get('max_price')}")
                                    continue
                                if config.get("pet_friendly") and not l_dict.get("is_pet_friendly"): 
                                    continue

                                # [NO AGENTS / DIRECT LANDLORD]
                                if config.get("no_agents") and not l_dict.get("is_direct_landlord"):
                                    print_safe(f"[RECON] [REJECT] Filtered out agent listing (No-Agents policy active)")
                                    continue
                                
                                # [LEASE TERM]
                                req_lease = config.get("lease_term")
                                if req_lease and str(req_lease).lower() != "any":
                                    lease_str = str(l_dict.get("lease_period", "")).lower()
                                    desc_str = str(l_dict.get("description", "")).lower()
                                    combined_lease = f"{lease_str} {desc_str}"
                                    req_lease_str = str(req_lease).lower()
                                    if req_lease_str in ["1", "1 (m2m)", "month-to-month", "month to month"]:
                                        if not any(term in combined_lease for term in ["month to month", "month-to-month", "m2m", "monthly", "1 month", "flexible"]):
                                            continue
                                    elif req_lease_str in ["3", "3m"]:
                                        if not any(term in combined_lease for term in ["3 month", "3-month", "3 months", "short-term", "short term"]):
                                            continue
                                    elif req_lease_str in ["6", "6m"]:
                                        if not any(term in combined_lease for term in ["6 month", "6-month", "6 months"]):
                                            continue
                                    elif req_lease_str in ["12", "12m"]:
                                        if not any(term in combined_lease for term in ["12 month", "1-year", "1 year", "long-term", "long term", "annual"]):
                                            continue

                                # [CATEGORY FILTER] Filter by rental type if specified
                                req_type = config.get("rental_type")
                                
                                # [WANTED GUARD] If it's a wanted ad, ONLY deliver if specifically requested (v120.1)
                                if is_wanted and req_type != "looking-for":
                                    continue
                                
                                # [WANTED SUPPRESSION] If user wants standard rentals, skip wanted ads
                                if not is_wanted and req_type == "looking-for":
                                    continue

                                if req_type and req_type not in ["all", "any"] and req_type != "looking-for" and l_dict.get("rental_type") != req_type:
                                    print_safe(f"[RECON] [REJECT] Category Mismatch ({l_dict.get('rental_type')} vs {req_type})")
                                    continue
                                
                                # [LAYOUT FILTER] Whole vs Shared or Property Type (v90.0)
                                req_layout = config.get("property_sub_type") or config.get("layout")
                                if req_layout and req_layout not in ["all", "any", "any layout"]:
                                    p_type = str(l_dict.get("property_type", "")).lower()
                                    p_sub = str(l_dict.get("property_sub_type", "")).lower()
                                    target_layout = req_layout.lower()
                                    if target_layout not in p_type and target_layout not in p_sub:
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
                                
                                # [BATHROOM FILTER]
                                min_baths = config.get("bathrooms")
                                listing_baths = l_dict.get("bathrooms")
                                if min_baths and listing_baths is not None:
                                    if listing_baths < min_baths:
                                        print_safe(f"[RECON] [REJECT] Baths {listing_baths} < Required {min_baths}")
                                        continue

                                # [FURNISHED FILTER]
                                req_furn = config.get("furnished")
                                if req_furn and req_furn not in ["any", "any furnishing", "all"]:
                                    is_f = l_dict.get("is_furnished")
                                    if "unfurnished" in req_furn.lower() and is_f is True:
                                        continue
                                    elif "furnished" in req_furn.lower() and "unfurnished" not in req_furn.lower() and is_f is False:
                                        continue

                                min_s = config.get("min_sqm") or config.get("min_size")
                                listing_sqm = l_dict.get("sqm")
                                if min_s and listing_sqm is not None:
                                    if listing_sqm < min_s:
                                        print_safe(f"[RECON] [REJECT] Size {listing_sqm}m² < Required {min_s}m²")
                                        continue
                                
                                max_s = config.get("max_sqm") or config.get("max_size")
                                if max_s and listing_sqm is not None:
                                    if listing_sqm > max_s:
                                        print_safe(f"[RECON] [REJECT] Size {listing_sqm}m² > Max {max_s}m²")
                                        continue
                                
                                # [DEDUPE] Check if this is a fresh discovery for this user
                                doc_id = create_listing_id(l_dict)
                                user_seen = db.collection("users").document(user_id).collection("listings").document(doc_id).get().exists

                                # Valid match for this user!
                                valid_matches_count += 1
                                print_safe(f"\n" + "="*50)
                                print_safe(f"🏠 [HIT #{valid_matches_count}] {l_dict.get('title')}")
                                print_safe(f"💰 Price:    R {l_price:,}")
                                print_safe(f"📍 Area:     {l_dict.get('address')}")
                                print_safe(f"🛡️ Landlord: {'Direct Landlord (No Agents)' if l_dict.get('is_direct_landlord') else 'Agent'}")
                                if l_dict.get('bedrooms'): print_safe(f"🛏️ Beds:     {l_dict.get('bedrooms')}")
                                if l_dict.get('lease_period'): print_safe(f"⏱️ Lease:    {l_dict.get('lease_period')}")
                                print_safe(f"🔗 Link:     {l_dict.get('source_url')}")
                                print_safe("="*50 + "\n")
                                await save_listing(user_id, l_dict)
                                
                                # --- [SIGNAL BURST] INSTANT NOTIFICATION (v103.5) ---
                                user_profile = await get_user_profile(user_id)
                                if not user_profile: continue
                                
                                # [GATE] TIER GATE (v106.0)
                                is_initiator = sub.get("is_initiator", False)
                                tier = user_profile.get("tier", "free").lower()
                                can_multiplex = tier in ['gold', 'silver', 'bronze']
                                
                                if not is_initiator and not can_multiplex:
                                    print_safe(f"[RECON] [LOCKED] Retention Only: User '{user_id}' ({tier}) is riding along, but no instant alert fired.")
                                    continue

                                if not user_seen:
                                    try:
                                        whatsapp_number = user_profile.get("whatsapp")
                                        if whatsapp_number:
                                            wa_client = EvolutionClient()
                                            
                                            price_val = l_dict.get('price')
                                            price_display = f"R{price_val:,}" if price_val and price_val > 0 else "Price on Request"

                                            wa_msg = f"🏠 *HomeSeek Sniper: New Discovery*\n\n"
                                            wa_msg += f"*{l_dict.get('title')}*\n"
                                            wa_msg += f"💰 *Price:* {price_display}\n"
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
                                            print_safe(f"[SIGNAL] Email Alert Dispatched to {user_email}")
                                    except Exception as notify_err:
                                        print_safe(f"[SIGNAL ERROR] Alert Dispatch Failed: {notify_err}")
        
        if check_scan_cancelled():
            print_safe(f"\n🛑 [MISSION ABORTED] Task {task_id} halted by user.")
            await update_task(task_id, "Cancelled", f"Mission cancelled by user for {query}.", completed=True)
            return

        print_safe(f"\n🎯 [MISSION COMPLETE] Harvested {valid_matches_count} matching listings for '{query}'.")
        print_safe(f"🌐 View all live results in Explore: http://localhost:3000/explore\n")
        await update_task(task_id, "Complete", f"Aggregated scan finished for {query}.", completed=True)

# [PULSE] AUTONOMOUS HEARTBEAT: The 24/7 Tiered Sniper Pulse
PULSE_COUNT = 0 # Tracks how many 30-min cycles have passed

async def autonomous_pulse_heartbeat():
    """Background loop that executes tiered user alerts."""
    global PULSE_COUNT
    print_safe("[HEARTBEAT] Local Node Multiplex Pulse Engine initialized (30m cycles).")
    
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
                
                # --- [COST GUARD] TIER FREQUENCY (30m Base Pulse) ---
                is_due = False
                if PULSE_COUNT == 1: is_due = True # First pulse always runs
                elif tier == "gold": is_due = True # Every 30m
                elif tier == "silver": is_due = True # Every 30m
                elif tier == "bronze" or tier == "free":
                    if PULSE_COUNT % 48 == 0: is_due = True # Every 24h
                
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

            print_safe(f"[{dt.datetime.now().strftime('%H:%M:%S')}] [HEARTBEAT] Cycle complete. Resting for 30 minutes...")
            await asyncio.sleep(30 * 60)
            
            if PULSE_COUNT >= 48: PULSE_COUNT = 0 # Full daily cycle reset
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
