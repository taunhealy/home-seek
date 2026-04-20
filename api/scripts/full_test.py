import sys
import os
import asyncio
from pathlib import Path

# Add parent dir to path to import everything
sys.path.append(str(Path(__file__).resolve().parent.parent))

from main_local import run_local_scan
from services.database import get_user_alerts

async def main():
    # 1. Setup Mock Subscription (Directly from DB)
    user_id = "taun_test_user"
    alerts = await get_user_alerts(user_id)
    
    if not alerts:
        print("❌ FAILED: No alerts found for taun_test_user. Please create one in the web UI first.")
        return

    # Use the first alert
    alert = alerts[0]
    query = alert.get("search_query", "Sea Point")
    
    print(f"STARTING END-TO-E-TEST: '{query}' for {user_id}")
    print("This will perform a REAL scrape and use REAL AI extraction.")
    
    # 2. Package as Multiplex Subscriber
    subs = [{"user_id": user_id, "config": alert}]
    task_id = "test_pulse_e2e"
    
    # 3. Run the scan
    # Args: query, source_ids, task_id, subscribers
    await run_local_scan(query, [], task_id, subs)
    
    print("\n✅ TEST COMPLETE.")
    print("If matches were found, you should have received a WhatsApp/Email just now.")

if __name__ == "__main__":
    asyncio.run(main())
