
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure API directory is in path
sys.path.append(os.path.join(os.getcwd()))

from services.database import get_db
from google.cloud import firestore

async def verify_db():
    db = get_db()
    now = datetime.now(timezone.utc)
    ten_mins_ago = now - timedelta(minutes=10)
    
    docs = db.collection("listings").where(filter=firestore.FieldFilter("created_at", ">", ten_mins_ago)).stream()
    hits = [d.to_dict() for d in docs]
    
    ru_hits = [h for h in hits if "rentuncle" in str(h.get("source_url", "")).lower()]
    
    print(f"Total New Listings: {len(hits)}")
    print(f"RentUncle Listings: {len(ru_hits)}")
    
    for h in ru_hits[:5]:
        print(f" - {h.get('title')} ({h.get('price')}) -> {h.get('source_url')}")

if __name__ == "__main__":
    asyncio.run(verify_db())
