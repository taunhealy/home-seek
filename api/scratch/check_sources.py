import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from database import get_db

async def check_sources():
    db = get_db()
    sources = db.collection("sources").stream()
    print("--- CURRENT SOURCES ---")
    for s in sources:
        d = s.to_dict()
        print(f"ID: {s.id} | Name: {d.get('name')} | URL: {d.get('url')}")

if __name__ == "__main__":
    asyncio.run(check_sources())
