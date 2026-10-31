import sys
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db

db = get_db()
doc_ref = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale")
doc = doc_ref.get()
data = doc.to_dict()
ranked = data.get("ranked_listings", [])

for l in ranked:
    aname = (l.get("agency_name") or "").lower()
    if not l.get("agency_name") or any(k in aname for k in ["private", "landlord", "owner", "none"]):
        l["is_direct_landlord"] = True
        l["agency_name"] = "Direct Landlord"
        l["agency_rating"] = None
        l["agency_review_count"] = None
        l["agency_risk_level"] = "direct_landlord"
    else:
        l["is_direct_landlord"] = False

    print(f"#{l.get('rank')} - {l.get('listing_id')} | Landlord: {l.get('is_direct_landlord')} | Agency: {l.get('agency_name')}")

doc_ref.update({"ranked_listings": ranked})
print("Updated report in Firestore with Landlord vs Agency classification!")

