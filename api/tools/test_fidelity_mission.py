import asyncio
from main_local import run_local_scan
from services.database import get_db
import os
from datetime import datetime
import traceback
from firebase_admin import firestore

async def test_fidelity_mission():
    print(f"--- [FIDELITY TEST] Initiating Discovery Mission ({datetime.now().strftime('%H:%M:%S')}) ---")
    
    # Area: Big Bay (Forced Bypass v100.0)
    query = "Big Bay Property"
    print(f"[MISSION] Signal Lock: Hunting '{query}' for direct-link verification...")
    
    try:
        # Trigger a real scan (Multiplex v81.1)
        await run_local_scan(
            query=query,
            source_ids=None,
            task_id="fidelity_test_mission",
            subscribers=[{"user_id": "taun_test_user", "config": {"max_price": 25000, "min_bedrooms": []}}]
        )
        
        print(f"\n--- [MISSION COMPLETE] Discovery Protocol Finished ---")
        
        db = get_db()
        # Stream the most recent listings (Removing strict order_by to avoid index crashes)
        docs = db.collection('listings').limit(30).stream()
        
        print(f"{'TITLE':<30} | {'PLATFORM':<12} | {'DIRECT LINK'}")
        print("-" * 120)
        
        count = 0
        for d in docs:
            l = d.to_dict()
            title = str(l.get('title', 'Unknown'))[:30]
            platform = l.get('platform', 'Unknown')
            url = str(l.get('source_url', ''))
            
            # Fidelity Check Logic
            # P24: Must have a unique ID (6+ digits)
            is_valid_p24 = "property24.com" in url and any(p.isdigit() and len(p) >= 6 for p in url.split('/'))
            # FB: Must have direct post ID or Commerce ID
            is_valid_fb = "facebook.com" in url and any(x in url for x in ["/posts/", "/permalink/", "/user/", "/commerce/listing/"])
            
            status = "[PASS]" if (is_valid_p24 or is_valid_fb) else "[FAIL]"
            print(f"{title:<30} | {platform:<12} | {status} {url}")
            count += 1
            
        print("-" * 120)
        print(f"Verification Results: {count} listings analyzed.")

    except Exception as e:
        print(f"[CRASH] Fidelity Test failed: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_fidelity_mission())
