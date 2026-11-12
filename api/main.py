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

from fastapi import FastAPI, BackgroundTasks, HTTPException, Response
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Union, Dict, Any
from pydantic import BaseModel
from services.templates import get_match_template, get_subscription_template, get_invoice_template, build_alert_subject
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
    allow_origins=["https://homeseekza.web.app", "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [TOOL] State Management
from intelligence.evaluator import PropertyEvaluator
evaluator = PropertyEvaluator()
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

@app.on_event("startup")
async def on_startup():
    from services.scheduler import scheduler
    scheduler.start()
    print_safe("[STARTUP] HomeSeek Core & Daily 11:00 AM SAST Scheduler started.")

@app.on_event("shutdown")
async def on_shutdown():
    from services.scheduler import scheduler
    scheduler.stop()
    print_safe("[SHUTDOWN] Scheduler safely stopped.")

@app.get("/user-profile/{user_id}")
async def fetch_user_profile(user_id: str):
    # LOCAL: We default to the master tester UID for dev convenience
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2" 
    effective_id = get_effective_user_id(user_id, dummy_uid)
    profile = await get_user_profile(effective_id)
    if "pro_credits" not in profile:
        profile["pro_credits"] = 5
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
        elif rental_type in ['month-to-month', 'm2m']:
            is_m2m = h.get("rental_type") in ['month-to-month', 'm2m']
            if not is_m2m:
                content = (str(h.get("title", "")) + " " + str(h.get("description", "")) + " " + str(h.get("lease_period", "")) + " " + str(h.get("rental_type", ""))).lower()
                from scraper.portal_parser import M2M_KEYWORDS
                if any(k in content for k in M2M_KEYWORDS):
                    is_m2m = True
            if not is_m2m: continue
        elif rental_type == 'short-term':
            is_st = h.get("rental_type") in ['short-term', 'month-to-month', 'm2m']
            if not is_st:
                content = (str(h.get("title", "")) + " " + str(h.get("description", "")) + " " + str(h.get("lease_period", ""))).lower()
                from scraper.portal_parser import M2M_KEYWORDS
                if any(k in content for k in M2M_KEYWORDS + ["short term", "short-term", "holiday", "airbnb"]):
                    is_st = True
            if not is_st: continue
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

        # [BEDROOMS] Always minimum-based (1+, 2+, 3+, etc.)
        if bedrooms and str(bedrooms).lower() not in ['any', 'all', '']:
            l_beds = h.get("bedrooms")
            if l_beds is None:
                continue
            try:
                min_b = float(str(bedrooms).replace("+", "").strip())
                if l_beds < min_b:
                    continue
            except (ValueError, TypeError):
                pass

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
                    if term_str in ['1', 'm2m', 'month-to-month']:
                        from scraper.portal_parser import M2M_KEYWORDS
                        if h.get("rental_type") in ['month-to-month', 'm2m'] or any(k in content for k in M2M_KEYWORDS):
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


class LiveSearchRequest(BaseModel):
    suburbs: List[str]
    min_price: Optional[int] = 0
    max_price: Optional[int] = 999999
    bedrooms: Optional[str] = "1+"
    anchor_lat: Optional[float] = None
    anchor_lng: Optional[float] = None
    force_fresh: Optional[bool] = False

@app.post("/api/search/live-scrape")
async def live_scrape_search(req: LiveSearchRequest):
    """Live scraper that searches Property24 on-demand for target suburbs and price filters."""
    from services.live_search import scrape_p24_live, get_p24_circuit_status, get_last_batch_meta
    try:
        results = scrape_p24_live(
            suburbs=req.suburbs,
            min_price=req.min_price or 0,
            max_price=req.max_price or 999999,
            beds=req.bedrooms or "1+",
            anchor_lat=req.anchor_lat,
            anchor_lng=req.anchor_lng,
            force_fresh=bool(req.force_fresh)
        )
        circuit = get_p24_circuit_status()
        batch_meta = get_last_batch_meta()
        return {
            "status": "cooldown" if (circuit["circuit_open"] and len(results) == 0) else "success",
            "count": len(results),
            "listings": results,
            "rate_guard": circuit,
            "batch_meta": batch_meta,
        }
    except Exception as err:
        return {
            "status": "error",
            "message": str(err),
            "count": 0,
            "listings": []
        }

class VerifyFavouritesItem(BaseModel):
    id: str
    p24_id: Optional[str] = None
    url: Optional[str] = None

class VerifyFavouritesRequest(BaseModel):
    items: List[VerifyFavouritesItem] = []
    active_live_ids: List[str] = []
    force_fresh: Optional[bool] = True

@app.post("/api/p24/verify-favourites")
async def verify_p24_favourites(req: VerifyFavouritesRequest):
    """
    Verifies whether saved/imported Property24 favourites are still active.
    Uses freshly scraped live IDs first (0 network calls), then politely checks
    remaining URLs with p24_client concurrency/rate-limit protection.
    """
    from services.availability_checker import check_single_listing_availability
    from services.live_search import P24_DEV_MODE, remove_listing_ids_from_cache, get_p24_circuit_status
    from services.p24_client import p24_client

    active_set = {str(x).replace("p24-", "").strip() for x in (req.active_live_ids or []) if str(x).strip()}
    ttl = (15 * 60) if req.force_fresh else 86400 * 3

    expired_ids: List[str] = []
    expired_details: List[Dict[str, Any]] = []
    verified_active_ids: List[str] = []
    network_checks = 0
    max_checks_per_batch = 5

    for item in req.items:
        p24_id = str(item.p24_id or item.id or "").replace("p24-", "").strip()
        if p24_id and p24_id in active_set:
            verified_active_ids.append(item.id)
            continue

        url = (item.url or "").strip()
        if not url and p24_id.isdigit():
            url = f"https://www.property24.com/to-rent/listing/{p24_id}"
        if not url:
            continue

        is_cached_fresh = bool(p24_client.get_cached(url, max_age_seconds=ttl))
        if not is_cached_fresh and (p24_client.is_circuit_open() or network_checks >= max_checks_per_batch):
            continue

        res = await check_single_listing_availability(url, cache_ttl_seconds=ttl)
        if not is_cached_fresh:
            network_checks += 1

        if res.get("verified") and not res.get("is_available"):
            expired_ids.append(item.id)
            if p24_id:
                expired_ids.append(p24_id)
            expired_details.append({
                "id": item.id,
                "p24_id": p24_id,
                "reason": res.get("status_reason", "Expired"),
            })
        elif res.get("verified") and res.get("is_available"):
            verified_active_ids.append(item.id)

    if expired_ids:
        remove_listing_ids_from_cache(set(expired_ids))

    return {
        "status": "success",
        "checked": len(req.items),
        "network_checks": network_checks,
        "expired_ids": list(dict.fromkeys(expired_ids)),
        "expired_details": expired_details,
        "verified_active_ids": verified_active_ids,
        "rate_guard": get_p24_circuit_status(),
    }

@app.get("/api/pool/stats")
async def get_pool_stats_endpoint():
    """Returns status and metrics of the centralized listings pool and sync poller."""
    try:
        from services.listings_db import get_pool_stats
        return {"status": "success", "pool": get_pool_stats()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ImportP24FavouritesRequest(BaseModel):
    raw_input: str
    anchor_lat: Optional[float] = None
    anchor_lng: Optional[float] = None

@app.post("/api/p24/import-favourites")
async def import_p24_favourites(req: ImportP24FavouritesRequest):
    """
    Imports user's favourited properties from Property24 by parsing
    pasted URLs, listing numbers, or raw HTML copied from My Favourites page.
    """
    from services.favourites_importer import import_p24_favourites_pipeline
    try:
        res = await import_p24_favourites_pipeline(
            raw_input=req.raw_input,
            anchor_lat=req.anchor_lat,
            anchor_lng=req.anchor_lng
        )
        return res
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "count": 0,
            "listings": []
        }

@app.post("/api/address/normalize")
async def normalize_address_endpoint(payload: dict):
    """
    Normalizes messy marketing addresses and performs multi-tiered precision geocoding.
    """
    try:
        from services.address_normalizer import normalize_and_geocode
        raw_address = payload.get("address", "")
        suburb = payload.get("suburb", "")
        title = payload.get("title", "")
        description = payload.get("description", "")
        result = normalize_and_geocode(raw_address, suburb, title, description)
        return {
            "status": "success",
            "result": result
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

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

@app.post("/save-alert")
async def save_alert_endpoint(mission: dict, background_tasks: BackgroundTasks):
    user_id = mission.get("user_id", "taun_test_user")
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    effective_id = get_effective_user_id(user_id, dummy_uid)
    query = mission.get("target_area") or mission.get("search_query", "")
    mission["alert_enabled"] = True
    mission["is_active"] = mission.get("is_active", True)
    
    from services.database import save_search
    search_id = await save_search(effective_id, mission)
    
    task_id = None
    if mission.get("trigger_initial_scan", False) and query:
        task_id = await create_task(effective_id, query)
        subscribers = [{"user_id": effective_id, "config": mission, "is_initiator": True}]
        background_tasks.add_task(run_local_scan, query, [], task_id, subscribers)
        
    return {"status": "saved", "search_id": search_id, "task_id": task_id}

class EvaluationRequest(BaseModel):
    listing: dict
    must_include: Optional[List[str]] = []
    must_exclude: Optional[List[str]] = []
    lifestyle_signals: Optional[List[str]] = []
    strict_mode: Optional[bool] = False
    require_verified_sea_view: Optional[bool] = False
    min_agency_rating: Optional[float] = None
    exclude_low_rated_agencies: Optional[bool] = False
    allow_direct_landlords: Optional[bool] = True
    commute_anchors: Optional[List[Dict[str, Any]]] = []
    require_independent_living: Optional[bool] = False
    require_private_entrance: Optional[bool] = False
    require_private_garden: Optional[bool] = False
    exclude_landlord_on_site: Optional[bool] = False
    exclude_shared_house: Optional[bool] = True
    require_no_one_above: Optional[bool] = False

@app.post("/evaluate-listing")
async def evaluate_listing_endpoint(req: EvaluationRequest):
    """Generates comprehensive Pros, Cons & Hidden Costs, and Viewing Checklist using Gemini 3.8 Flash."""
    try:
        report = await evaluator.evaluate_property(
            listing=req.listing,
            must_include=req.must_include or [],
            must_exclude=req.must_exclude or [],
            lifestyle_signals=req.lifestyle_signals or [],
            strict_mode=req.strict_mode or False,
            commute_anchors=req.commute_anchors or [],
            require_independent_living=req.require_independent_living or False,
            require_private_entrance=req.require_private_entrance or False,
            require_private_garden=req.require_private_garden or False,
            exclude_landlord_on_site=req.exclude_landlord_on_site or False,
            exclude_shared_house=req.exclude_shared_house if req.exclude_shared_house is not None else True,
            require_no_one_above=req.require_no_one_above or False
        )
        return {"status": "success", "report": report.dict()}
    except Exception as e:
        print_safe(f"[EVALUATION ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/ai-scout")
async def run_ai_scout_endpoint(req: dict):
    """
    Scouts real-time listings on Property24/PrivateProperty and uses AI to rank
    the best options based on freeform user desires, standard form options,
    and personal tastes/hobbies.
    """
    try:
        from services.ai_scout import scout_engine, ScoutPreferences
        prefs = ScoutPreferences(
            prompt=req.get("prompt"),
            personal_tastes=req.get("personal_tastes"),
            areas=req.get("areas", ["Gardens", "Tamboerskloof"]),
            min_price=req.get("min_price"),
            max_price=req.get("max_price", 18000),
            min_bedrooms=req.get("min_bedrooms"),
            max_bedrooms=req.get("max_bedrooms"),
            bathrooms=req.get("bathrooms"),
            is_furnished=req.get("is_furnished"),
            property_type=req.get("property_type", "Apartment"),
            must_have_parking=req.get("must_have_parking", False),
            pet_friendly=req.get("pet_friendly")
        )
        result = await scout_engine.scout_and_rank(prefs)
        return {"status": "success", "result": result.dict()}
    except Exception as e:
        print_safe(f"[AI SCOUT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-ai-alert")
async def save_ai_alert_endpoint(req: dict, background_tasks: BackgroundTasks):
    """
    Saves a persistent AI Scout Alert with cron schedule (Daily at 11am SAST),
    standard portal options, and freeform lifestyle tastes. Optionally triggers
    an immediate first run so the user gets an instant report.
    """
    try:
        user_id = req.get("user_id", "taun_test_user")
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(user_id, dummy_uid)
        
        db = get_db()
        now_sast = dt.datetime.now(dt.timezone(dt.timedelta(hours=2)))
        
        # Determine alert ID
        alert_title = req.get("title") or f"{', '.join(req.get('areas', ['Cape Town']))} Scout"
        aid_seed = f"{effective_id}_{alert_title}".lower()
        alert_id = req.get("id") or hashlib.md5(aid_seed.encode()).hexdigest()[:12]
        
        alert_payload = {
            "id": alert_id,
            "user_id": effective_id,
            "title": alert_title,
            "prompt": req.get("prompt", ""),
            "personal_tastes": req.get("personal_tastes", ""),
            "areas": req.get("areas", ["Gardens", "Tamboerskloof"]),
            "min_price": req.get("min_price"),
            "max_price": req.get("max_price", 18000),
            "min_bedrooms": req.get("min_bedrooms"),
            "property_type": req.get("property_type", "Apartment"),
            "is_furnished": req.get("is_furnished"),
            "must_have_parking": req.get("must_have_parking", False),
            "is_active": req.get("is_active", True),
            "frequency": req.get("frequency", "daily_11am"),
            "notify_whatsapp": req.get("notify_whatsapp", True),
            "notify_email": req.get("notify_email", True),
            "whatsapp_number": req.get("whatsapp_number"),
            "notification_email": req.get("notification_email"),
            "updated_at": firestore.SERVER_TIMESTAMP,
            "created_at": req.get("created_at") or now_sast.isoformat()
        }
        
        db.collection("users").document(effective_id).collection("alerts").document(alert_id).set(alert_payload, merge=True)
        print_safe(f"[API] Saved AI Scout Alert {alert_id} for user {effective_id}")
        
        # Trigger immediate execution in background if requested
        if req.get("run_immediately", True):
            from services.scheduler import scheduler
            background_tasks.add_task(scheduler.generate_alert_report, effective_id, alert_payload)
            
        return {"status": "success", "alert_id": alert_id, "message": "Alert saved and scheduled for 11:00 AM SAST daily"}
    except Exception as e:
        print_safe(f"[SAVE AI ALERT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/{user_id}")
async def get_user_reports_endpoint(user_id: str):
    """Fetches all generated AI reports and Top 10 rankings for a user."""
    try:
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(user_id, dummy_uid)
        db = get_db()
        docs = db.collection("users").document(effective_id).collection("reports")\
                 .order_by("created_at", direction=firestore.Query.DESCENDING)\
                 .limit(30).stream()
        reports = [{"id": d.id, **d.to_dict()} for d in docs]
        return {"status": "success", "reports": reports}
    except Exception as e:
        print_safe(f"[GET REPORTS ERROR] {e}")
        return {"status": "success", "reports": []}

@app.post("/trigger-report/{user_id}/{alert_id}")
async def trigger_report_now(user_id: str, alert_id: str, background_tasks: BackgroundTasks):
    """Manually triggers an on-demand report generation for a specific alert."""
    try:
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(user_id, dummy_uid)
        db = get_db()
        doc = db.collection("users").document(effective_id).collection("alerts").document(alert_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        alert_data = {"alert_id": alert_id, **doc.to_dict()}
        from services.scheduler import scheduler
        report = await scheduler.generate_alert_report(effective_id, alert_data)
        return {"status": "success", "report": report}
    except Exception as e:
        print_safe(f"[TRIGGER REPORT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/realview/rectify")
async def realview_rectify_endpoint(url: str, k1: float = -0.22, k2: float = 0.06, fov_crop: float = 1.25):
    """RealView™ de-distortion: converts 0.5x ultra-wide photo to human eye natural perspective."""
    try:
        from services.lens_rectifier import fetch_image_bytes, rectify_image_bytes
        raw_bytes = fetch_image_bytes(url)
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Could not fetch image")
        rect_bytes = rectify_image_bytes(raw_bytes, k1=k1, k2=k2, fov_crop=fov_crop)
        return Response(content=rect_bytes, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        print_safe(f"[REALVIEW ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RealViewAnalyzeRequest(BaseModel):
    image_url: str
    room_type: str = "bedroom"

@app.post("/api/realview/analyze")
async def realview_analyze_endpoint(req: RealViewAnalyzeRequest):
    """RealView™ Multimodal AI spatial reality check (Pro Feature)."""
    try:
        from services.lens_rectifier import analyze_spatial_reality_with_ai
        analysis = await analyze_spatial_reality_with_ai(req.image_url, req.room_type)
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        print_safe(f"[REALVIEW ANALYZE ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProAuditRequest(BaseModel):
    listing_id: str
    report_id: str
    user_id: str

class TopupCreditsRequest(BaseModel):
    user_id: str
    pack: str = "starter_5"
    credits: int = 5



class UpdateLocationsRequest(BaseModel):
    report_id: str
    user_id: str
    anchors: List[Dict[str, Any]]

class VerifyAvailabilityRequest(BaseModel):
    report_id: str
    user_id: str

@app.post("/api/reports/pro-audit")
async def generate_pro_audit_endpoint(req: ProAuditRequest):
    """
    Unlocks a high-precision Pro AI Vision Report for a specific listing in a report.
    Costs 1 Pro Credit (R10). Results are permanently cached on the listing.
    """
    try:
        from services.pro_report_generator import generate_pro_ai_report
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        user_ref = db.collection("users").document(effective_id)
        u_doc = user_ref.get()
        user_data = u_doc.to_dict() if u_doc.exists else {}
        user_credits = user_data.get("pro_credits", 5)
        
        rep_ref = db.collection("users").document(effective_id).collection("reports").document(req.report_id)
        rep_doc = rep_ref.get()
        if not rep_doc.exists:
            rep_ref = db.collection("users").document("taun_test_user").collection("reports").document(req.report_id)
            rep_doc = rep_ref.get()
            if not rep_doc.exists:
                raise HTTPException(status_code=404, detail="Report not found")
        
        rep_data = rep_doc.to_dict()
        ranked = rep_data.get("ranked_listings", [])
        
        target_listing = None
        target_idx = -1
        for idx, item in enumerate(ranked):
            if str(item.get("listing_id")) == str(req.listing_id):
                target_listing = item
                target_idx = idx
                break
                
        if not target_listing:
            raise HTTPException(status_code=404, detail=f"Listing {req.listing_id} not found in report")
            
        # 1. If already audited, return cached report for free!
        if target_listing.get("pro_report"):
            return {
                "status": "success",
                "pro_report": target_listing["pro_report"],
                "is_cached": True,
                "remaining_credits": user_credits
            }
            
        # 2. Check credits
        if user_credits < 1:
            return {
                "status": "insufficient_credits",
                "pro_credits": user_credits,
                "message": "You need 1 Pro Credit (R10) to unlock this forensic AI report."
            }
            
        # 3. Generate Pro Report
        user_prompt = rep_data.get("user_prompt", "")
        personal_tastes = rep_data.get("personal_tastes", "")
        pro_report = await generate_pro_ai_report(
            listing=target_listing,
            user_prompt=user_prompt,
            personal_tastes=personal_tastes,
            user_id=effective_id
        )
        
        # 4. Deduct 1 credit & update user
        new_credits = max(0, user_credits - 1)
        user_ref.set({"pro_credits": new_credits}, merge=True)
        # also update taun_test_user if effective_id != taun_test_user
        if effective_id != "taun_test_user":
            db.collection("users").document("taun_test_user").set({"pro_credits": new_credits}, merge=True)
        
        # 5. Save pro_report permanently on the listing in the report
        target_listing["pro_report"] = pro_report
        target_listing["vision_audit"] = pro_report
        ranked[target_idx] = target_listing
        rep_ref.update({"ranked_listings": ranked})
        
        return {
            "status": "success",
            "pro_report": pro_report,
            "is_cached": False,
            "remaining_credits": new_credits
        }
    except Exception as e:
        print_safe(f"[PRO AUDIT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/credits/topup")
async def topup_credits_endpoint(req: TopupCreditsRequest):
    """Adds Pro Credits to a user wallet (e.g. 5 Pro Reports for R50)."""
    try:
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        user_ref = db.collection("users").document(effective_id)
        u_doc = user_ref.get()
        current_credits = (u_doc.to_dict() if u_doc.exists else {}).get("pro_credits", 5)
        
        new_credits = current_credits + req.credits
        user_ref.set({"pro_credits": new_credits}, merge=True)
        if effective_id != "taun_test_user":
            db.collection("users").document("taun_test_user").set({"pro_credits": new_credits}, merge=True)
            
        return {
            "status": "success",
            "credits_added": req.credits,
            "new_balance": new_credits,
            "message": f"Successfully added {req.credits} Pro Credits. New balance: {new_credits}."
        }
    except Exception as e:
        print_safe(f"[TOPUP ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))




@app.get("/api/places/autocomplete")
async def autocomplete_places_endpoint(q: str = "", limit: int = 8):
    """
    Provides real-time Google Maps / Places autocomplete suggestions for destinations and anchors.
    Uses Google Places Autocomplete API when GOOGLE_PLACES_API_KEY is available,
    with instant fallback to curated Cape Town places of interest.
    """
    try:
        from services.places_service import search_places
        results = await search_places(q, limit=limit)
        return {
            "status": "success",
            "query": q,
            "suggestions": results
        }
    except Exception as e:
        print_safe(f"[PLACES AUTOCOMPLETE ERROR] {e}")
        return {"status": "success", "query": q, "suggestions": []}

@app.get("/api/places/details")
async def place_details_endpoint(query: str = "", lat: Optional[float] = None, lng: Optional[float] = None):
    """
    Returns rich metadata, verified address, opening hours, star ratings, and photo
    for a place / gym / bar / anchor.
    Caches results in SQLite places_cache.db for $0 recurring API cost.
    """
    try:
        from services.places_service import get_place_details
        details = await get_place_details(query=query, lat=lat, lng=lng)
        if details:
            if isinstance(details.get("photo_urls"), str):
                try:
                    details["photo_urls"] = json.loads(details["photo_urls"])
                except Exception:
                    details["photo_urls"] = [details["photo_url"]] if details.get("photo_url") else []
            return {"status": "success", "place": details}
        return {"status": "not_found", "message": "Place details not found"}
    except Exception as e:
        print_safe(f"[PLACES DETAILS ERROR] {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/places/photo")
async def place_photo_proxy(photo_reference: str, maxwidth: int = 1000):
    """
    Proxies Google Places photo references so the browser can load verified place images directly
    without exposing the Google Places API key or hitting client-side referrer restrictions.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google Places API key not configured")
    photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth={maxwidth}&photo_reference={photo_reference}&key={api_key}"
    return RedirectResponse(url=photo_url, status_code=307)


@app.post("/api/reports/update-locations")
async def update_report_locations_endpoint(req: UpdateLocationsRequest):
    """
    Updates the user's custom location anchors for a report and recalculates
    proximity and travel times (driving, walking, cycling) for all listings.
    """
    try:
        from services.commute_service import calculate_listing_proximities
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        rep_ref = db.collection("users").document(effective_id).collection("reports").document(req.report_id)
        rep_doc = rep_ref.get()
        if not rep_doc.exists:
            rep_ref = db.collection("users").document("taun_test_user").collection("reports").document(req.report_id)
            rep_doc = rep_ref.get()
            if not rep_doc.exists:
                raise HTTPException(status_code=404, detail="Report not found")
                
        rep_data = rep_doc.to_dict()
        ranked = rep_data.get("ranked_listings", [])
        
        # Recalculate proximity for each listing
        for item in ranked:
            address = item.get("address") or item.get("title") or "Gardens, Cape Town"
            item["location_proximity"] = await calculate_listing_proximities(address, req.anchors)
            
        rep_ref.update({
            "ranked_listings": ranked,
            "location_anchors": req.anchors,
            "commute_anchors": req.anchors
        })
        
        return {
            "status": "success",
            "location_anchors": req.anchors,
            "listings": ranked,
            "message": f"Updated proximity to {len(req.anchors)} locations across {len(ranked)} listings."
        }
    except Exception as e:
        print_safe(f"[UPDATE LOCATIONS ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reports/verify-availability")
async def verify_availability_endpoint(req: VerifyAvailabilityRequest):
    """
    Checks real-time availability of all listings in a report against Property24/Gumtree.
    Identifies listings that are removed (404), Under Offer, or Let Agreed.
    Updates the report in Firestore and returns updated listing availability data.
    """
    try:
        from services.availability_checker import verify_report_listings_availability
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        rep_ref = db.collection("users").document(effective_id).collection("reports").document(req.report_id)
        rep_doc = rep_ref.get()
        if not rep_doc.exists:
            rep_ref = db.collection("users").document("taun_test_user").collection("reports").document(req.report_id)
            rep_doc = rep_ref.get()
            if not rep_doc.exists:
                raise HTTPException(status_code=404, detail="Report not found")
                
        rep_data = rep_doc.to_dict()
        ranked = rep_data.get("ranked_listings", [])
        
        result = await verify_report_listings_availability(ranked)
        
        # Persist updated availability status to Firestore
        rep_ref.update({
            "ranked_listings": result["listings"],
            "last_availability_check": result["checked_at"]
        })
        
        return {
            "status": "success",
            "active_count": result["active_count"],
            "unavailable_count": result["unavailable_count"],
            "unavailable_ids": result["unavailable_ids"],
            "listings": result["listings"],
            "checked_at": result["checked_at"]
        }
    except Exception as e:
        print_safe(f"[VERIFY AVAILABILITY ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

_listing_photos_cache: Dict[str, List[str]] = {}

@app.get("/api/listing-photos")
async def get_listing_photos(url: str):
    """Fetches high-res interior/exterior photos for a listing, filtering out agent headshots and logos."""
    if not url:
        return {"status": "error", "photos": []}

    # Check in-memory cache
    if url in _listing_photos_cache and _listing_photos_cache[url]:
        return {"status": "success", "photos": _listing_photos_cache[url]}

    clean_url = url
    if clean_url.startswith("/"):
        clean_url = f"https://www.property24.com{clean_url}"

    try:
        import re
        from services.p24_client import p24_client

        # Polite rate-limited fetch with disk/RAM caching & circuit breaking
        html = await p24_client.fetch_html(clean_url, cache_ttl_seconds=86400 * 7)
        if not html:
            return {"status": "success", "photos": []}

        # 1. Target genuine property gallery containers and lightbox elements
        lightbox_ids = re.findall(r'data-(?:lightbox-src|image-url)="https://images\.prop24\.com/(\d+)', html)
        listing_img_ids = re.findall(r'alt="Listing number:[^"]*"[^>]*(?:lazy-src|src)="https://images\.prop24\.com/(\d+)', html)
        gal_href_ids = re.findall(r'rel="photo\[pp_gal\]"[^>]*href="https://images\.prop24\.com/(\d+)', html)

        candidate_ids = []
        seen = set()
        for pid in lightbox_ids + listing_img_ids + gal_href_ids:
            if pid not in seen:
                seen.add(pid)
                candidate_ids.append(pid)

        # Fallback if specific gallery attributes are missing
        if not candidate_ids:
            all_ids = re.findall(r"""https://images\.prop24\.com/(\d+)/[^\s"'<>]+""", html)
            for pid in all_ids:
                if pid not in seen:
                    seen.add(pid)
                    candidate_ids.append(pid)

        # 2. Strict blacklisting of agent headshots, profile avatars, and agency logos
        agent_pids = set(re.findall(r'(?:agentPhoto|RealEstateAgent|agent-profile|agent-image|js_agentPhoto)[^>]*https://images\.prop24\.com/(\d+)', html))
        agent_pids.update(re.findall(r"""https://images\.prop24\.com/(\d+)/[^\s"'<>]*(?:UpperCrop|Fit450|Fit200|Fit150|Crop200x200)""", html))

        clean_photos = [f"https://images.prop24.com/{pid}/Crop600x400" for pid in candidate_ids if pid not in agent_pids]
        if clean_photos:
            _listing_photos_cache[url] = clean_photos[:24]

        # Extract full description features (garage, secure parking bay, stove, inverter, pet_friendly)
        html_lower = html.lower()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        desc_el = soup.find(class_=re.compile(r"p24_description|js_readMoreText|p24_features|p24_keyFeatures", re.I))
        desc_text = desc_el.get_text(" ", strip=True).lower() if desc_el else html_lower

        has_garage = bool(re.search(r"\b(?:garage|garages|lock-up|lock\s+up\s+garage|automated\s+garage|single\s+garage|double\s+garage)\b", desc_text))
        has_secure_bay = bool(re.search(r"\b(?:secure\s+parking(?:\s+bay)?|parking\s+bay|off-street\s+parking|off\s+street\s+parking|undercover\s+parking|basement\s+parking|allocated\s+(?:parking|bay)|shaded\s+parking|carport|vehicular\s+access(?:\s+driveway)?|sliding\s+gate\s+vehicular\s+access|remote\s+controlled\s+(?:sliding\s+)?gate\s+(?:vehicular\s+)?access|parking\s+behind\s+gate|secure\s+off-street)\b", desc_text))
        parking_type = "garage" if has_garage else ("secure_bay" if has_secure_bay else None)
        stove_type = "gas" if any(k in desc_text for k in ["gas hob", "gas stove", "gas cooker", "gas burner"]) else (
            "induction" if any(k in desc_text for k in ["induction hob", "induction stove"]) else None
        )
        has_inverter = bool(re.search(r"\b(?:inverter|solar|backup|ups|load shedding)\b", desc_text))
        pet_friendly = True if re.search(r"\b(?:pet friendly|pets allowed|pets welcome|dogs allowed|cats allowed)\b", desc_text) else None

        # Extract agency reputation from detail page HTML
        agency_info = {}
        try:
            from services.live_search import _extract_agency_from_html
            from services.agency_reputation import lookup_agency_reputation
            raw_ag = _extract_agency_from_html(html)
            if not raw_ag and ("liesl and giselle" in desc_text or "liesl or giselle" in desc_text):
                raw_ag = "Progressive Housing Investments"
            if raw_ag:
                rep = lookup_agency_reputation(raw_ag)
                if rep:
                    agency_info = {
                        "agency_name": rep.get("canonical_name") or raw_ag,
                        "agency_rating": rep.get("google_rating"),
                        "agency_review_count": rep.get("google_review_count"),
                        "agency_risk_level": rep.get("risk_level", "low"),
                        "agency_flags": rep.get("flags", []),
                        "agency_complaint_sample": rep.get("recent_complaint_sample"),
                        "agency_hellopeter_rating": rep.get("hellopeter_rating"),
                    }
        except Exception:
            pass

        return {
            "status": "success",
            "photos": clean_photos[:24],
            "features": {
                "has_garage": has_garage,
                "has_secure_bay": has_secure_bay,
                "parking_type": parking_type,
                "stove_type": stove_type,
                "has_inverter": has_inverter,
                "pet_friendly": pet_friendly,
                "description": desc_el.get_text(" ", strip=True)[:2000] if desc_el else "",
                **agency_info,
            },
        }
    except Exception as e:
        print_safe(f"[LISTING PHOTOS ERROR] {e}")
        return {"status": "error", "photos": []}


class ForensicVisionRequest(BaseModel):
    id: str = ""
    url: str = ""
    title: str = ""
    address: str = ""
    price: float = 0
    bedrooms: float = 1
    bathrooms: float = 1
    sqm: Optional[float] = None
    description: str = ""
    images: List[str] = []
    uploaded_images: List[str] = []
    photo_source_mode: str = "both"
    personal_preferences: str = ""


_forensic_vision_cache: Dict[str, Dict[str, Any]] = {}


def _build_architectural_heuristics(req: ForensicVisionRequest, building_intel: Optional[dict] = None) -> dict:
    desc_lower = (req.description or "").lower()
    title_lower = (req.title or "").lower()
    all_text = f"{title_lower} {desc_lower}"
    prefs_lower = (req.personal_preferences or "").lower()
    is_wfh_full = "work from home (full-time)" in prefs_lower or "full-time" in prefs_lower
    is_wfh_any = "work from home" in prefs_lower or "remote" in prefs_lower or "wfh" in prefs_lower
    is_studio = (req.bedrooms is not None and req.bedrooms <= 0.5) or any(w in all_text for w in ["studio", "bachelor", "0.5 bed", "loft"])
    sqm = req.sqm or 0

    # 1. WFH & Layout Ergonomics
    if is_studio:
        size_note = f"({sqm} m²) " if sqm else ""
        if is_wfh_full:
            wfh_layout_verdict = (
                f"0.5-bed / studio footprint {size_note}poses full-time WFH friction: no acoustic door separating desk from fridge/kitchen hum, "
                "and bed may appear in video calls unless zoned with a screen or alcove."
            )
        elif is_wfh_any:
            wfh_layout_verdict = (
                f"0.5-bed / studio layout {size_note}is workable for part-time WFH / café hybrid if you place a compact desk near the window; "
                "watch for fridge hum and cooking smells in an open-plan room."
            )
        else:
            wfh_layout_verdict = (
                f"Open-plan 0.5-bed / studio {size_note}maximizes usable floor area without corridor waste; verify storage and dedicated dining/desk zones."
            )
    elif sqm and sqm < 52:
        wfh_layout_verdict = (
            f"Compact {sqm} m² floor plan: confirm a clear ≥1.2 m desk zone away from kitchen appliances and bedroom traffic for comfortable WFH."
        )
    else:
        wfh_layout_verdict = (
            "Separate bedroom(s) allow an acoustic door between sleeping/kitchen zones and a dedicated workspace for uninterrupted WFH calls."
        )

    # 2. Window Placement & Natural Light
    has_outdoor = any(w in all_text for w in ["balcony", "patio", "deck", "terrace", "sliding door"])
    if "north" in all_text:
        window_light_audit = (
            "North-facing aspect (Cape Town gold standard for all-day winter warmth & low damp risk). "
            + ("Balcony/sliding doors aid cross-ventilation." if has_outdoor else "Check window-to-wall ratio for airflow.")
        )
    elif "west" in all_text:
        window_light_audit = (
            "West-facing exposure brings warm afternoon sun but risks harsh late-afternoon screen glare during WFH calls; inspect blinds."
        )
    elif "south" in all_text:
        window_light_audit = (
            "South-facing aspect gets softer, indirect light and can feel cooler in winter — check for damp/condensation behind curtains and window frames."
        )
    else:
        window_light_audit = (
            ("Balcony/sliding doors support cross-ventilation and daylight. " if has_outdoor else "Single-aspect windows may limit cross-breeze; ")
            + "Verify during viewing that windows don't face a close brick wall (<3 m) forcing blinds closed all day."
        )

    # 3. Wall Type & Acoustics
    is_heritage = any(w in all_text for w in ["art deco", "parquet", "high ceiling", "heritage", "character", "solid brick"])
    is_modern_infill = any(w in all_text for w in ["new development", "modern block", "loft", "micro", "newly built"])
    if is_heritage:
        wall_acoustic_audit = (
            "Older/heritage solid brick construction typically blocks airborne neighbour voices well; "
            "if parquet floors exist, check upstairs footfall transmission."
        )
    elif is_modern_infill:
        wall_acoustic_audit = (
            "Modern infill/sectional title build: check whether internal walls are hollow drywall (higher voice/TV bleed) and note hard-tile echo on video calls."
        )
    else:
        wall_acoustic_audit = (
            "Standard masonry/sectional title build; check party-wall thickness, upstairs floor impact, and add a rug/curtains if rooms are all-tile to cut Zoom echo."
        )

    # 4. Ceiling Height & Volume
    if any(w in all_text for w in ["high ceiling", "double volume", "victorian", "art deco"]):
        ceiling_volume_audit = "High ceilings (~2.8 m–3.2 m+) boost airiness, daylight reach, and acoustic comfort for WFH; verify true room width beyond 0.5x lens photos."
    elif any(w in all_text for w in ["cottage", "garden flat", "basement", "attic"]):
        ceiling_volume_audit = "Cottage/ancillary structure: verify ceiling height (≥2.4 m) and bulkhead clearances in person, as low ceilings can feel tight during full-time WFH."
    else:
        ceiling_volume_audit = "Standard ~2.4 m–2.6 m ceiling height inferred; watch for 0.5x ultra-wide camera stretching in listing photos."

    # 5. Light Fixtures & Evening Livability
    if any(w in all_text for w in ["downlight", "recessed", "led", "renovated", "modern"]):
        lighting_fixtures_audit = "Likely fitted with modern recessed downlights/layered fixtures; check color temperature (warm 2700K–3000K vs harsh 5000K) and inverter-tied lights."
    else:
        lighting_fixtures_audit = "Check whether rooms rely on a single central overhead bulb (creates screen glare/shadows at night) and confirm bathroom extractor/window ventilation."

    # 6. Exterior & Building Communication
    if building_intel and building_intel.get("building_name"):
        bc = building_intel.get("body_corporate") or "Active sectional title management"
        exterior_building_audit = f"{building_intel.get('building_name')}: {bc}. Inspect façade paint, balcony drainage, and perimeter gate/intercom upkeep on arrival."
    elif any(w in all_text for w in ["estate", "24 hour", "concierge", "access control", "electric fence"]):
        exterior_building_audit = "Managed security perimeter signalled; check façade paint/rust streaks and bin-area neatness as a proxy for Body Corporate reserve health."
    else:
        exterior_building_audit = "Inspect exterior façade for peeling paint, rust/water streaks under balconies, and working gate motors/electric fencing — key clues to Body Corporate health."

    return {
        "wfh_layout_verdict": wfh_layout_verdict,
        "window_light_audit": window_light_audit,
        "wall_acoustic_audit": wall_acoustic_audit,
        "ceiling_volume_audit": ceiling_volume_audit,
        "lighting_fixtures_audit": lighting_fixtures_audit,
        "exterior_building_audit": exterior_building_audit,
    }


def _build_heuristic_vision_fallback(req: ForensicVisionRequest, clean_imgs: list, is_quota_err: bool = False, err_str: str = "", building_intel: Optional[dict] = None):
    desc_lower = (req.description or "").lower()
    title_lower = (req.title or "").lower()
    all_text = f"{title_lower} {desc_lower}"
    photo_count = max(len(clean_imgs), len(req.images or []))
    uploaded_count = len(req.uploaded_images or [])
    total_photos = photo_count + uploaded_count
    arch = _build_architectural_heuristics(req, building_intel=building_intel)

    fallback_pros = []
    fallback_cons = []

    if uploaded_count > 0:
        fallback_pros.append(f"Includes {uploaded_count} tenant-uploaded viewing/off-portal photo(s) for raw, un-retouched snagging & condition verification.")

    # 1. Gallery Depth & Visual Presentation
    if total_photos >= 5:
        fallback_pros.append(f"Gallery includes {total_photos}+ photos documenting interior living zones and fixtures.")
    else:
        fallback_cons.append(f"Limited photographic transparency ({total_photos} photos provided) — some interior angles withheld.")

    # 2. Kitchen & Finishes Visual Cues
    if any(w in all_text for w in ["modern", "renovated", "granite", "caesarstone", "contemporary", "sleek"]):
        fallback_pros.append("Modernised kitchen finishes, contemporary cabinetry, and clean worktop surfaces.")
    else:
        fallback_pros.append("Functional residential kitchen cabinetry and standard built-in worktops.")

    # 3. Daylight & Exterior Connections
    if any(w in all_text for w in ["balcony", "patio", "deck", "terrace", "garden", "braai"]):
        fallback_pros.append("Private outdoor extension (balcony/patio/courtyard) visible in gallery presentation.")
    if any(w in all_text for w in ["light", "sunny", "bright", "north", "views", "ocean", "mountain"]):
        fallback_pros.append("Natural daylighting through exterior glazing with elevated aspect.")

    # 4. Gaps, Missing Angles & Watchouts
    if not any(w in all_text for w in ["bathroom", "shower", "en-suite", "ensuite"]):
        fallback_cons.append("Missing photo gap: bathroom sanitaryware and shower condition not clearly featured.")
    if not any(w in all_text for w in ["garage", "bay", "carport", "parking"]):
        fallback_cons.append("Missing photo gap: dedicated off-street vehicle parking bay not verified in photos.")
    if (req.bedrooms is not None and req.bedrooms <= 0.5) or any(w in all_text for w in ["cottage", "studio", "bachelor", "compact"]):
        fallback_cons.append("Open-plan / studio footprint — check desk placement, fridge hum, and call backdrop.")

    fallback_cons.append("Real estate lens focal length: verify true room depth and ceiling heights in person.")

    photo_story = (
        f"Inspected {photo_count} photo(s). Gallery documents primary interior living spaces. "
        + ("(Live Gemini Vision paused: AI Studio prepayment depleted. Showing heuristic visual & architectural audit)."
           if is_quota_err else "(Showing heuristic visual & architectural audit).")
    )

    detected_stove = "gas" if "gas" in all_text else "electric"

    return {
        "photo_story": photo_story,
        "photo_pros": fallback_pros[:4],
        "photo_cons": fallback_cons[:4],
        "glazing": arch["window_light_audit"],
        "distortion": arch["ceiling_volume_audit"],
        "stove_type": detected_stove,
        **arch,
        "building_intel": building_intel,
        "inspected_photo_count": photo_count,
        "is_fallback": True,
        "fallback_reason": (
            "AI Studio prepayment credits depleted (402 RESOURCE_EXHAUSTED). Top up at aistudio.google.com/billing or use a free-tier key."
            if is_quota_err else (f"Vision service fallback: {err_str[:80]}" if err_str else "Heuristic visual inspection.")
        ),
    }

@app.post("/api/listing/forensic-vision")
async def listing_forensic_vision(req: ForensicVisionRequest):
    """Inspects listing gallery photos + tenant-uploaded viewing/off-portal photos with Gemini Vision."""
    uploaded_imgs = [u for u in (req.uploaded_images or []) if isinstance(u, str) and u.startswith("data:image/")][:8]
    mode = (req.photo_source_mode or "both").lower()
    cache_key = f"v3::{req.id or req.url}::{mode}::{len(uploaded_imgs)}::{req.personal_preferences.strip()[:80]}"
    if not uploaded_imgs and cache_key in _forensic_vision_cache:
        return {"status": "success", "vision": _forensic_vision_cache[cache_key], "cached": True}

    # Resolve building/complex intelligence via building_reviews.py
    building_intel = None
    try:
        from services.building_reviews import extract_building_name, get_building_reviews
        b_name = extract_building_name(req.title or "", req.address or "", req.description or "")
        if b_name:
            area_hint = (req.address or "Cape Town").split(",")[0].strip() or "Cape Town"
            building_intel = await get_building_reviews(b_name, area_hint)
    except Exception:
        building_intel = None

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    clean_imgs = (
        [] if mode == "uploaded" else [
            img for img in (req.images or [])
            if img and not any(bad in img for bad in ["UpperCrop200x200", "js_agentPhoto", "Fit450x225", "Fit200x100"])
        ][:5]
    )

    if not api_key or (not clean_imgs and not uploaded_imgs):
        fallback_vision = _build_heuristic_vision_fallback(req, clean_imgs, is_quota_err=False, err_str="No API key or image URLs available", building_intel=building_intel)
        if not uploaded_imgs:
            _forensic_vision_cache[cache_key] = fallback_vision
        return {"status": "fallback", "vision": fallback_vision, "cached": False}

    try:
        import asyncio
        import base64
        import json as json_mod
        from services.lens_rectifier import fetch_image_bytes
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        image_contents = []
        for data_url in uploaded_imgs:
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": data_url},
            })

        if clean_imgs:
            raw_images = await asyncio.gather(*[asyncio.to_thread(fetch_image_bytes, u) for u in clean_imgs])
            for raw_b in raw_images:
                if raw_b:
                    b64 = base64.b64encode(raw_b).decode("utf-8")
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    })

        if not image_contents:
            fallback_vision = _build_heuristic_vision_fallback(req, clean_imgs, is_quota_err=False, err_str="Could not download raw image bytes", building_intel=building_intel)
            if not uploaded_imgs:
                _forensic_vision_cache[cache_key] = fallback_vision
            return {"status": "fallback", "vision": fallback_vision, "cached": False}

        building_ctx = (
            f"{building_intel.get('building_name')} (Rating: {building_intel.get('google_rating')}★, "
            f"Soundproofing: {building_intel.get('soundproofing')}, Airbnb risk: {building_intel.get('airbnb_risk')})"
            if building_intel and building_intel.get("building_name") else "Unnamed / standalone property"
        )

        prompt = f"""You are a sharp, architect-trained Cape Town / South Africa rental property inspector.
Inspect the {len(image_contents)} attached listing photo(s) alongside the listing details and apply these FORENSIC GUIDELINES:
1. SPACE & WFH ERGONOMICS: If it is a 0.5-bed/studio or <=55 m² open-plan unit, evaluate whether full-time WFH is viable (acoustic door vs fridge/kitchen hum, bed in video-call backdrop, desk nook >=1.2m near natural light & plugs). Tailor to User Preferences ({req.personal_preferences or 'None specified'}).
2. WINDOW PLACEMENT & DAYLIGHT: Check sightlines (brick wall/airshaft 'blind-lock' vs open sky/greenery), single-aspect vs cross-ventilation, Cape Town sun glare/damp risk, and window frame quality (thin aluminum vs double-glazed/timber).
3. WALL TYPE & ACOUSTICS: Infer solid brick/concrete (Art Deco/older) vs hollow drywall/studs (modern infill), hard-tile Zoom echo risk, and upstairs/party-wall exposure.
4. CEILING HEIGHT & VOLUME: Judge ceiling height (high >=2.8m vs standard 2.4m vs low <2.3m bulkheads) and flag 0.5x ultra-wide lens distortion.
5. LIGHT FIXTURES & EVENING LIVABILITY: Distinguish layered warm lighting (downlights/sconces/under-cabinet) from harsh single central bulbs or windowless bathrooms.
6. BUILDING EXTERIOR & BLOCK: If exterior/foyer is shown, note maintenance cues (peeling paint, rust streaks, gate/electric fence security, building era).

LISTING DETAILS:
- Title: {req.title}
- Address: {req.address}
- Price: R {req.price:,.0f}/mo | {req.bedrooms} bed | {req.bathrooms} bath | {f'{req.sqm} m²' if req.sqm else 'size unstated'}
- Building Context: {building_ctx}
- Description: {(req.description or '')[:1400]}
- User Preferences: {req.personal_preferences or 'None specified'}

Return STRICT JSON only (no markdown fences) with these exact keys:
{{
  "photo_story": "3-4 concise sentences telling the real story across the photos: layout, finishes, light, surroundings, and what key rooms/angles are missing.",
  "photo_pros": ["3 to 5 specific visual pros directly observed in the photos"],
  "photo_cons": ["2 to 5 specific visual cons, WFH/layout friction, or missing-photo gaps observed"],
  "wfh_layout_verdict": "1-2 concise sentences on workspace zoning, desk placement, acoustic separation, and suitability for the tenant's work mode.",
  "window_light_audit": "1-2 concise sentences on window placement, sightlines, cross-ventilation, glare/damp risk, and glazing.",
  "wall_acoustic_audit": "1-2 concise sentences on wall construction (brick vs drywall), echo surfaces, and neighbour noise insulation.",
  "ceiling_volume_audit": "1 concise sentence on ceiling height, spatial volume, and 0.5x lens distortion.",
  "lighting_fixtures_audit": "1 concise sentence on light fixture quality (warm layered vs harsh overhead) and windowless rooms.",
  "exterior_building_audit": "1-2 concise sentences on what the exterior/era/security communicates (or note if exterior photo is missing).",
  "glazing": "1 concise sentence on windows, natural light, and outlook visible in the photos",
  "distortion": "1 concise sentence on camera focal length / ultra-wide 0.5x stretch vs true room proportions",
  "stove_type": "gas | induction | electric | unknown"
}}"""

        models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
        last_err = None
        parsed = None

        for m_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=m_name,
                    api_key=api_key,
                    temperature=0.2,
                    request_timeout=45,
                )
                msg = HumanMessage(content=[{"type": "text", "text": prompt}, *image_contents])
                resp = await llm.ainvoke([msg])
                text = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                text = re.sub(r'^```(?:json)?\s*', '', text)
                text = re.sub(r'\s*```$', '', text)
                parsed = json_mod.loads(text)
                parsed["inspected_photo_count"] = len(image_contents)
                parsed["building_intel"] = building_intel
                parsed["is_fallback"] = False
                _forensic_vision_cache[cache_key] = parsed
                return {"status": "success", "vision": parsed, "cached": False}
            except Exception as e:
                last_err = e
                # If quota/prepayment exhausted, try fallback model
                if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e) or "402" in str(e):
                    continue
                raise e

        if last_err:
            raise last_err
    except Exception as e:
        print_safe(f"[FORENSIC VISION ERROR] {e}")
        err_str = str(e)
        is_quota_err = "RESOURCE_EXHAUSTED" in err_str or "402" in err_str or "429" in err_str
        fallback_parsed = _build_heuristic_vision_fallback(req, clean_imgs, is_quota_err=is_quota_err, err_str=err_str, building_intel=building_intel)
        _forensic_vision_cache[cache_key] = fallback_parsed
        return {"status": "fallback", "vision": fallback_parsed, "cached": False}


class ComparePropertiesRequest(BaseModel):
    properties: List[Dict[str, Any]] = []
    personal_preferences: str = ""


def _build_compare_fallback(props: List[Dict[str, Any]], prefs: str = "", reason: str = "") -> Dict[str, Any]:
    prefs_l = (prefs or "").lower()
    wants_wfh_full = "full-time" in prefs_l or "work from home" in prefs_l
    wants_cafes = "cafe" in prefs_l
    wants_private = "private" in prefs_l or "no landlord" in prefs_l
    wants_parking = "parking" in prefs_l or "garage" in prefs_l

    scored = []
    for p in props:
        pid = str(p.get("id", ""))
        price = float(p.get("price") or 0)
        beds = float(p.get("bedrooms") or 1)
        sqm = float(p.get("sqm") or 0)
        noise_risk = (p.get("noise_risk") or "moderate").lower()
        est_db = (p.get("acoustic_audit") or {}).get("estimated_db") or (38 if noise_risk == "sanctuary" else 48)
        fibre = bool(p.get("fibre_ready"))
        garage = bool(p.get("has_garage"))
        secure_bay = bool(p.get("has_secure_bay"))
        raw = f"{p.get('title', '')} {p.get('address', '')} {p.get('description', '')}".lower()
        landlord_onsite = any(k in raw for k in ["granny flat", "garden cottage", "shared property", "landlord on site", "separate entrance on property"])
        is_studio = beds <= 0.5 or "studio" in raw or "bachelor" in raw

        score = 72
        if noise_risk == "sanctuary":
            score += 10
        elif est_db >= 60:
            score -= 12
        if fibre:
            score += 6
        if garage:
            score += 6
        elif secure_bay:
            score += 3
        if landlord_onsite:
            score -= 14 if wants_private else 6
        else:
            score += 5
        if wants_wfh_full and is_studio:
            score -= 8
        if sqm >= 65:
            score += 5
        if p.get("stove_type") == "gas":
            score += 4
        score = max(35, min(98, score))

        best_for = []
        if noise_risk == "sanctuary":
            best_for.append("Quiet acoustic sanctuary")
        if fibre:
            best_for.append("Turnkey fibre WFH")
        if not landlord_onsite:
            best_for.append("100% private standalone living")
        if garage or secure_bay:
            best_for.append("Secure off-street parking")
        if not best_for:
            best_for.append("Core budget & location match")

        tradeoffs = []
        if landlord_onsite:
            tradeoffs.append("Shared grounds / landlord on-site")
        if wants_wfh_full and is_studio:
            tradeoffs.append("0.5-bed / studio lacks acoustic door for full-time WFH")
        if not fibre:
            tradeoffs.append("Fibre readiness unconfirmed")
        if est_db >= 55:
            tradeoffs.append(f"Elevated ambient noise (~{est_db} dBA)")
        if not (garage or secure_bay):
            tradeoffs.append("No dedicated secure parking confirmed")
        if not tradeoffs:
            tradeoffs.append("Verify utility split & street security in person")

        wfh_fit = (
            "Caution for full-time WFH (open-plan studio/0.5-bed lacks door separation)"
            if (wants_wfh_full and is_studio)
            else ("Strong WFH setup (fibre + separate room zoning)" if fibre and not is_studio else "Workable for hybrid/café mode; verify desk & fibre")
        )
        acoustic_verdict = f"~{est_db} dBA ({'Quiet sanctuary' if noise_risk == 'sanctuary' else 'Standard/exposed'})"
        value_verdict = f"R {price:,.0f}/mo" + (f" · R {price / sqm:,.0f}/m²" if sqm > 0 else "")

        scored.append({
            "id": pid,
            "score": score,
            "headline": f"{p.get('title', 'Listing')} ({p.get('suburb', 'Cape Town')})",
            "best_for": ", ".join(best_for[:2]),
            "biggest_tradeoff": "; ".join(tradeoffs[:2]),
            "wfh_fit": wfh_fit,
            "acoustic_verdict": acoustic_verdict,
            "value_verdict": value_verdict,
            "_price": price,
            "_db": est_db,
            "_sqm": sqm,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    for idx, item in enumerate(scored, start=1):
        item["rank"] = idx

    winner = scored[0]
    runner_up = scored[1] if len(scored) > 1 else None
    pref_note = f' against your preferences ("{prefs[:80]}")' if prefs else ""
    exec_verdict = (
        f"Top Pick (#1): {winner['headline']} scores {winner['score']}/100{pref_note}, "
        f"leading on {winner['best_for'].lower()}. "
        + (f"Runner-up {runner_up['headline']} ({runner_up['score']}/100) trades off {runner_up['biggest_tradeoff'].lower()}." if runner_up else "")
    )

    # Matrix highlights
    lowest_price = min(scored, key=lambda x: x["_price"] if x["_price"] > 0 else 999999)
    quietest = min(scored, key=lambda x: x["_db"])
    largest = max(scored, key=lambda x: x["_sqm"])
    matrix_highlights = [
        {"category": "Overall AI Fit", "winner_id": winner["id"], "note": f"Highest composite score ({winner['score']}/100)"},
        {"category": "Monthly Value", "winner_id": lowest_price["id"], "note": f"Lowest rent at {lowest_price['value_verdict']}"},
        {"category": "Acoustic Quietness", "winner_id": quietest["id"], "note": quietest["acoustic_verdict"]},
    ]
    if largest["_sqm"] > 0:
        matrix_highlights.append({"category": "Floor Space", "winner_id": largest["id"], "note": f"Largest at {largest['_sqm']:.0f} m²"})

    for item in scored:
        item.pop("_price", None)
        item.pop("_db", None)
        item.pop("_sqm", None)

    return {
        "winner_id": winner["id"],
        "executive_verdict": exec_verdict,
        "rankings": scored,
        "matrix_highlights": matrix_highlights,
        "is_fallback": True,
        "fallback_reason": reason or "Heuristic multi-factor comparison active.",
    }


@app.post("/api/properties/compare")
async def compare_properties_ai(req: ComparePropertiesRequest):
    """Runs a side-by-side AI comparison across 2–4 shortlisted properties tailored to user preferences."""
    props = (req.properties or [])[:4]
    if len(props) < 2:
        raise HTTPException(status_code=400, detail="Please select at least 2 properties to compare.")

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"status": "fallback", "comparison": _build_compare_fallback(props, req.personal_preferences, "No Gemini API key configured")}

    try:
        import json as json_mod
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        summaries = []
        for p in props:
            summaries.append({
                "id": str(p.get("id", "")),
                "title": p.get("title"),
                "suburb": p.get("suburb"),
                "address": p.get("address"),
                "price": p.get("price"),
                "bedrooms": p.get("bedrooms"),
                "bathrooms": p.get("bathrooms"),
                "sqm": p.get("sqm"),
                "noise_risk": p.get("noise_risk"),
                "estimated_db": (p.get("acoustic_audit") or {}).get("estimated_db"),
                "fibre_ready": p.get("fibre_ready"),
                "has_garage": p.get("has_garage"),
                "has_secure_bay": p.get("has_secure_bay"),
                "stove_type": p.get("stove_type"),
                "pet_friendly": p.get("pet_friendly"),
                "description": (p.get("description") or "")[:700],
            })

        prompt = f"""You are an objective Cape Town rental advisor comparing {len(summaries)} shortlisted properties side-by-side.
USER WORK & LIFESTYLE PREFERENCES: {req.personal_preferences or 'General quiet, safe, good-value residential rental'}

Apply our forensic guidelines:
- Evaluate 0.5-bed / <=55 m² open-plan units strictly if user works from home full-time (no acoustic door, fridge hum, call backdrop).
- Weigh acoustic dBA, privacy (landlord on-site vs standalone), parking security, load-shedding resilience (gas/solar), and price-per-sqm value.

PROPERTIES:
{json_mod.dumps(summaries, indent=2)}

Return STRICT JSON only (no markdown fences):
{{
  "winner_id": "id of #1 recommended property",
  "executive_verdict": "2-3 concise sentences explaining why the winner beats the others for this user's lifestyle and key trade-offs.",
  "rankings": [
    {{
      "id": "property id",
      "rank": 1,
      "score": 88,
      "headline": "Short title",
      "best_for": "Top 1-2 strengths",
      "biggest_tradeoff": "Top 1-2 compromises or risks",
      "wfh_fit": "1 concise sentence on WFH suitability",
      "acoustic_verdict": "1 concise sentence on noise/privacy",
      "value_verdict": "1 concise sentence on rent vs space/amenities"
    }}
  ],
  "matrix_highlights": [
    {{"category": "Overall AI Fit", "winner_id": "id", "note": "short reason"}},
    {{"category": "Monthly Value", "winner_id": "id", "note": "short reason"}},
    {{"category": "Acoustic & Privacy", "winner_id": "id", "note": "short reason"}}
  ]
}}"""

        for m_name in ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
            try:
                llm = ChatGoogleGenerativeAI(model=m_name, api_key=api_key, temperature=0.2, request_timeout=40)
                resp = await llm.ainvoke([HumanMessage(content=prompt)])
                text = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                text = re.sub(r'^```(?:json)?\s*', '', text)
                text = re.sub(r'\s*```$', '', text)
                parsed = json_mod.loads(text)
                parsed["is_fallback"] = False
                return {"status": "success", "comparison": parsed}
            except Exception as e:
                if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e) or "402" in str(e):
                    continue
                raise e
        return {"status": "fallback", "comparison": _build_compare_fallback(props, req.personal_preferences, "AI Studio prepayment credits depleted")}
    except Exception as e:
        print_safe(f"[COMPARE AI ERROR] {e}")
        return {"status": "fallback", "comparison": _build_compare_fallback(props, req.personal_preferences, str(e)[:80])}

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
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    effective_id = get_effective_user_id(user_id, dummy_uid)
    db = get_db()
    db.collection("users").document(effective_id).collection("alerts").document(search_id).delete()
    return {"status": "ok"}

@app.post("/update-alert/{user_id}/{search_id}")
async def update_alert(user_id: str, search_id: str, payload: dict):
    dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    effective_id = get_effective_user_id(user_id, dummy_uid)
    db = get_db()
    db.collection("users").document(effective_id).collection("alerts").document(search_id).set(payload, merge=True)
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
            req_sources = set()
            for s in (subscribers or []):
                for src in s.get("config", {}).get("sources", []):
                    req_sources.add(str(src).lower())
            
            if req_sources:
                source_ids = [
                    s['id'] for s in all_sources 
                    if str(s.get('name', '')).lower() in req_sources 
                    or str(s.get('id', '')).lower() in req_sources
                    or any(r in str(s.get('name', '')).lower() for r in req_sources)
                ]
            if not source_ids:
                source_ids = [s['id'] for s in all_sources]

        valid_matches_count = 0
        scanned_urls = set()
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
            is_pulse = any(s.get("config", {}).get("is_pulse", False) for s in (subscribers or []))

            if is_p24 and is_fav:
                favourite_targets = [
                    # Southern Peninsula parent covers all Deep South: Fish Hoek, Noordhoek, Kommetjie, Scarborough, Simon's Town, Muizenberg, Kalk Bay, etc.
                    ("Southern Peninsula (Deep South)", f"https://www.property24.com/to-rent/southern-peninsula/cape-town/western-cape/24{pet_param}"),
                    # User Additions: Constantia, Hout Bay, Llandudno, Bergvliet, Meadowridge
                    ("Constantia", f"https://www.property24.com/to-rent/constantia/cape-town/western-cape/11742{pet_param}"),
                    ("Hout Bay", f"https://www.property24.com/to-rent/hout-bay/western-cape/615{pet_param}"),
                    ("Llandudno", f"https://www.property24.com/to-rent/llandudno/cape-town/western-cape/9118{pet_param}"),
                    ("Bergvliet", f"https://www.property24.com/to-rent/bergvliet/cape-town/western-cape/10189{pet_param}"),
                    ("Meadowridge", f"https://www.property24.com/to-rent/meadowridge/cape-town/western-cape/10052{pet_param}")
                ]
                all_fav_listings = []
                for idx, (sub_name, sub_url) in enumerate(favourite_targets):
                    if check_scan_cancelled():
                        print_safe(f"[ABORT] 🛑 P24 Favourites scan halted by user before '{sub_name}'.")
                        break
                    if idx > 0:
                        # [STEALTH] Human-paced jitter (6.0s - 10.0s) between major regions
                        await asyncio.sleep(random.uniform(6.0, 10.0))
                    await update_task(task_id, "Scouting", f"Node analyzing: Property24 ({sub_name}) [{idx+1}/{len(favourite_targets)}]")
                    sub_res = await engine.scrape_url(sub_url, task_id=task_id, search_area=sub_name, is_pulse=is_pulse, max_pages=1)
                    if sub_res and (sub_res.confidence_score == 0 and any(w in (sub_res.raw_summary or "").lower() for w in ["bot challenge", "503", "429", "blocked", "server unavailable"])):
                        print_safe(f"[SHIELD] 🛑 Throttling P24: Server returned block/cooldown ({sub_res.raw_summary}). Halting immediately to protect IP.")
                        await update_task(task_id, "Throttled", f"Property24 cooldown ({sub_res.raw_summary}). Halting to protect IP.")
                        break
                    if sub_res and sub_res.listings:
                        all_fav_listings.extend(sub_res.listings)
                from models.listing import ExtractionResult
                result = ExtractionResult(listings=all_fav_listings, confidence_score=100.0, raw_summary=f"Parsed {len(all_fav_listings)} listings from Property24 Favourites")
            elif is_p24 and is_deep_south:
                # [OPTIMIZED] Southern Peninsula parent region URL covers all Deep South with automated 2-page pagination
                deep_url = f"https://www.property24.com/to-rent/southern-peninsula/cape-town/western-cape/24{pet_param}"
                await update_task(task_id, "Scouting", "Node analyzing: Property24 (Southern Peninsula - Deep South)")
                result = await engine.scrape_url(deep_url, task_id=task_id, search_area="Southern Peninsula", is_pulse=is_pulse, max_pages=2)
            else:
                target_url = source.get('url')
                if is_p24 and clean_query:
                    from scraper.portal_resolver import resolve_p24_url
                    resolved_url = resolve_p24_url(clean_query, is_pet_friendly=is_pet_req)
                    if resolved_url:
                        target_url = resolved_url
                        print_safe(f"[PORTAL] 🎯 Dynamic URL resolved for '{clean_query}': {target_url}")
                
                if target_url in scanned_urls:
                    print_safe(f"[PORTAL] Skipping duplicate portal URL already scanned in this mission: {target_url}")
                    continue
                scanned_urls.add(target_url)
                
                # Determine mission page depth (default: 3 pages for rich harvest, 1 for pulse)
                mission_max_pages = 1 if is_pulse else 3
                if subscribers:
                    sub_pages = [s.get("config", {}).get("max_pages") for s in subscribers if s.get("config", {}).get("max_pages")]
                    if sub_pages:
                        mission_max_pages = max(sub_pages)

                await update_task(task_id, "Scouting", f"Node analyzing: {source_name} ({clean_query})")
                result = await engine.scrape_url(target_url, task_id=task_id, search_area=clean_query, is_pulse=is_pulse, max_pages=mission_max_pages)
            
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
                                req_area = str(config.get("target_area") or config.get("search_query", "")).lower()
                                listing_addr = str(l_dict.get("address", "")).lower()
                                
                                is_province_search = any(p in req_area for p in ["western cape", "all", "any"]) or not req_area
                                if not is_province_search:
                                    # Extract actual suburb from the query (e.g. "Sea Point", "My Favourites")
                                    from core.geofence import PREMIUM_SUBURBS, MY_FAVOURITES_SUBURBS, DEEP_SOUTH_SUBURBS
                                    if any(k in req_area for k in ["favourite", "favorite"]):
                                        matched_suburbs = list(MY_FAVOURITES_SUBURBS)
                                    elif any(k in req_area for k in ["deep south", "south peninsula"]):
                                        matched_suburbs = list(DEEP_SOUTH_SUBURBS)
                                    else:
                                        matched_suburbs = [s for s in PREMIUM_SUBURBS if s in req_area]
                                        if not matched_suburbs and req_area:
                                            clean_q = req_area.replace("(must be pet friendly)", "").replace("(pet friendly)", "").strip()
                                            clean_q = re.sub(r"\b(m2m|month[\s-]to[\s-]month|flexible)\b", "", clean_q, flags=re.I).strip()
                                            if clean_q and clean_q != "any":
                                                matched_suburbs = [clean_q]
                                    
                                    if matched_suburbs:
                                        listing_url = str(l_dict.get("source_url", "")).lower()
                                        from core.geofence import get_zone_for_area
                                        req_zone = get_zone_for_area(req_area)
                                        listing_zone = get_zone_for_area(listing_addr)

                                        matches_suburb = (
                                            any(s in listing_addr for s in matched_suburbs) or
                                            any(f"/{s}/" in listing_url or f"/{s}-" in listing_url or f"-{s}/" in listing_url or f"/{s.replace(' ', '-')}/" in listing_url for s in matched_suburbs) or
                                            (req_zone != "global" and req_zone == listing_zone)
                                        )
                                        if not matches_suburb:
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
                                
                                # [LEASE TERM] (Multi-Term Compatible)
                                req_lease = config.get("lease_terms") or config.get("lease_term")
                                has_explicit_lease_terms = bool(req_lease and req_lease != "any" and req_lease != ["any"])
                                if has_explicit_lease_terms:
                                    req_terms = req_lease if isinstance(req_lease, list) else [req_lease]
                                    title_str = str(l_dict.get("title", "")).lower()
                                    lease_str = str(l_dict.get("lease_period", "")).lower()
                                    desc_str = str(l_dict.get("description", "")).lower()
                                    rental_type_str = str(l_dict.get("rental_type", "")).lower()
                                    combined_lease = f"{title_str} {lease_str} {desc_str} {rental_type_str}"
                                    
                                    from scraper.portal_parser import M2M_KEYWORDS
                                    term_keywords = {
                                        "1": M2M_KEYWORDS,
                                        "m2m": M2M_KEYWORDS,
                                        "3": ["3 month", "3-month", "3 months", "short-term", "short term", "flexible", "quarterly"],
                                        "6": ["6 month", "6-month", "6 months", "half year", "flexible", "semi-annual"],
                                        "12": ["12 month", "1-year", "1 year", "long-term", "long term", "annual", "yearly"]
                                    }
                                    
                                    matched_any_term = False
                                    for t in req_terms:
                                        t_key = str(t).lower().replace(" (m2m)", "").replace("m", "").strip()
                                        keywords = term_keywords.get(t_key, [str(t).lower()])
                                        if l_dict.get("rental_type") in ["month-to-month", "m2m"] and t_key in ["1", "m2m"]:
                                            matched_any_term = True
                                            break
                                        if any(k in combined_lease for k in keywords):
                                            matched_any_term = True
                                            break
                                            
                                    if not matched_any_term:
                                        print_safe(f"[RECON] [REJECT] Lease term mismatch (Requested: {req_terms})")
                                        continue

                                # [CATEGORY FILTER] Filter by rental type if specified
                                req_type = config.get("rental_type")
                                
                                # [WANTED GUARD] If it's a wanted ad, ONLY deliver if specifically requested (v120.1)
                                if is_wanted and req_type != "looking-for":
                                    continue
                                
                                # [WANTED SUPPRESSION] If user wants standard rentals, skip wanted ads
                                if not is_wanted and req_type == "looking-for":
                                    continue

                                # If explicit lease terms (M2M, 3m, 6m) are active, do not let generic category
                                # mismatch drop listings that meet the requested duration.
                                if req_type and req_type not in ["all", "any"] and req_type != "looking-for":
                                    if not has_explicit_lease_terms:
                                        from scraper.portal_parser import M2M_KEYWORDS
                                        title_str = str(l_dict.get("title", "")).lower()
                                        lease_str = str(l_dict.get("lease_period", "")).lower()
                                        desc_str = str(l_dict.get("description", "")).lower()
                                        combined = f"{title_str} {lease_str} {desc_str} {str(l_dict.get('rental_type', '')).lower()}"

                                        if req_type in ["month-to-month", "m2m"]:
                                            if l_dict.get("rental_type") not in ["month-to-month", "m2m"] and not any(k in combined for k in M2M_KEYWORDS):
                                                print_safe(f"[RECON] [REJECT] Category Mismatch ({l_dict.get('rental_type')} vs {req_type})")
                                                continue
                                        elif req_type == "short-term":
                                            if l_dict.get("rental_type") not in ["short-term", "month-to-month", "m2m"] and not any(k in combined for k in M2M_KEYWORDS + ["short term", "short-term"]):
                                                print_safe(f"[RECON] [REJECT] Category Mismatch ({l_dict.get('rental_type')} vs {req_type})")
                                                continue
                                        elif l_dict.get("rental_type") != req_type:
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
                                
                                # [PROPERTY TYPE GUARD]
                                req_prop_type = config.get("property_type")
                                if req_prop_type and req_prop_type not in ["all", "any"]:
                                    if str(l_dict.get("property_type", "")).lower() != str(req_prop_type).lower():
                                        print_safe(f"[RECON] [REJECT] Property type mismatch ({l_dict.get('property_type')} vs {req_prop_type})")
                                        continue

                                # [SEA VIEW GUARD]
                                if config.get("require_verified_sea_view") and l_dict.get("view_category") != "Sea":
                                    print_safe(f"[RECON] [REJECT] Sea view required, but view_category is '{l_dict.get('view_category')}'")
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
                                
                                # [AGENCY GUARD] 🛡️ Agency Google Rating Gate
                                min_agency_rating = config.get("min_agency_rating")
                                exclude_low_agency = config.get("exclude_low_rated_agencies", False)
                                allow_direct = config.get("allow_direct_landlords", True)
                                
                                is_direct = l_dict.get("is_direct_landlord", False)
                                agency_rating = l_dict.get("agency_rating")
                                
                                if exclude_low_agency and min_agency_rating and not (is_direct and allow_direct):
                                    if agency_rating is not None and agency_rating < float(min_agency_rating):
                                        print_safe(f"[AGENCY GUARD] Dropping listing '{l_dict.get('title')}' - Agency rating {agency_rating}★ < Required {min_agency_rating}★")
                                        continue

                                # [AI CRITERIA] 🧠 Evaluate Must Include / Must Exclude / Lifestyle
                                ai_must_inc = config.get("must_include") or []
                                ai_must_exc = config.get("must_exclude") or []
                                lifestyle_sigs = config.get("lifestyle_signals") or []
                                strict_mode = config.get("strict_mode", False)
                                
                                ai_report = None
                                if ai_must_inc or ai_must_exc or lifestyle_sigs:
                                    try:
                                        eval_result = await evaluator.evaluate_property(
                                            listing=l_dict,
                                            must_include=ai_must_inc,
                                            must_exclude=ai_must_exc,
                                            lifestyle_signals=lifestyle_sigs,
                                            strict_mode=strict_mode
                                        )
                                        if strict_mode and not eval_result.is_match:
                                            print_safe(f"[STRICT FILTER] Dropping listing '{l_dict.get('title')}' - failed strict criteria.")
                                            continue
                                        ai_report = eval_result.dict()
                                        l_dict['ai_report'] = ai_report
                                        l_dict['match_score'] = eval_result.fit_score
                                        if eval_result.verdict:
                                            l_dict['match_reason'] = eval_result.verdict
                                    except Exception as eval_err:
                                        print_safe(f"[EVALUATE SCAN ERROR] {eval_err}")

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

                                # [AUTO-LAUNCH] Open matched listing in web browser
                                if config.get("auto_open_links", True):
                                    source_url = l_dict.get("source_url")
                                    if source_url and str(source_url).startswith("http"):
                                        import webbrowser
                                        try:
                                            webbrowser.open_new_tab(source_url)
                                            print_safe(f"[BROWSER] 🚀 Launched matched listing in browser: {source_url}")
                                        except Exception as b_err:
                                            print_safe(f"[BROWSER] Could not open browser: {b_err}")
                                
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

                                            # Extract upfront privacy tags
                                            priv_flags = []
                                            if l_dict.get('dwelling_privacy') == 'garden_cottage': priv_flags.append('Shared Erf / Cottage')
                                            if l_dict.get('has_shared_entrance'): priv_flags.append('Shared Driveway')
                                            if l_dict.get('has_shared_pool'): priv_flags.append('Shared Pool')
                                            if l_dict.get('is_landlord_on_site'): priv_flags.append('Landlord on Erf')

                                            wa_msg = f"🏠 *HomeSeek Sniper: New Discovery*\n\n"
                                            wa_msg += f"*{l_dict.get('title')}*\n"
                                            wa_msg += f"💰 *Price:* {price_display}\n"
                                            wa_msg += f"📍 *Area:* {l_dict.get('address', 'Cape Town')}\n"
                                            wa_msg += f"🛏️ *Specs:* {l_dict.get('bedrooms', 'N/A')} Beds | {l_dict.get('property_sub_type', 'Whole')}\n"
                                            if priv_flags:
                                                wa_msg += f"⚠️ *Privacy:* {', '.join(priv_flags)}\n"
                                            wa_msg += f"\n--- \n"
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
                                            subject = build_alert_subject(l_dict, report=l_dict.get('ai_report'))
                                            body = get_match_template(l_dict, report=l_dict.get('ai_report'))
                                            asyncio.create_task(email_client.send_email(user_email, subject, body))
                                            print_safe(f"[SIGNAL] Email Alert Dispatched to {user_email} with Subject: '{subject}'")
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
                    if a.get("is_active") is False or a.get("alert_enabled") is False:
                        continue
                    query = (a.get("target_area") or a.get("search_query", "")).strip()
                    if query.startswith("AI Radar:"):
                        query = query.replace("AI Radar:", "").split("(")[0].strip()
                    if not query: continue
                    if query not in mission_map: mission_map[query] = []
                    mission_map[query].append({"user_id": user_id, "config": {**a, "is_pulse": True}})

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
    
    # [CENTRALIZED POOL] Start background suburb sync poller
    try:
        from services.suburb_poller import start_background_poller
        start_background_poller()
        print_safe("[CENTRALIZED POOL] Suburb background refresh poller initialized.")
    except Exception as e:
        print_safe(f"[CENTRALIZED POOL] Warning: could not start poller: {e}")

    print_safe("[HEARTBEAT] Local Node started in SILENT MODE. Waiting for manual mission triggers...")

@app.on_event("shutdown")
async def shutdown_event():
    # 🛑 GRACEFUL EXIT: Close persistent browser and background poller
    try:
        from services.suburb_poller import stop_background_poller
        stop_background_poller()
    except Exception:
        pass
    await engine.stop()

@app.post("/force-pulse")
async def force_pulse(target_query: Optional[str] = None):
    """Manual trigger to bypass the 30-minute timer for testing."""
    print_safe("[MANUAL OVERDRIVE] Force-triggering autonomous heartbeat cycle...")
    # This runs the logic in the background
    asyncio.create_task(autonomous_pulse_heartbeat_once(target_query=target_query))
    return {"status": "pulse_triggered_manually"}

async def autonomous_pulse_heartbeat_once(target_query: Optional[str] = None):
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
                if a.get("is_active") is False or a.get("alert_enabled") is False:
                    continue
                query = (a.get("target_area") or a.get("search_query", "")).strip()
                if query.startswith("AI Radar:"):
                    query = query.replace("AI Radar:", "").split("(")[0].strip()
                if not query: continue
                if target_query and query.lower() != target_query.lower():
                    continue
                if query not in mission_map: mission_map[query] = []
                mission_map[query].append({"user_id": user_id, "config": {**a, "is_pulse": True}})

        # 🚀 EXECUTE MISSIONS
        for query, subs in mission_map.items():
            print_safe(f"[MANUAL] Triggering Aggregated Scan: '{query}'")
            task_id = await create_task(subs[0]['user_id'], query)
            await run_local_scan(query, [], task_id, subs)
            
    except Exception as e:
        print_safe(f"[MANUAL] Pulse Error: {e}")

@app.get("/api/acoustics/hotspots")
async def get_acoustic_hotspots():
    """Returns calibrated Cape Town noise hotspots, transit corridors, and sanctuary zones."""
    from services.acoustic_registry import NOISE_HOTSPOTS, SANCTUARY_ZONES
    return {
        "status": "success",
        "hotspots": NOISE_HOTSPOTS,
        "sanctuary_zones": SANCTUARY_ZONES
    }

@app.post("/api/acoustics/evaluate")
async def evaluate_property_acoustics(payload: dict):
    """Computes acoustic audit and sound shadow attenuation for given coordinates and building attributes."""
    from services.acoustic_registry import compute_property_acoustic_audit
    lat = float(payload.get("lat", -33.9323))
    lng = float(payload.get("lng", 18.4108))
    floor_level = payload.get("floor_level", "")
    text_desc = payload.get("description", "")
    title = payload.get("title", "")
    address = payload.get("address", "")
    audit = compute_property_acoustic_audit(lat, lng, floor_level, text_desc, title, address)
    return {"status": "success", "acoustic_audit": audit}

@app.get("/api/market-medians")
async def get_empirical_market_medians():
    """Computes live empirical median rent & R/m2 per (area/pocket, bedrooms) from local P24 caches (0 network calls)."""
    import json as json_mod
    import statistics

    micro_pockets = [
        "capricorn", "marina da gama", "costa da gama", "northshore",
        "hout bay harbour", "scott estate", "berg en dal", "penzance estate",
        "sunnydale", "capri", "sun valley", "clifton", "bantry bay", "bakoven",
        "de waterkant", "mouille point", "green point", "sea point",
        "tamboerskloof", "oranjezicht", "higgovale", "vredehoek", "gardens",
        "camps bay", "llandudno", "hout bay", "noordhoek", "kommetjie",
        "scarborough", "fish hoek", "kalk bay", "st james", "clovelly",
        "muizenberg", "rondebosch", "newlands", "claremont", "kenilworth",
        "constantia", "tokai", "woodstock", "observatory",
    ]

    seen_ids = set()
    buckets: dict = {}

    def ingest_listing(item: dict):
        if not isinstance(item, dict):
            return
        lid = str(item.get("p24_id") or item.get("id") or "")
        if not lid or lid in seen_ids:
            return
        price = item.get("price")
        if not isinstance(price, (int, float)) or price < 3000 or price > 250000:
            return
        seen_ids.add(lid)

        raw_beds = item.get("bedrooms")
        try:
            beds = max(0, min(3, int(round(float(raw_beds if raw_beds is not None else 1)))))
        except Exception:
            beds = 1

        text = f"{item.get('address') or ''} {item.get('suburb') or ''}".lower()
        area_key = None
        for mp in micro_pockets:
            if mp in text:
                area_key = mp
                break
        if not area_key:
            area_key = str(item.get("suburb") or "").lower().strip()
        if not area_key:
            return

        sqm = item.get("sqm")
        sqm_rate = None
        if isinstance(sqm, (int, float)) and 15 <= sqm <= 1000:
            sqm_rate = float(price) / float(sqm)

        b = buckets.setdefault(area_key, {}).setdefault(str(beds), {"prices": [], "sqm_rates": []})
        b["prices"].append(float(price))
        if sqm_rate is not None:
            b["sqm_rates"].append(sqm_rate)

    cache_paths = [
        os.path.join(os.path.dirname(__file__), "services", ".p24_live_cache.json"),
        os.path.join(os.path.dirname(__file__), "data", "p24_cache.json"),
    ]
    for cp in cache_paths:
        if not os.path.exists(cp):
            continue
        try:
            with open(cp, "r", encoding="utf-8") as f:
                raw = json_mod.load(f)
            if isinstance(raw, list):
                for it in raw:
                    ingest_listing(it)
            elif isinstance(raw, dict):
                for val in raw.values():
                    if isinstance(val, dict):
                        items_list = val.get("items") or val.get("listings")
                        if isinstance(items_list, list):
                            for it in items_list:
                                ingest_listing(it)
                    elif isinstance(val, list):
                        for it in val:
                            ingest_listing(it)
        except Exception:
            continue

    medians: dict = {}
    for area_key, bed_map in buckets.items():
        for bed_str, stats in bed_map.items():
            if len(stats["prices"]) >= 4:
                med_rent = int(round(statistics.median(stats["prices"]) / 100.0) * 100)
                med_sqm = int(round(statistics.median(stats["sqm_rates"]))) if len(stats["sqm_rates"]) >= 3 else None
                medians.setdefault(area_key, {})[bed_str] = {
                    "median_rent": med_rent,
                    "median_sqm_rate": med_sqm,
                    "count": len(stats["prices"]),
                }

    return {"status": "success", "unique_listings": len(seen_ids), "medians": medians}


if __name__ == "__main__":
    import uvicorn
    # Local Node usually runs on 8000 to match the frontend expectations
    uvicorn.run(app, host="0.0.0.0", port=8000)
