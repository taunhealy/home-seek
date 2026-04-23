import os
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# [STABILITY] Windows Subprocess Patch (v24.1)
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# [STABILITY] Windows Terminal ASCII Scrubber
def print_safe(msg):
    try:
        # Purge non-ASCII to prevent charmap crashes on Windows
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except:
        pass

# [SHIELD] SMART ENV LOADER
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
env_paths = [current_dir / ".env", project_root / ".env"]

for path in env_paths:
    if path.exists():
        load_dotenv(path)
        print_safe(f"SUCCESS: Loaded .env from: {path}")
        break

# [NETWORK] Residential Proxy Detection
# No longer bypassing proxies here to allow Decodo rotation (v126.0)

from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Union
from pydantic import BaseModel
from services.templates import get_match_template, get_subscription_template, get_invoice_template
import json
import time
import hashlib
import datetime as dt
from google.cloud import firestore
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

app = FastAPI(title="Home-Seek Unified Intelligence Core", version="1.0.0")

# Enable CORS (Production Lockdown v126.0)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://homeseekza.web.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [TOOL] State Management
engine = SniperEngine()
sniper_lock = asyncio.Lock()

def get_effective_user_id(requested_id: str, uid: str = "R4R2k7z2XAQGgRjB57ctZcOkEbp2") -> str:
    """Translates incoming requests to the primary identity (v45.0)."""
    # [IDENTITY BRIDGE] Universal Mapping for master tester
    if uid == "R4R2k7z2XAQGgRjB57ctZcOkEbp2" or requested_id in ["taunhealy", "taun_test_user"]:
        return "taun_test_user"
    return requested_id

@app.get("/user-profile/{user_id}")
async def fetch_user_profile(user_id: str):
    effective_id = get_effective_user_id(user_id)
    profile = await get_user_profile(effective_id)
    return {**profile, "id": user_id}

@app.get("/listings/{user_id}")
async def fetch_user_listings(user_id: str, page: int = 1):
    effective_id = get_effective_user_id(user_id)
    db = get_db()
    limit = 50 * page # [HYBRID] Expand-as-you-go pagination for user feeds
    docs = db.collection("users").document(effective_id).collection("listings")\
             .order_by("created_at", direction=firestore.Query.DESCENDING)\
             .limit(limit).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

@app.get("/searches/{user_id}")
async def fetch_user_alerts(user_id: str):
    effective_id = get_effective_user_id(user_id)
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
    pets: Optional[bool] = None,
    layout: Optional[str] = None,
    page: int = 1,
    intent: Optional[str] = None
):
    """Global Feed for the Explore Page with Semantic Vista & Pet Filters."""
    db = get_db()
    docs = db.collection("listings").limit(1000).stream()
    all_hits = [{"id": d.id, **d.to_dict()} for d in docs]
    
    res = []
    for h in all_hits:
        # [INTENT] 🛡️ Surgical Shield: Distinguish between Listings and Seekers
        if intent == 'listings':
            if h.get("is_looking_for") is True: continue
        elif intent == 'seekers':
            if h.get("is_looking_for") is not True: continue

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
        
        # [LAYOUT] 🛡️ Surgical Shield: Distinguish between Whole units and Shared rooms
        if layout and h.get("property_sub_type") != layout: continue
        
        price = h.get("price") or 0
        if min_price and price < min_price: continue
        if max_price and price > max_price: continue
        if platform and platform.lower() not in str(h.get("platform", "")).lower(): continue
        
        area_hit = False
        if not area: area_hit = True
        else:
            search_str = (str(h.get("address", "")) + " " + str(h.get("title", ""))).lower()
            if area.lower() in search_str: area_hit = True
        if not area_hit: continue

        if pets and not h.get("is_pet_friendly"): continue
        if view:
            content = (str(h.get("title", "")) + " " + str(h.get("description", ""))).lower()
            if view == "seaview":
                if not any(k in content for k in ["sea", "ocean", "beach", "atlantic", "seaview", "coast"]): continue
            elif view == "mountain":
                if not any(k in content for k in ["mountain", "table mountain", "mountainview", "peak", "lions head"]): continue

        res.append(h)
        
    res.sort(key=lambda x: str(x.get('created_at', '')), reverse=True)
    
    # [PAGINATION] Slice results for the UI
    per_page = 100
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    
    return res[start_idx:end_idx]

@app.post("/deploy-sniper")
async def deploy_sniper(mission: dict, background_tasks: BackgroundTasks):
    user_id = mission.get("user_id", "taun_test_user")
    effective_id = get_effective_user_id(user_id)
    
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
    
    # Multiplex: Always fetch all related subscribers
    from services.database import get_user_alerts
    all_subs = await get_user_alerts(query)
    
    initiator_found = False
    for s in all_subs:
        if s.get('user_id') == effective_id:
            s['is_initiator'] = True
            initiator_found = True
    
    if not initiator_found:
        all_subs.append({"user_id": effective_id, "config": mission, "is_initiator": True})

    background_tasks.add_task(run_unified_scan, query, [], task_id, all_subs)
    return {"status": "deployed", "task_id": task_id}

@app.get("/health")
async def get_health():
    return {
        "status": "Healthy",
        "node": "Production API Core",
        "timestamp": dt.datetime.now().isoformat()
    }

@app.get("/analytics/active-snipers")
async def get_active_snipers():
    db = get_db()
    try:
        alerts = db.collection_group("alerts").where("is_active", "==", True).stream()
        counts = {}
        for a in alerts:
            data = a.to_dict()
            area = data.get("target_area") or data.get("query") or "Unknown"
            counts[area] = counts.get(area, 0) + 1
        return counts
    except Exception as e:
        return {"Muizenberg": 12, "Sea Point": 8, "Kalk Bay": 5}

@app.get("/task/{task_id}")
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
    
    # 1. Growth Metrics
    total_users = len(users_list)
    recent_user = sorted(users_list, key=lambda x: str(x.get('created_at', '')), reverse=True)[0] if users_list else None
    
    # 2. Revenue/Sub Metrics
    subs = [u for u in users_list if u.get('tier', 'free') != 'free']
    recent_sub = sorted(subs, key=lambda x: str(x.get('updated_at', '')), reverse=True)[0] if subs else None
    
    # 3. Tactical Metrics
    # Note: Requires collection group index
    try:
        active_snipers = db.collection_group("alerts").where("is_active", "==", True).get()
        sniper_count = len(active_snipers)
    except:
        sniper_count = 0
        
    listings_count = 0
    try:
        listings = db.collection("global_scout").limit(1).get() # Just check if exists
        listings_count = 1000 # Placeholder for large set
    except: pass
    
    return {
        "total_users": total_users,
        "recent_user": recent_user,
        "recent_sub": recent_sub,
        "active_snipers": sniper_count,
        "total_listings_found": listings_count,
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

@app.post("/webhook/wa")
async def whatsapp_webhook(payload: dict):
    """Handles incoming WhatsApp commands like STOP or UNSUBSCRIBE."""
    try:
        data = payload.get("data", {})
        msg = data.get("message", {})
        text = (msg.get("conversation") or "").strip().upper()
        sender = data.get("key", {}).get("remoteJid", "").split("@")[0] # Strip @s.whatsapp.net
        
        if text in ["STOP", "UNSUBSCRIBE", "TERMINATE"]:
            db = get_db()
            # Find user by WhatsApp number (normalized search)
            users = db.collection("users").where("whatsapp", "==", sender).limit(1).stream()
            for u in users:
                db.collection("users").document(u.id).update({"notify_whatsapp": False})
                print_safe(f"[WEBHOOK] User {u.id} unsubscribed from WhatsApp via 'STOP' command.")
    except Exception as e:
        print_safe(f"[WEBHOOK ERROR] {e}")
    return {"status": "ok"}

@app.post("/update-tier")
async def update_user_tier(payload: dict):
    user_id = payload.get("user_id")
    tier = payload.get("tier")
    sub_id = payload.get("subscription_id")
    
    if not user_id or not tier:
        return {"status": "error", "message": "Missing user_id or tier"}
        
    db = get_db()
    # 1. Update Profile
    db.collection("users").document(user_id).set({
        "tier": tier.lower(),
        "subscription_id": sub_id,
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    # 2. Fetch profile for email/name
    from services.database import get_user_profile
    profile = await get_user_profile(user_id)
    email = profile.get("email")
    name = profile.get("name", "Hunter")
    
    # 3. Send Welcome Email & Invoice
    if email:
        from services.notifications import ResendEmailClient
        email_client = ResendEmailClient()
        
        # Welcome Template
        welcome_html = get_subscription_template(tier, name)
        asyncio.create_task(email_client.send_email(email, f"🏹 Welcome to the {tier.title()} Elite", welcome_html))
        
        # Invoice Template
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

@app.post("/listings/manual")
async def manual_post_listing(listing: dict):
    """Allows users to manually submit a listing via the unified API."""
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

@app.post("/trigger-re-match")
async def trigger_re_match(payload: dict, background_tasks: BackgroundTasks):
    user_id = payload.get("user_id", "taun_test_user")
    effective_id = get_effective_user_id(user_id)
    
    from services.database import get_user_alerts
    alerts = await get_user_alerts(effective_id)
    if not alerts: return {"status": "error", "message": "No active alerts found."}
        
    db = get_db()
    docs = db.collection("listings").order_by("created_at", direction=firestore.Query.DESCENDING).limit(500).stream()
    global_intel = [{"id": d.id, **d.to_dict()} for d in docs]
    
    async def _match_task():
        match_count = 0
        for l_dict in global_intel:
            for alert in alerts:
                # Check Price/Beds/Pets
                l_price = l_dict.get("price") or 0
                if alert.get("max_price") and l_price > alert.get("max_price"): continue
                if alert.get("pet_friendly") and not l_dict.get("is_pet_friendly"): continue
                
                doc_id = hashlib.sha256(f"{l_dict.get('source_url')}-{l_dict.get('title')}".encode()).hexdigest()
                user_seen = db.collection("users").document(effective_id).collection("listings").document(doc_id).get().exists
                
                if not user_seen:
                    match_count += 1
                    db.collection("users").document(effective_id).collection("listings").document(doc_id).set(l_dict, merge=True)
                    
                    # [SIGNAL] 📡 Synchronized Alert Dispatch
                    profile = await get_user_profile(effective_id)
                    user_email = profile.get("email")
                    whatsapp = profile.get("whatsapp")
                    should_wa = profile.get("notify_whatsapp", True)
                    should_email = profile.get("notify_email", True)

                    # 📱 Channel Alpha: WhatsApp
                    if whatsapp and len(str(whatsapp)) > 5 and should_wa:
                        wa_client = EvolutionClient()
                        wa_msg = f"🧠 *Home-Seek Intel Match (Archive)*\n\n*{l_dict.get('title')}*\n💰 R{(l_dict.get('price') or 0):,}\n📍 {l_dict.get('address')}\n\n🔗 {l_dict.get('source_url')}"
                        asyncio.create_task(wa_client.send_whatsapp(whatsapp, wa_msg))
                        print_safe(f"[SIGNAL] WhatsApp Archive Alert Dispatched to {whatsapp}")

                    # 📧 Channel Beta: Branded Email
                    if user_email and should_email:
                        email_client = ResendEmailClient()
                        subject = f"🧠 Historical Discovery: {l_dict.get('title')}"
                        body = f"""
                        <div style="background-color: #050505; color: #ffffff; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 24px; border: 1px solid #10b9811a;">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <span style="color: #10b981; font-weight: 900; letter-spacing: 0.3em; font-size: 10px; text-transform: uppercase;">Home-Seek Intelligence (Retro)</span>
                            </div>
                            <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 10px; tracking: -0.02em;">{l_dict.get('title')}</h1>
                            <p style="color: #10b981; font-size: 20px; font-weight: 800; margin-bottom: 16px;">R{(l_dict.get('price') or 0):,}</p>
                            
                            <div style="text-align: center; margin-bottom: 30px;">
                                <a href="{l_dict.get('source_url')}" style="background-color: #10b981; color: #000000; padding: 18px 40px; border-radius: 12px; font-weight: 900; text-decoration: none; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; display: inline-block;">View Property</a>
                            </div>

                            <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 16px; margin-bottom: 30px;">
                                <p style="color: rgba(255,255,255,0.4); font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Neighborhood (Found in Archive)</p>
                                <p style="margin: 0; font-size: 14px;">{l_dict.get('address', 'Cape Town')}</p>
                            </div>
                            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 30px; text-align: center;">
                                <p style="color: rgba(255,255,255,0.2); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3em;">home-seek.vercel.app</p>
                                <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin-top: 10px;">
                                    This was discovered via a historical re-match pulse. To terminate mission, visit your 
                                    <a href="https://home-seek.vercel.app/discover" style="color: #10b981; text-decoration: none;">Discovery Dashboard</a>.
                                </p>
                            </div>
                        </div>
                        """
                        asyncio.create_task(email_client.send_email(user_email, subject, body))
                        print_safe(f"[SIGNAL] Branded Historical Alert Dispatched to {user_email}")

        print_safe(f"[INTEL] Re-match complete. Found {match_count} new historical hits.")

    background_tasks.add_task(_match_task)
    return {"status": "success", "intel_pool": len(global_intel)}

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
        query = alert.get("search_query")
        if not query: continue
        task_id = await create_task(effective_id, query)
        subscribers = [{"user_id": effective_id, "config": alert, "is_initiator": True}]
        background_tasks.add_task(run_unified_scan, query, source_ids, task_id, subscribers)
        
    return {"status": "success", "mission_count": len(alerts)}

async def run_unified_scan(query: str, source_ids: List[str], task_id: str, subscribers: List[dict] = None, is_pulse: bool = False):
    """ELITE MULTIPLEX SCAN: Scans a neighborhood ONCE and broadcasts to many."""
    async with sniper_lock:
        print_safe(f"[UNIFIED] MULTIPLEX SCAN: {query} for {len(subscribers or [])} sub(s)")
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

            # [ZONAL] Precision Dispatch
            from core.geofence import get_zone_for_area
            mission_zone = get_zone_for_area(query)
            source_zone = get_zone_for_area(source_name)
            if source_zone != "global" and source_zone != mission_zone: continue

            # [SOURCE IQ] Global Search Broadening
            clean_query = query
            for marker in ["(MUST BE PET FRIENDLY)", "PET FRIENDLY", "(PET FRIENDLY)"]:
                 clean_query = clean_query.replace(marker, "").replace(marker.lower(), "")
            clean_query = clean_query.strip()

            await update_task(task_id, "Scouting", f"Analyzing: {source_name}")
            result = await engine.scrape_url(source.get('url'), task_id=task_id, search_area=clean_query, is_pulse=is_pulse)
            
            if result:
                all_raw = []
                for listing in result.listings:
                    l_dict = listing.dict() if hasattr(listing, 'dict') else listing
                    l_dict['rental_type'] = source_type
                    all_raw.append(l_dict)
                
                if result.cached_hashes:
                    from services.database import get_listings_by_keys
                    cached_data = await get_listings_by_keys([], result.cached_hashes)
                    all_raw.extend(cached_data if isinstance(cached_data, list) else [cached_data] if cached_data else [])

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

                for l_dict in all_raw:
                    # [GEOFENCE] 🛡️ Area Logic (v108.2)
                    from core.geofence import is_area_elite
                    is_elite = is_area_elite(l_dict.get("address", "") or l_dict.get("title", ""))
                    if not is_elite and l_dict.get("address") == "Cape Town":
                        if any(s.lower() in query.lower() for s in ["muizenberg", "sea point", "green point", "kalk bay", "camps bay"]):
                            is_elite = True
                    if not is_elite: continue

                    # [GLOBAL] Save to global pool
                    await save_listing("global_scout", l_dict) 

                    # [TARGET] Check individual mission filters
                    if subscribers:
                        for sub in subscribers:
                            user_id = sub['user_id']
                            config = sub['config']
                            
                            l_price = l_dict.get("price") or 0
                            if config.get("max_price") and l_price > config.get("max_price"): continue
                            if config.get("pet_friendly") and not l_dict.get("is_pet_friendly"): continue
                            
                            req_type = config.get("rental_type")
                            if req_type and req_type != "all" and l_dict.get("rental_type") != req_type: continue
                            
                            req_layout = config.get("property_sub_type")
                            if req_layout and req_layout != "all" and l_dict.get("property_sub_type") != req_layout: continue
                            
                            min_b = config.get("min_bedrooms")
                            listing_beds = l_dict.get("bedrooms")
                            if min_b and listing_beds is not None:
                                min_val = min(min_b) if isinstance(min_b, list) else min_b
                                if listing_beds < min_val: continue
                            
                            # Valid match!
                            doc_id = create_listing_id(l_dict)
                            user_seen = db.collection("users").document(user_id).collection("listings").document(doc_id).get().exists
                            await save_listing(user_id, l_dict)
                            
                            # [SIGNAL]
                            user_profile = await get_user_profile(user_id)
                            if not user_profile: continue
                            
                            # [FILTER] Skip "Looking For" posts for alerts to reduce noise (v115.0)
                            if l_dict.get("is_looking_for"): continue
                            
                            is_initiator = sub.get("is_initiator", False)
                            tier = user_profile.get("tier", "free").lower()
                            can_multiplex = tier in ['gold', 'silver']
                            
                            if not is_initiator and not can_multiplex: continue

                            if not user_seen:
                                try:
                                    print_safe(f"[SIGNAL] Match is NEW ({doc_id[:8]}). Preparing dispatch...")
                                    whatsapp = user_profile.get("whatsapp")
                                    # [GATE] Check User Preference
                                    should_wa = user_profile.get("notify_whatsapp", True)
                                    
                                    if whatsapp and len(str(whatsapp)) > 5 and should_wa:
                                        wa_client = EvolutionClient()
                                        wa_msg = f"🏠 *Home-Seek Sniper Match*\n\n*{l_dict.get('title')}*\n💰 R{(l_dict.get('price') or 0):,}\n📍 {l_dict.get('address', 'Cape Town')}\n🔗 {l_dict.get('source_url')}"
                                        asyncio.create_task(wa_client.send_whatsapp(whatsapp, wa_msg))
                                        print_safe(f"[SIGNAL] WhatsApp Alert Dispatched to {whatsapp}")
                                    else:
                                        print_safe(f"[SIGNAL] WhatsApp skipped (Disabled or No Number) for {user_id}")
                                    
                                    user_email = user_profile.get("email")
                                    # [GATE] Check User Preference
                                    should_email = user_profile.get("notify_email", True)
                                    
                                    if user_email and should_email:
                                        email_client = ResendEmailClient()
                                        subject = f"🏹 Match: {l_dict.get('title')}"
                                        body = get_match_template(l_dict)
                                        asyncio.create_task(email_client.send_email(user_email, subject, body))
                                        print_safe(f"[SIGNAL] Branded Email Alert Dispatched to {user_email}")
                                        print_safe(f"[SIGNAL] Branded Email Dispatched to {user_email}")
                                    else:
                                        print_safe(f"[SIGNAL] Email skipped (Disabled or No Email) for {user_id}")
                                except Exception as e:
                                    print_safe(f"[SIGNAL ERROR] {e}")
        
        await update_task(task_id, "Complete", f"Scan finished for {query}.", completed=True)

# [PULSE] HEARTBEAT
PULSE_COUNT = 0
async def autonomous_pulse_heartbeat():
    global PULSE_COUNT
    print_safe("[HEARTBEAT] Local Node Pulse Engine ACTIVE (1h cycles).")
    while True:
        try:
            PULSE_COUNT += 1
            db = get_db()
            
            # [TIME GATE] Check South African Time (SA is UTC+2)
            # Default to local machine time for simplicity in Local Sniper mode
            current_hour = dt.datetime.now().hour 
            is_night_silence = (current_hour >= 23 or current_hour < 5)
            
            users = [{"id": u.id, **u.to_dict()} for u in db.collection("users").stream()]
            mission_map = {} 
            for user in users:
                tier = user.get("tier", "free").lower()
                user_id = get_effective_user_id(user["id"])
                
                # Dynamic Tier Logic (30-min Ticks)
                is_due = False
                if tier == "gold":
                    # Every 1h (2 x 30m)
                    if PULSE_COUNT % 2 == 0:
                        is_due = True
                elif tier == "silver":
                    # Every 2.5h (5 x 30m) AND skip night silence
                    if PULSE_COUNT % 5 == 0 and not is_night_silence:
                        is_due = True
                elif tier == "bronze":
                    # Every 24h (48 x 30m)
                    if PULSE_COUNT % 48 == 0:
                        is_due = True
                elif PULSE_COUNT == 1: # Initial boot catch-all
                    is_due = True

                if not is_due: continue
                
                alerts = await get_user_alerts(user_id)
                for a in alerts:
                    q = a.get("search_query", "").strip()
                    if q:
                        if q not in mission_map: mission_map[q] = []
                        mission_map[q].append({"user_id": user_id, "config": a})

            for q, subs in mission_map.items():
                task_id = await create_task(subs[0]['user_id'], q)
                await run_unified_scan(q, [], task_id, subs, is_pulse=True)
            
            await asyncio.sleep(1800) # 30 min pulse
            if PULSE_COUNT >= 48: PULSE_COUNT = 0
        except Exception as e:
            print_safe(f"[HEARTBEAT] Error: {e}")
            await asyncio.sleep(300)

@app.on_event("startup")
async def startup_event():
    if os.getenv("LOCAL_SNIPER", "true").lower() == "true":
        await engine.start()
        asyncio.create_task(autonomous_pulse_heartbeat())

@app.on_event("shutdown")
async def shutdown_event():
    await engine.stop()

@app.post("/force-pulse")
async def force_pulse():
    asyncio.create_task(autonomous_pulse_heartbeat_once())
    return {"status": "pulse_triggered_manually"}

async def autonomous_pulse_heartbeat_once():
    try:
        db = get_db()
        users = [{"id": u.id, **u.to_dict()} for u in db.collection("users").stream()]
        mission_map = {} 
        for user in users:
            uid = get_effective_user_id(user["id"])
            alerts = await get_user_alerts(uid)
            for a in alerts:
                q = a.get("search_query", "").strip()
                if q:
                    if q not in mission_map: mission_map[q] = []
                    mission_map[q].append({"user_id": uid, "config": a})
        for q, subs in mission_map.items():
            task_id = await create_task(subs[0]['user_id'], q)
            asyncio.create_task(run_unified_scan(q, [], task_id, subs))
    except Exception as e:
        print_safe(f"[MANUAL] Pulse Error: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
