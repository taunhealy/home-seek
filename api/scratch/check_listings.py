import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from database import get_db

async def count_listings():
    db = get_db()
    user_id = "taun_test_user"
    docs = db.collection("users").document(user_id).collection("listings").stream()
    count = 0
    print(f"--- LISTINGS FOR {user_id} ---")
    for d in docs:
        count += 1
        data = d.to_dict()
        print(f"[{count}] {data.get('title')} - {data.get('price')} - {data.get('created_at')}")
    
    if count == 0:
        print("❌ No listings found for this user.")
    else:
        print(f"✅ Total: {count}")

if __name__ == "__main__":
    asyncio.run(count_listings())
