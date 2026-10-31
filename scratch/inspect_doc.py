import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
db = get_db()
doc = db.collection('listings').document('08c583c2a7cd7bf540afad9c').get()
print('Exists:', doc.exists)
if doc.exists:
    d = doc.to_dict()
    for k, v in d.items():
        print(f"  {k}: {v}")

