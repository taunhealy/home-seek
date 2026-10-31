import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
db = get_db()
doc = db.collection('users').document('taun_test_user').collection('reports').document('rep_20261030_160803_cb52b8ca').get()
d = doc.to_dict()
for l in d.get('ranked_listings', []):
    print(f"#{l.get('rank')}: {l.get('title')} | R {l.get('price')} | beds: {l.get('bedrooms')} | url: {l.get('url')} | id: {l.get('id')}")

