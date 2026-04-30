
import asyncio
import os
import sys

# Ensure API directory is in path
sys.path.append(os.path.join(os.getcwd()))

from main_local import run_local_scan
from services.database import get_db, create_task

async def test_rentuncle_flow():
    print("[TEST] Starting RentUncle Extraction Test...")
    
    # 1. Setup Mock Mission
    user_id = "taun_test_user"
    query = "Sea Point"
    task_id = await create_task(user_id, f"TEST: {query}")
    
    # RentUncle specific search for Sea Point (v24.1 structure)
    test_url = "https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/sea-point/"
    
    # Mock source config
    db = get_db()
    source_id = "test_rentuncle_source"
    db.collection("sources").document(source_id).set({
        "name": "RentUncle Test",
        "url": test_url,
        "type": "long-term",
        "enabled": True
    })
    
    # Mock subscribers
    subscribers = [{
        "user_id": user_id,
        "config": {
            "search_query": query,
            "max_price": 40000,
            "pet_friendly": False,
            "rental_type": "all"
        }
    }]
    
    print(f"[TEST] Dispatching local scan for {test_url}...")
    
    # 2. Run Scan
    # We set LOCAL_SNIPER=true to use the persistent engine
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true" 
    
    await run_local_scan(query, [source_id], task_id, subscribers)
    
    print("[TEST] Scan Complete. Verifying Database...")
    
    # 3. Verify Database
    # Check if any new listings were saved for this user in the last 2 minutes
    import datetime
    from google.cloud import firestore
    
    now = datetime.datetime.now(datetime.timezone.utc)
    two_mins_ago = now - datetime.timedelta(minutes=2)
    
    # Check Global Scout
    # Note: Listings are saved to 'listings' collection with source 'global_scout'
    docs = db.collection("listings").where(filter=firestore.FieldFilter("created_at", ">", two_mins_ago)).stream()
    hits = [d.to_dict() for d in docs if "rentuncle" in str(d.to_dict().get("source_url", "")).lower()]
    
    print(f"[VERIFY] Found {len(hits)} RentUncle listings in Global Scout.")
    for h in hits[:5]:
        print(f" - Found: {h.get('title')} ({h.get('price')}) -> {h.get('source_url')}")
        
    if hits:
        print("\nSUCCESS: RentUncle listings are being extracted and saved correctly.")
    else:
        print("\nFAILURE: No RentUncle listings found in DB. Check engine logs.")

if __name__ == "__main__":
    asyncio.run(test_rentuncle_flow())
