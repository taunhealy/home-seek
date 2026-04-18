import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from database import get_db

async def purge_sea_point_fingerprints():
    db = get_db()
    # 1. Clear Fingerprints
    fps = db.collection("fingerprints").stream()
    count = 0
    for fp in fps:
        fp.reference.delete()
        count += 1
    
    # 2. Clear Global Listings (Discovery Reset)
    gls = db.collection("listings").stream()
    gcount = 0
    for gl in gls:
        gl.reference.delete()
        gcount += 1

    print(f"CLEARED {count} fingerprints and {gcount} global listings. The Sniper vision is now 100% fresh.")

if __name__ == "__main__":
    asyncio.run(purge_sea_point_fingerprints())
