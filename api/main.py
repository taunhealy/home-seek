import os
from pathlib import Path
from dotenv import load_dotenv

# [SHIELD] SMART ENV LOADER: Use absolute paths to project root
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent

env_paths = [
    current_dir / ".env",
    project_root / ".env"
]

for path in env_paths:
    if path.exists():
        load_dotenv(path)
        print(f"SUCCESS: Loaded .env from: {path}")
        break
else:
    load_dotenv() # Fallback

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Union
from pydantic import BaseModel, field_validator
import json
import asyncio
import time
from datetime import datetime
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from scraper.engine import SniperEngine
from database import (
    save_listing, get_sources, get_user_profile, 
    create_task, update_task, get_user_alerts, save_search,
    get_users_by_tier, get_db
)
from notifications import EvolutionClient, ResendEmailClient

app = FastAPI(title="Home Seek API", version="1.0.0")

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
notifier_wa = EvolutionClient()
notifier_email = ResendEmailClient()
sniper_lock = asyncio.Lock()
last_lock_time = 0

# [INFO] TIER LIMITS CONFIG
TIER_LIMITS = {
    "free": 1,    # Entry limit check
    "bronze": 5,  # R100 per month
    "silver": 10, # R200 per month
    "gold": 20    # R300 per month
}

def hydrate_cloud_identity():
    """Download and unpack session from Firestore if not local."""
    if os.environ.get("LOCAL_SNIPER") == "true":
        print("[IDENTITY] Local Mode Active. Skipping Cloud Hydration.")
        return
        
    print("[IDENTITY] Production Cloud Mode detected. Hydrating session from Vault...")
    try:
        import base64
        import shutil
        from database import get_db
        db = get_db()
        doc = db.collection('settings').document('facebook_identity').get()
        if not doc.exists:
            print("[IDENTITY] WARNING: No Cloud Identity found in Vault!")
            return
            
        data = doc.to_dict()
        # 1. Restore cookies.json
        if data.get('cookies'):
            with open('cookies.json', 'w') as f:
                json.dump(data['cookies'], f)
            print("  - cookies.json restored.")
            
        # 2. Restore local_session folder
        if data.get('session_zip'):
            with open('temp_identity.zip', 'wb') as f:
                f.write(base64.b64decode(data['session_zip']))
            
            # Clean old if exists
            if os.path.exists('local_session'):
                shutil.rmtree('local_session')
                
            shutil.unpack_archive('temp_identity.zip', 'local_session', 'zip')
            os.remove('temp_identity.zip')
            print("  - local_session folder restored and unpacked.")
            
    except Exception as e:
        print(f"[IDENTITY] CRITICAL FAILED during hydration: {e}")

# Call immediately on module load
hydrate_cloud_identity()

class SniperSearch(BaseModel):
    user_id: str
    search_query: str
    model: str = "gemini-flash-latest"
    alert_enabled: bool = False
    max_price: Optional[int] = None
    min_bedrooms: Optional[Union[int, List[int]]] = None
    pet_friendly: bool = False
    frequency: str = "Bronze"
    sources: List[str] = []
    
class TargetedSnipe(BaseModel):
    query: str
    source_ids: List[str]
    user_id: str = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"


@app.get("/user-profile/{user_id}")
async def fetch_user_profile(user_id: str):
    # IDENTITY BRIDGE: Redirect legacy UID to taunhealy
    effective_id = "taunhealy" if user_id == "R4R2k7z2XAQGgRjB57ctZcOkEbp2" else user_id
    print(f"[API] Fetching profile for {effective_id} (requested: {user_id})")
    profile = await get_user_profile(effective_id)
    return {**profile, "id": effective_id}

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
        
        # Price Check
        p = h.get("price") or 0
        if min_price and p < min_price: continue
        if max_price and p > max_price: continue
        
        # Source & Area Checks
        if platform and platform.lower() not in str(h.get("platform", "")).lower(): continue
        
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

@app.get("/geofence/suburbs")
async def get_elite_suburbs():
    """Exposes the PREMIUM_SUBURBS list for frontend autocomplete."""
    from geofence import PREMIUM_SUBURBS
    # Return as sorted title-case list for the UI
    return sorted([s.title() for s in PREMIUM_SUBURBS])

@app.post("/listings/manual")
async def manual_post_listing(listing: dict):
    """Allows users to manually submit a listing via the Cloud Backend."""
    try:
        from database import save_listing
        # Standardize listing
        listing["rental_type"] = listing.get("rental_type", "long-term")
        listing["platform"] = "Manual Post"
        
        # Save to Global Community Feed
        # The 'global' user ID is 0 since this is a public mission
        await save_listing("community_manual", listing)
        return {"status": "shared", "message": "Intel shared with the community!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/searches/{user_id}")
async def fetch_user_alerts(user_id: str):
    # IDENTITY BRIDGE: Redirect legacy UID to taunhealy
    effective_id = "taunhealy" if user_id == "R4R2k7z2XAQGgRjB57ctZcOkEbp2" else user_id
    print(f"📡 API: Fetching alerts for {effective_id}")
    alerts = await get_user_alerts(effective_id)
    return alerts

async def run_sniper_task(search: SniperSearch, task_id: str):
    """🌪️ THE SNIPER PULSE: Core background orchestration."""
    global last_lock_time, sniper_lock
    async with sniper_lock:
        last_lock_time = time.time()
        try:
            from intelligence.extractor import ExtractionResult
            print(f"[{datetime.now().strftime('%H:%M:%S')}] --- SCAN STARTED [{task_id}] ---")
            
            sources = await get_sources()
            user_profile = await get_user_profile(search.user_id)
            await update_task(task_id, "Brain", "Analyzing search area...")
            location = await engine.extractor.determine_location(search.search_query)
            await update_task(task_id, "Brain", f"Target Area: {location}")
            
            all_extracted_listings = []
            async def scrape_source(source_url: str):
                try:
                    result = await asyncio.wait_for(
                        engine.scrape_url(
                            source_url, 
                            task_id=task_id, 
                            search_area=location, 
                            model_name=search.model,
                            min_bedrooms=search.min_bedrooms,
                            max_price=search.max_price
                        ),
                        timeout=180
                    )
                    return result.listings
                except asyncio.TimeoutError:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚨 FATAL TIMEOUT: {source_url} took longer than 180 seconds and was killed!")
                    if task_id: await update_task(task_id, "Error", f"⚠️ Source timed out: {source_url[:30]}...")
                    return []
                except Exception as e:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ ERROR scraping {source_url}: {e}")
                    return []

            active_sources = [s for s in sources if s.get("name") in search.sources] if search.sources else sources
            
            # 🛡️ Dynamic URL Switcher for specialized sources
            for s in active_sources:
                if s.get("name") == "RentUncle" and search.pet_friendly:
                    s["url"] = "https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/features:pet-friendly/"
                elif s.get("name") == "RentUncle Pet Friendly":
                    s["url"] = "https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/features:pet-friendly/"
                elif s.get("name") == "Property24 Pet Friendly":
                    s["url"] = "https://www.property24.com/to-rent/cape-town/western-cape/432?sp=ptf%3dTrue"

            results = []
            for s in active_sources:
                res = await scrape_source(s.get("url"))
                results.append(res)
                
            for listings in results: 
                all_extracted_listings.extend(listings)
            
            if len(all_extracted_listings) == 0:
                await update_task(task_id, "Filtering", f"Critical: 0 listings extracted from {len(active_sources)} sources.")
            else:
                await update_task(task_id, "Filtering", f"Evaluating {len(all_extracted_listings)} extracted candidate listings...")
                
            scored_listings = await engine.extractor.filter_listings(all_extracted_listings, search.search_query, model_name=search.model)
            
            unique_scored = []
            seen_fingerprints = set()
            for sl in scored_listings:
                fp = sl.source_url if sl.source_url and "facebook.com" not in sl.source_url else f"{sl.title}-{sl.price}"
                if fp in seen_fingerprints: continue
                seen_fingerprints.add(fp)
                
                # 🛡️ Hard Price & Target Bedroom Shield
                if search.max_price and sl.price and sl.price > search.max_price: continue
                if search.min_bedrooms and len(search.min_bedrooms) > 0:
                    matched_bed = False
                    for target_bed in search.min_bedrooms:
                        if target_bed == 5:
                            if sl.bedrooms and sl.bedrooms >= 5: matched_bed = True
                        else:
                            if sl.bedrooms and sl.bedrooms == target_bed: matched_bed = True
                    if not matched_bed: continue
                
                # 🛡️ Wanted Filter
                is_wanted = any(kw in sl.description.lower() or kw in sl.title.lower() for kw in ["wanted", "looking for", "requested", "iso"])
                if is_wanted or sl.is_looking_for: continue
                
                # 🛠️ Legacy Link Check
                if "rentuncle.co.za/listing/" in (sl.source_url or ""):
                    sl.source_url = "https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/features:pet-friendly/"
                
                unique_scored.append(sl)
            
            match_count = 0
            for item in unique_scored:
                await update_task(task_id, "Brain", f"Graded '{item.title[:25]}...' (Score: {item.match_score}/100)")
                if item.match_score >= 40:
                    match_count += 1
                    item.user_id = search.user_id
                    item.task_id = task_id
                    await save_listing(item.model_dump(), task_id=task_id)
                    
                    if search.alert_enabled and item.match_score >= 90:
                        wa_number = user_profile.get("whatsapp")
                        msg = f"🏠 {item.title}\n💰 R {item.price:,}\n📍 {item.address}\n\n🔗 {item.source_url}"
                        if user_profile.get("tier") != "free" and wa_number:
                            await notifier_wa.send_whatsapp(wa_number, msg)
            
            await update_task(task_id, "Complete", f"Found {match_count} matches!", completed=True)
        except Exception as e:
            await update_task(task_id, "Failed", f"Error: {str(e)}", completed=True)

@app.post("/pulse/{tier}")
async def sniper_pulse(tier: str, background_tasks: BackgroundTasks):
    # 🔓 Pulse Override: Ensure we find ALL active snippets during testing
    users = await get_users_by_tier(tier)
    if not users and tier == "pro":
        # Fallback: Scrape everyone if pro is empty for testing
        from database import get_db
        db = get_db()
        all_users = db.collection("users").stream()
        users = [{"id": u.id, **u.to_dict()} for u in all_users]
        
    pulse_count = 0
    for user in users:
        alerts = await get_user_alerts(user["id"])
        if not alerts:
            print(f"📡 Pulse: No active alerts for user {user['id']}")
            continue
            
        for a in alerts:
            search_obj = SniperSearch(
                user_id=user["id"],
                search_query=a.get("search_query"),
                max_price=a.get("max_price"),
                min_bedrooms=a.get("min_bedrooms"),
                alert_enabled=True,
                pet_friendly=a.get("pet_friendly", False)
            )
            task_id = await create_task(user["id"], search_obj.search_query)
            background_tasks.add_task(run_sniper_task, search_obj, task_id)
            pulse_count += 1
    
    print(f"📡 Pulse Complete: Dispatched {pulse_count} sniper tasks.")
    return {"status": "pulsing", "count": pulse_count}

@app.post("/deploy-sniper")
async def deploy_sniper(search: SniperSearch, background_tasks: BackgroundTasks):
    profile = await get_user_profile(search.user_id)
    
    # Silent Profile Init: Ensure user exists in Firestore
    db = get_db()
    db.collection("users").document(search.user_id).set({
        "tier": profile.get("tier", "bronze"),
        "last_active": firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    tier = profile.get("tier", "bronze").lower()
    if search.alert_enabled:
        current_alerts = await get_user_alerts(search.user_id)
        limit = TIER_LIMITS.get(tier, 1)
        if len(current_alerts) >= limit:
            return {"status": "limited", "message": f"Upgrade required: Plan limit of {limit} reached for {tier.upper()} tier."}
        
        success_id = await save_search(search.user_id, search.model_dump())
        if not success_id:
            raise HTTPException(status_code=500, detail="Failed to persist alert in database.")

    global last_lock_time, sniper_lock
    if sniper_lock.locked():
        # 🧪 ZOMBIE RESET: If a task has been running for > 5 mins, assume it's a zombie and force-release.
        if last_lock_time > 0 and (time.time() - last_lock_time > 300): 
            sniper_lock = asyncio.Lock()
            print("🚨 GHOST BUSTER: Force-released zombie lock.")
        else: return {"status": "busy", "message": "Station busy."}

    task_id = await create_task(search.user_id, search.search_query)
    background_tasks.add_task(run_sniper_task, search, task_id)
    return {"status": "accepted", "task_id": task_id}

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    db = get_db()
    doc = db.collection("tasks").document(task_id).get()
    if doc.exists: return {"id": doc.id, **doc.to_dict()}
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/delete-alert/{user_id}/{alert_id}")
async def delete_user_alert(user_id: str, alert_id: str):
    db = get_db()
    db.collection("users").document(user_id).collection("alerts").document(alert_id).delete()
    return {"status": "ok"}

@app.post("/update-tier")
async def update_tier(data: dict):
    user_id = data.get("user_id")
    tier = data.get("tier", "bronze").lower()
    sub_id = data.get("subscription_id")
    if not user_id: raise HTTPException(status_code=400, detail="Missing user_id")
    
    if tier not in TIER_LIMITS:
        raise HTTPException(status_code=400, detail="Invalid tier")
        
    db = get_db()
    db.collection("users").document(user_id).set({
        "tier": tier,
        "subscription_id": sub_id,
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    # 🏛️ PULSE ACTIVATION
    if tier in ["silver", "gold"]:
        print(f"[SCHEDULER] Verifying {tier.upper()} pulse engine is active...")
        # Future: Call GCP Scheduler API to ensure job exists
        
    return {"status": "ok", "tier": tier}

@app.post("/diag/proxy-check")
async def proxy_diagnostic(background_tasks: BackgroundTasks):
    from browser_diag import run_diagnostic
    # Create a task doc in Firestore for the diagnostic
    db = get_db()
    diag_ref = db.collection("diagnostics").document()
    diag_id = diag_ref.id
    
    diag_ref.set({
        "timestamp": firestore.SERVER_TIMESTAMP,
        "status": "running",
        "message": "Initializing deep browser audit..."
    })
    
    async def diag_task():
        try:
            # We run it in a separate process or thread if needed, 
            # but since browser_diag is already async, we can just call it.
            # NOTE: We need to handle the screenshot upload to Firestore/Storage
            from browser_diag import run_diagnostic
            await run_diagnostic() # This currently saves to diag_report.json
            
            with open("diag_report.json", "r") as f:
                report = json.load(f)
            
            shot_data = None
            if os.path.exists("diag_fb_report.png"):
                with open("diag_fb_report.png", "rb") as f:
                    shot_data = base64.b64encode(f.read()).decode("utf-8")
            
            db.collection("diagnostics").document(diag_id).update({
                "status": "complete",
                "report": report,
                "screenshot": f"data:image/png;base64,{shot_data}" if shot_data else None,
                "completed_at": firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            db.collection("diagnostics").document(diag_id).update({
                "status": "failed",
                "error": str(e)
            })

    background_tasks.add_task(diag_task)
    return {"status": "started", "diag_id": diag_id}

@app.get("/diag/{diag_id}")
async def get_diag_status(diag_id: str):
    db = get_db()
    doc = db.collection("diagnostics").document(diag_id).get()
    if doc.exists: return doc.to_dict()
    raise HTTPException(status_code=404, detail="Diagnostic not found")

@app.post("/trigger-snipe")
async def trigger_targeted_snipe(data: TargetedSnipe, background_tasks: BackgroundTasks):
    task_id = await create_task(data.user_id, data.query)
    background_tasks.add_task(run_targeted_scan, data.query, data.source_ids, task_id, data.user_id)
    return {"status": "targeted_dispatched", "task_id": task_id}

async def run_targeted_scan(query: str, source_ids: List[str], task_id: str, requester_id: str):
    print(f"[MISSION] TARGETED SCAN START: {query} for User: {requester_id}")
    db = get_db()
    
    for sid in source_ids:
        source_doc = db.collection("sources").document(sid).get()
        if not source_doc.exists: continue
        source = source_doc.to_dict()
        source_name = source.get('name')
        source_url = source.get('url')
        
        await update_task(task_id, "Brain", f"Scouting: {source_name}")
        result = await engine.scrape_url(source_url, task_id=task_id, search_area=query)
        
        if result and result.listings:
            # SCALABLE SYNC: Automatically map to the requester
            # (Keeping the 'taunhealy' bridge only as a fallback for your specific technical UID)
            effective_user = "taunhealy" if requester_id == "R4R2k7z2XAQGgRjB57ctZcOkEbp2" else requester_id
            
            print(f"[PERSISTENCE] Saving {len(result.listings)} listings for User: {effective_user}")
            for listing in result.listings:
                l_dict = listing.dict() if hasattr(listing, 'dict') else listing
                await save_listing(effective_user, l_dict)
    
    await update_task(task_id, "Complete", f"Targeted search finished. Scanned {len(source_ids)} sources.")


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
