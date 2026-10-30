import sys
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db

db = get_db()
reports_ref = db.collection("users").document("taun_test_user").collection("reports")
docs = list(reports_ref.stream())

for d in docs:
    rep_data = d.to_dict()
    ranked = rep_data.get("ranked_listings", [])
    updated = False
    
    for item in ranked:
        if item.get("listing_id") == "114409019":
            print("Found 114409019! Updating parking and pros/cons...")
            item["parking"] = 1
            # Remove parking from cons
            item["cons"] = [c for c in item.get("cons", []) if "parking" not in c.lower()]
            # Add to pros
            pros = item.get("pros", [])
            if not any("undercover parking" in p.lower() for p in pros):
                pros.append("Secure undercover parking bay included (24-hour security)")
            item["pros"] = pros
            updated = True

    if updated:
        reports_ref.document(d.id).update({"ranked_listings": ranked})
        print(f"Report {d.id} updated with correct parking specs!")
