import firebase_admin
from firebase_admin import credentials, firestore
import os
import time
import json
import hashlib
import datetime as dt
from typing import Optional, List

import sys

# [STABILITY] Windows Terminal ASCII Scrubber
def print_safe(msg):
    try:
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except:
        pass

# Initialize Firebase
db = None

def get_db():
    global db
    if db is not None:
        return db
        
    try:
        firebase_admin.get_app()
    except ValueError:
        # Check current dir and parent dir
        possible_paths = [
            'service-account.json',
            os.path.join(os.path.dirname(__file__), '..', 'service-account.json'),
            os.path.join(os.getcwd(), 'service-account.json')
        ]
        
        creds_path = None
        for p in possible_paths:
            if os.path.exists(p):
                creds_path = p
                break
        
        if creds_path:
            print_safe(f"[Firebase] Using credentials from: {creds_path}")
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)
        else:
            print_safe("[Firebase] WARNING: No service-account.json found. Write access may fail.")
            firebase_admin.initialize_app()
            
    db = firestore.client()
    return db

def create_listing_id(listing: dict) -> str:
    """Generates a deterministic hash ID based on core property attributes (v50.0)."""
    # 1. Standardize inputs to prevent minor spacing/casing from creating duplicates
    title = str(listing.get("title", "")).lower().strip()
    price = str(listing.get("price", "0")).strip()
    address = str(listing.get("address", "")).lower().strip()
    
    # 2. Salt with Source URL if available (but prefer content for Facebook transient links)
    url = str(listing.get("source_url", "")).split('?')[0] # Strip trackers
    
    payload = f"{title}-{price}-{address}"
    # Use SHA-256 for high-fidelity deduplication
    return hashlib.sha256(payload.encode()).hexdigest()[:24]

from core.geofence import is_area_elite

async def save_listing(user_id: str, listing: any, task_id: Optional[str] = None):
    """Save a listing to Firestore with deduplication and curation (v50.1)."""
    db = get_db()
    if not db: return

    # [TYPE SAFETY] Ensure we have a dictionary
    if not isinstance(listing, dict):
        if hasattr(listing, 'model_dump'):
            listing = listing.model_dump()
        elif hasattr(listing, 'dict'):
            listing = listing.dict()
        else:
            print_safe(f"[DATABASE] Error: Listing is not a dict (type: {type(listing)}). Skipping.")
            return



    # [LINK HEALING] Ensure we have a functional URL (v48.0)
    url = str(listing.get("source_url", ""))
    placeholders = ["example.com", "missing_url", "N/A", "MISSING", "none"]
    
    # If URL is a known placeholder, we strip it so the ID generation is cleaner
    if any(p in url.lower() for p in placeholders):
        url = ""
        listing["source_url"] = ""

    # Note: main_local.py or main.py will provide a context-rich fallback 
    # if this remains empty during the save.
    
    listing["created_at"] = firestore.SERVER_TIMESTAMP
    listing["updated_at"] = firestore.SERVER_TIMESTAMP
    
    try:
        # Create a permanent, anonymous hash ID based on the property content
        doc_id = create_listing_id(listing)
        
        # 1. Save to the user's PRIVATE collection
        db.collection("users").document(user_id).collection("listings").document(doc_id).set(listing, merge=True)
        
        # 2. ALSO save to the global community collection (Global Feed)
        # We create a 'Clean' copy for the public feed to ensure 100% privacy
        public_listing = listing.copy()
        public_listing.pop('id', None) # Remove AI-generated temp ID (e.g. 'listing_as_taun_1')
        public_listing['discovered_by'] = "Home-Seek Engine" # Anonymous attribution
        
        db.collection("listings").document(doc_id).set(public_listing, merge=True)
        
        # [STABILITY] Sanitize title for Windows Terminal display
        safe_title = listing.get('title', 'Unknown')
        print_safe(f"[DB] [DOUBLE-SAVE] Listing '{safe_title[:40]}...' synced to User & Global feeds.")
    except Exception as e:
        print_safe(f"[DB] Failed to save listing safely: {e}")

from firebase_admin.firestore import FieldFilter

async def get_sources():
    """Get enabled scraping sources."""
    db = get_db()
    if not db: return []
    docs = db.collection("sources").where(filter=FieldFilter("enabled", "==", True)).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

async def get_user_profile(user_id: str, token_data: Optional[dict] = None):
    """Get user profile and lazy-init if missing (v45.0)."""
    db = get_db()
    if not db: return {"id": user_id, "tier": "free"}
    
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()
    
    if doc.exists:
        return {"id": user_id, **doc.to_dict()}
    
    # 🐣 NEW USER FLOW: Lazy-Init (v45.0)
    # If the user doesn't exist but we have their Google Token info, 
    # we provision their account record immediately.
    new_profile = {
        "tier": "free",
        "created_at": firestore.SERVER_TIMESTAMP,
        "last_active": firestore.SERVER_TIMESTAMP,
    }
    
    if token_data:
        new_profile.update({
            "email": token_data.get("email"),
            "name": token_data.get("name"),
            "photo": token_data.get("picture"),
            "auth_provider": "google"
        })
    
    # Special Handling for the master tester account
    if user_id == "taun_test_user":
        new_profile["tier"] = "silver"

    doc_ref.set(new_profile)
    print_safe(f"[IDENTITY] Provisioned new profile for user: {user_id}")
    return {**new_profile, "id": user_id}

async def create_task(user_id: str, search_query: str):
    """Create a unique task for UI tracking."""
    db = get_db()
    if not db: return "mock_task_id"
    task_ref = db.collection("tasks").document()
    task_ref.set({
        "user_id": user_id,
        "query": search_query,
        "status": "Initializing",
        "progress": 0,
        "created_at": firestore.SERVER_TIMESTAMP
    })
    return task_ref.id

async def update_task(task_id: str, stage: str, message: str, progress: int = 0, completed: bool = False):
    """Update task progress and completion status for UI mapping."""
    db = get_db()
    if not db: return
    try:
        data = {
            "status": f"{stage}: {message}", 
            "updated_at": firestore.SERVER_TIMESTAMP,
            "logs": firestore.ArrayUnion([f"[{dt.datetime.now().strftime('%H:%M:%S')}] {stage}: {message}"])
        }
        if progress > 0: data["progress"] = progress
        if completed: data["completed"] = True
        db.collection("tasks").document(task_id).update(data)
    except Exception as e:
        print_safe(f"[DB] Task Update Error: {str(e)}")

async def is_hash_scanned(hash_key: str):
    """Checks if this exact block has been seen and analyzed before."""
    db = get_db()
    if not db: return False
    try:
        doc = db.collection('fingerprints').document(hash_key).get()
        return doc.exists
    except Exception: return False

async def record_hash(hash_key: str, metadata: dict = None):
    """Records that a block has been analyzed to prevent re-scanning."""
    db = get_db()
    if not db: return
    try:
        db.collection('fingerprints').document(hash_key).set({
            "scanned_at": firestore.SERVER_TIMESTAMP,
            "metadata": metadata or {}
        })
    except Exception as e:
        print_safe(f"[DB] Failed to record fingerprint: {e}")

async def get_users_by_tier(tier: str) -> list:
    """Get all user profiles belonging to a specific tier."""
    db = get_db()
    if not db: return []
    docs = db.collection("users").where("tier", "==", tier.lower()).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

async def get_user_alerts(user_id: str) -> list:
    """Get all saved search profiles for a user."""
    db = get_db()
    if not db: return []
    docs = db.collection("users").document(user_id).collection("alerts").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

async def save_search(user_id: str, search: dict):
    """Save or update a persistent search alert for a user."""
    db = get_db()
    if not db: 
        print_safe("[DB] Error: Firestore client not initialized.")
        return None
    try:
        search_id = hashlib.sha256(f"{user_id}-{search.get('search_query', '')}".lower().encode()).hexdigest()
        search["user_id"] = user_id
        search["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("users").document(user_id).collection("alerts").document(search_id).set(search, merge=True)
        print_safe(f"[DB] Alert Linked successfully to {user_id} [ID: {search_id}]")
        return search_id
    except Exception as e:
        print_safe(f"[DB] CRITICAL: Failed to link alert to user in Firestore: {str(e)}")
        return None

async def get_global_cookies():
    """Get the latest healthy session cookies from Firestore."""
    db = get_db()
    if not db: return None
    doc = db.collection("settings").document("facebook_session").get()
    if doc.exists:
        return doc.to_dict().get("cookies")
    return None

async def get_listings_by_keys(urls: list[str], hashes: list[str]) -> list[dict]:
    """Retrieve full listing objects from the global registry (v95.0)."""
    db = get_db()
    if not db: return []
    results = []
    try:
        # Check by content hash (more reliable for transient links)
        if hashes:
            for i in range(0, len(hashes), 30):
                batch = hashes[i:i+30]
                docs = db.collection("listings").where("content_hash", "in", batch).stream()
                results.extend([d.to_dict() for d in docs])
        
        # Check by URL (fallback)
        if urls and len(results) < len(urls):
            batch = [u for u in urls if u and "facebook" not in u][:30]
            if batch:
                docs = db.collection("listings").where("source_url", "in", batch).stream()
                # Dedup by title
                seen = {r.get('title') for r in results}
                for d in docs:
                    data = d.to_dict()
                    if data.get('title') not in seen:
                        results.append(data)
    except Exception as e:
        print_safe(f"[DB] Recall Warning: {e}")
    return results

async def get_known_listings(urls: list[str], hashes: list[str]) -> set[str]:
    """
    [COST GUARD] Batch check for known properties (v83.0).
    Returns a set of URLs and ContentHashes that ALREADY exist in the registry.
    """
    db = get_db()
    if not db or (not urls and not hashes): return set()
    
    known = set()
    try:
        # 1. Batch Check by URL (Limited by Firestore's 'in' operator to 30 items)
        if urls:
            def clean_fb(u):
                if "facebook.com" in u:
                    # Strip tracking tokens but keep the core post/user ID
                    return u.split('?')[0].split('&')[0].strip()
                return u.strip()

            clean_urls = [clean_fb(u) for u in urls if u and "missing" not in u][:30]
            if clean_urls:
                docs = db.collection("listings").where(filter=FieldFilter("source_url", "in", clean_urls)).stream()
                for d in docs:
                    known.add(d.to_dict().get("source_url"))

        # 2. Check Facebook specifically via Content Hash (URLs are too transient)
        if hashes:
            # We check hashes in batches of 30
            for i in range(0, len(hashes), 30):
                batch = hashes[i:i+30]
                docs = db.collection("listings").where(filter=FieldFilter("content_hash", "in", batch)).stream()
                for d in docs:
                    known.add(d.to_dict().get("content_hash"))
                    
    except Exception as e:
        print_safe(f"[DB] Known-Check Warning: {e}")
        
    return known

async def save_global_cookies(cookies: list):
    """Save updated session cookies to Firestore."""
    db = get_db()
    if not db: return
    try:
        db.collection("settings").document("facebook_session").set({
            "cookies": cookies,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        print_safe("[DB] Session State Synchronized with Firestore.")
    except Exception as e:
        print_safe(f"[DB] Failed to save global cookies: {e}")
