import sys
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.ai_scout import calculate_price_value_pct

db = get_db()
reports_ref = db.collection("users").document("taun_test_user").collection("reports")
docs = list(reports_ref.stream())
print(f"Found {len(docs)} reports for taun_test_user")

for d in docs:
    rep_data = d.to_dict()
    ranked = rep_data.get("ranked_listings", [])
    
    for item in ranked:
        price = item.get("price")
        beds = item.get("bedrooms")
        area = item.get("area") or "Gardens"
        
        pct = calculate_price_value_pct(price, beds, area, ranked)
        item["price_value_pct"] = pct
        tag = f"{abs(pct)}% underpriced" if pct < 0 else (f"{pct}% overpriced" if pct > 0 else "Fair value")
        print(f"Listing {item.get('listing_id')} (R {price:,} in {area}) -> {pct:+d}% ({tag})")

    reports_ref.document(d.id).update({"ranked_listings": ranked})
    print(f"Report {d.id} updated with price_value_pct!")

