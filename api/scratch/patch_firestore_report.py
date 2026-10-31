import sys
sys.path.append('api')
from main import get_db, get_effective_user_id
from google.cloud import firestore

user_ids = ['taun_test_user', 'R4R2k7z2XAQGgRjB57ctZcOkEbp2']
db = get_db()

updated_count = 0
for uid in user_ids:
    docs = list(db.collection('users').document(uid).collection('reports').stream())
    for d in docs:
        data = d.to_dict()
        ranked = data.get('ranked_listings', [])
        changed = False
        for item in ranked:
            url = item.get('url', '')
            title = item.get('title', '')
            price = item.get('price')
            # Check if this is the 4 Derwent / 117763397 listing
            if '117763397' in url or (item.get('bedrooms') == 2 and price == 17750 and 'tamboerskloof' in str(item.get('address', '')).lower()):
                print(f"Patching listing in report {d.id} for user {uid}")
                item['noise_risk'] = 'high'
                item['noise_reason'] = '4 Derwent Road: Ground entrance unit in older timber-floor block with heavy security gate reverberation and direct line-of-sight to Kloof St weekend bar hum'
                item['fit_score'] = 46
                item['address'] = '4 Derwent Road, Tamboerskloof'
                
                cons = item.get('cons', [])
                if not any('Noise Risk' in c for c in cons):
                    cons.insert(0, '🚨 Severe Noise Risk: Kloof St bar hum & ground entrance gate slams vibrating through timber floors')
                if not any('Entrance-level' in c for c in cons):
                    cons.insert(1, '⚠️ Entrance-level unit: high foot traffic impact noise transmitted through suspended wooden flooring')
                item['cons'] = cons
                
                item['verdict'] = 'Avoid for deep focus / music production: entrance position acts as acoustic soundboard for gate slams, with persistent weekend Kloof St nightlife bass hum.'
                item['short_explanation'] = 'Spacious 68 m² Tamboerskloof 2-bed, but acoustic fatigue trap from entrance gate slamming and weekend Kloof St bar hum.'
                changed = True
        
        if changed:
            # Re-sort ranked_listings by fit_score descending
            ranked.sort(key=lambda x: x.get('fit_score', 0), reverse=True)
            for idx, item in enumerate(ranked):
                item['rank'] = idx + 1
            db.collection('users').document(uid).collection('reports').document(d.id).update({
                'ranked_listings': ranked
            })
            updated_count += 1

print(f"SUCCESS: Successfully patched {updated_count} report documents in Firestore.")

