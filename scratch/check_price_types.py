import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
db = get_db()
for doc_id in ['0446a86295c553578e311de1', '1278cb0be0d34e4dbec65d0e', '682095688ffe04291a03f484']:
    doc = db.collection('listings').document(doc_id).get()
    if doc.exists:
        p = doc.to_dict().get('price')
        print(doc_id, 'price:', repr(p), 'type:', type(p))

