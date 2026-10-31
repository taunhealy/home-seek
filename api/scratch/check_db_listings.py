import sys
sys.path.append('api')
from main import get_db

db = get_db()
docs = list(db.collection('listings').limit(50).stream())
print(f"Total listings in Firestore 'listings' collection: {len(docs)}")
for d in docs[:15]:
    data = d.to_dict()
    print(d.id, " | ", data.get('title'), " | ", data.get('address'), " | R", data.get('price'))

