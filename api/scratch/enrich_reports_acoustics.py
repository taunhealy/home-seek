import sys
import os

api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from services.database import get_db
from services.acoustic_registry import compute_property_acoustic_audit

db = get_db()
users = ["taun_test_user", "R4R2k7z2XAQGgRjB57ctZcOkEbp2"]

for u in users:
    reports_ref = db.collection("users").document(u).collection("reports")
    docs = list(reports_ref.stream())
    print(f"User {u} has {len(docs)} reports.")
    for d in docs:
        rep_data = d.to_dict()
        listings = rep_data.get("ranked_listings", [])
        if not listings:
            continue
        modified = False
        for item in listings:
            url = str(item.get("url", ""))
            title = str(item.get("title", ""))
            address = str(item.get("address", ""))
            desc = str(item.get("short_explanation", "")) + " " + str(item.get("verdict", ""))
            floor = str(item.get("floor_number", ""))

            lat, lng = -33.9328, 18.4103
            if "117763397" in url or "117763397" in str(item.get("listing_id", "")) or "roberta" in (title + address).lower() or "4 derwent" in (title + address).lower():
                lat, lng = -33.9328, 18.4103
                floor = "Ground Floor"
                desc += " Oregon pine floors, entrance door right by block entry gate."
            elif "117762862" in url or "monreith" in (title + address).lower():
                lat, lng = -33.9165, 18.3920
                floor = "3rd Floor"
            elif "sea point" in (address + title).lower():
                lat, lng = -33.9180, 18.3890
            elif "green point" in (address + title).lower():
                lat, lng = -33.9085, 18.4090
            elif "tamboerskloof" in (address + title).lower():
                lat, lng = -33.9340, 18.4030

            audit = compute_property_acoustic_audit(
                lat=lat,
                lng=lng,
                floor_level=floor,
                text_desc=desc,
                title=title,
                address=address
            )
            item["acoustic_audit"] = audit
            modified = True

        if modified:
            reports_ref.document(d.id).update({"ranked_listings": listings})
            print(f"Updated report {d.id} for user {u} with acoustic audits ({len(listings)} items).")

print("Acoustic audit enrichment complete.")
