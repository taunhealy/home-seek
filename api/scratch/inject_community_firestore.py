import sys
sys.path.append('api')
from main import get_db
from services.community_sentiment import get_community_sentiment

user_ids = ['taun_test_user', 'R4R2k7z2XAQGgRjB57ctZcOkEbp2']
db = get_db()

patched_reports = 0
for uid in user_ids:
    docs = list(db.collection('users').document(uid).collection('reports').stream())
    for d in docs:
        data = d.to_dict()
        ranked = data.get('ranked_listings', [])
        for item in ranked:
            comm = get_community_sentiment(
                area=item.get("area", "Gardens"),
                address=item.get("address", ""),
                listing_id=str(item.get("listing_id") or item.get("id") or ""),
                title=item.get("title", ""),
                building_name=item.get("building_name")
            )
            item['community_sentiment'] = comm
            if '117763397' in str(item.get('url', '')) or 'derwent' in str(item.get('address', '')).lower():
                item['building_name'] = "4 Derwent Road (Entrance Block)"
            elif '117762862' in str(item.get('url', '')) or 'hall road' in str(item.get('address', '')).lower():
                item['building_name'] = "Monreith (22 Hall Road)"

        db.collection('users').document(uid).collection('reports').document(d.id).update({
            'ranked_listings': ranked
        })
        patched_reports += 1

print(f"SUCCESS: Injected community_sentiment into {patched_reports} Firestore reports.")

