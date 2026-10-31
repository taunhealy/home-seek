import sys
sys.path.append('api')
from main import get_db, get_effective_user_id
from google.cloud import firestore

eff = get_effective_user_id('taun_test_user', 'R4R2k7z2XAQGgRjB57ctZcOkEbp2')
docs = list(get_db().collection('users').document(eff).collection('reports').order_by('created_at', direction=firestore.Query.DESCENDING).limit(1).stream())
if docs:
    for x in docs[0].to_dict().get('ranked_listings', []):
        print(f"Rank {x.get('rank')}: {x.get('title')} | {x.get('price')} | {x.get('address')} | {x.get('url')}")
