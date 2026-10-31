import sys, asyncio
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
from services.commute_service import calculate_listing_proximities

DEFAULT_ANCHORS = [
    {
        "id": "anchor-work",
        "label": "Work HQ (Amazon River Club)",
        "target_place": "Amazon River Club, Observatory",
        "commute_mode": "driving",
        "max_commute_mins": 25
    },
    {
        "id": "anchor-kloof",
        "label": "Kloof Street Cafes & Dining",
        "target_place": "Kloof Street, Gardens",
        "commute_mode": "walking",
        "max_commute_mins": 15
    },
    {
        "id": "anchor-mtb",
        "label": "Table Mountain MTB Trails",
        "target_place": "Deer Park, Table Mountain",
        "commute_mode": "bicycling",
        "max_commute_mins": 15
    },
    {
        "id": "anchor-cbd",
        "label": "Cape Town CBD",
        "target_place": "Cape Town CBD",
        "commute_mode": "driving",
        "max_commute_mins": 20
    }
]

async def enrich():
    db = get_db()
    rep_ref = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale")
    doc = rep_ref.get()
    if not doc.exists:
        print("Report not found!")
        return

    data = doc.to_dict()
    ranked = data.get("ranked_listings", [])
    
    print(f"Calculating location proximity for {len(ranked)} listings against {len(DEFAULT_ANCHORS)} anchors...")
    for item in ranked:
        address = item.get("address") or item.get("title") or "Gardens, Cape Town"
        proximities = await calculate_listing_proximities(address, DEFAULT_ANCHORS)
        item["location_proximity"] = proximities
        print(f"#{item.get('rank')} {address}: {len(proximities)} proximity points calculated.")

    rep_ref.update({
        "ranked_listings": ranked,
        "commute_anchors": DEFAULT_ANCHORS,
        "location_anchors": DEFAULT_ANCHORS
    })
    print("Successfully updated report with Location Proximity and Commute Anchors!")

asyncio.run(enrich())

