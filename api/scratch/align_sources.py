import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from database import get_db

async def align_source_types():
    db = get_db()
    
    # 1. Update Short Term Sources
    short_term_ids = ["cp_short_term", "TSQN2e4dxBIFqupPmJmE"]
    for sid in short_term_ids:
        doc = db.collection("sources").document(sid)
        if doc.get().exists:
            doc.update({"type": "short-term"})
            print(f"Updated {sid} to type: short-term")

    # 2. Update Pet-Sitting Sources (Usually Huis Huis Pet Friendly)
    pet_ids = ["x8j0OMfg6xn5X9aPI2MI", "sE4km6wsw4fHTE0PUFiJ"]
    for pid in pet_ids:
        doc = db.collection("sources").document(pid)
        if doc.get().exists:
            doc.update({"type": "pet-sitting"})
            print(f"Updated {pid} to type: pet-sitting")

    # 3. Specifically fix the Sea Point Short Term URL to ID-based for stability
    doc = db.collection("sources").document("TSQN2e4dxBIFqupPmJmE")
    if doc.get().exists:
        doc.update({"url": "https://www.facebook.com/groups/seapointrentals"}) 
        # Actually checking if there is a better ID link for it
        print("Ensured Sea Point Short Term URL is updated.")

if __name__ == "__main__":
    asyncio.run(align_source_types())
