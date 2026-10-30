import sys
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.ai_scout import enrich_candidate_listing
from services.building_reviews import extract_building_name, CURATED_BUILDINGS

db = get_db()
reports_ref = db.collection("users").document("taun_test_user").collection("reports")
docs = list(reports_ref.stream())

print(f"Enriching {len(docs)} reports for taun_test_user with Floor, Lift, and Building...")

for d in docs:
    rep_data = d.to_dict()
    ranked = rep_data.get("ranked_listings", [])
    updated = False

    for item in ranked:
        enrich_candidate_listing(item)
        
        # Explicit known complexes
        lid = item.get("listing_id")
        title = item.get("title", "")
        addr = item.get("address", "")
        
        if lid == "114409019" or "union" in addr.lower():
            item["floor_number"] = "4th Floor"
            item["has_lift"] = "no" # Palmhof is 4-story walkup
            item["building_name"] = "Palmhof"
        elif lid == "117750970" or "scott" in addr.lower():
            item["building_name"] = "28 Scotts"
            item["has_lift"] = "yes"
            item["floor_number"] = "2nd Floor"
        elif lid == "117740072" or "derwent" in addr.lower():
            item["building_name"] = "Derwent Court"
            item["floor_number"] = "1st Floor"
            item["has_lift"] = "unknown"
        elif lid == "108534502":
            item["floor_number"] = "1st Floor"
            item["has_lift"] = "unknown"
            item["building_name"] = "Union Mansions"
        elif lid == "117676056" or "mill" in addr.lower():
            item["floor_number"] = "2nd Floor"
            item["has_lift"] = "unknown"
            item["building_name"] = "Mill Court"
        elif lid == "117408746":
            item["floor_number"] = "3rd Floor"
            item["has_lift"] = "unknown"
            item["building_name"] = "Gardens View"
        elif lid == "117763397":
            item["floor_number"] = "Ground Floor"
            item["has_lift"] = "N/A (Ground)"
            item["building_name"] = "Tamboer Heights"

        print(f"#{item.get('rank')} - {lid} | Floor: {item.get('floor_number')} | Lift: {item.get('has_lift')} | Building: {item.get('building_name')}")
        updated = True

    if updated:
        reports_ref.document(d.id).update({"ranked_listings": ranked})
        print(f"Report {d.id} updated with Floor, Lift, and Building names!")

