import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from database import get_db

async def add_extra_short_term():
    db = get_db()
    
    new_source = {
        "name": "Cape Town Short/Long Rentals",
        "url": "https://www.facebook.com/groups/711244092284984/",
        "type": "short-term",
        "platform": "Facebook",
        "is_active": True
    }
    
    # Check if exists
    existing = db.collection("sources").where("url", "==", new_source["url"]).get()
    if not existing:
        db.collection("sources").add(new_source)
        print("Added 'Cape Town Short/Long Rentals' to Short-Term grid.")
    else:
        print("Source already exists.")

if __name__ == "__main__":
    asyncio.run(add_extra_short_term())
