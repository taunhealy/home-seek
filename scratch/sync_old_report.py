import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
db = get_db()

# Copy ranked listings from new clean report into rep_20261030_160803_cb52b8ca
new_doc = db.collection('users').document('taun_test_user').collection('reports').document('rep_20261030_165446_cb52b8ca').get()
old_ref = db.collection('users').document('taun_test_user').collection('reports').document('rep_20261030_160803_cb52b8ca')

if new_doc.exists and old_ref.get().exists:
    new_data = new_doc.to_dict()
    old_ref.update({
        "ranked_listings": new_data.get("ranked_listings", []),
        "overall_summary": new_data.get("overall_summary", ""),
        "total_found": new_data.get("total_found", 10),
    })
    print("Successfully synchronized rep_20261030_160803_cb52b8ca with clean ranked listings!")

