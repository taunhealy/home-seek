import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
db = get_db()
docs = db.collection('listings').limit(20).stream()
for d in docs:
    data = d.to_dict()
    img_keys = {k: bool(v) for k, v in data.items() if 'img' in k.lower() or 'image' in k.lower() or 'photo' in k.lower()}
    print(d.id, data.get('title'), img_keys)

