import sys, asyncio, json
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.availability_checker import verify_report_listings_availability

async def test_avail():
    db = get_db()
    doc = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale").get()
    ranked = doc.to_dict().get("ranked_listings", [])
    print(f"Checking {len(ranked)} listings live...")
    res = await verify_report_listings_availability(ranked)
    print(f"Active: {res['active_count']}")
    print(f"Unavailable: {res['unavailable_count']}")
    print(f"Unavailable IDs: {res['unavailable_ids']}")
    for it in res["listings"]:
        print(f"#{it.get('rank')} - {it.get('listing_id')} | Status: {it.get('availability_status')}")

asyncio.run(test_avail())

