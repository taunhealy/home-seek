import sys
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.ai_scout import analyze_acoustic_risk

db = get_db()
reports_ref = db.collection("users").document("taun_test_user").collection("reports")
docs = list(reports_ref.stream())
print(f"Found {len(docs)} reports for taun_test_user")

for d in docs:
    rep_data = d.to_dict()
    ranked = rep_data.get("ranked_listings", [])
    updated = False
    
    for item in ranked:
        # Re-check acoustic risk
        addr = item.get("address", "")
        # Check title + address + explanation + short_explanation
        text = f"{addr} {item.get('title', '')} {item.get('short_explanation', '')}"
        
        # If listing_id is 117750970 (28 Scotts)
        if item.get("listing_id") == "117750970":
            text += " 28 scotts scott street jutland bridge"

        acoustic = analyze_acoustic_risk(addr, text)
        if acoustic["risk"] == "high" and item.get("noise_risk") != "high":
            print(f"Updating listing {item.get('listing_id')} ({item.get('title')}) to HIGH NOISE RISK!")
            item["noise_risk"] = "high"
            item["noise_reason"] = acoustic["reason"]
            item["fit_score"] = min(item.get("fit_score", 70), 52) # Demote score
            cons = item.get("cons", [])
            cons.insert(0, f"🚨 Severe Traffic Noise Trap: {acoustic['reason']}")
            item["cons"] = cons
            item["verdict"] = "Demoted: Balcony faces elevated Jutland Bridge / De Waal freeway flyover."
            updated = True

    if updated:
        # Re-sort by fit_score descending
        ranked.sort(key=lambda x: x.get("fit_score", 0), reverse=True)
        for idx, itm in enumerate(ranked):
            itm["rank"] = idx + 1
        reports_ref.document(d.id).update({"ranked_listings": ranked})
        print(f"Report {d.id} successfully updated in Firestore!")

