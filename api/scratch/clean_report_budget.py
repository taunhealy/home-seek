import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db

db = get_db()
rep_ref = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale")
doc = rep_ref.get()
data = doc.to_dict()

ranked = data.get("ranked_listings", [])
max_p = data.get("max_price", 18000)

print(f"Current count: {len(ranked)}. Max price: {max_p}")
valid_listings = [it for it in ranked if not (it.get("price") and it["price"] > max_p)]
print(f"Valid under budget listings: {len(valid_listings)}")

# Re-assign ranks 1..N
for idx, it in enumerate(valid_listings):
    it["rank"] = idx + 1

rep_ref.update({
    "ranked_listings": valid_listings
})
print("Updated report in Firestore to strictly exclude over-budget listings!")

