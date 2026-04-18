import firebase_admin
from firebase_admin import credentials, firestore

# Initialize
cred = credentials.Certificate('service-account.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

USER_ID = "taunhealy"
HUIS_HUIS_ID = "Lix5HlnnquOBb8KjEsCa" # The regular Huis Huis group

# 1. Clear existing alerts to prevent noise
alerts = db.collection('alerts').where('user_id', '==', USER_ID).stream()
for a in alerts:
    db.collection('alerts').document(a.id).delete()
    print(f"🗑️ Deleted alert: {a.id}")

# 2. Add THE Targeted Alert
db.collection('alerts').add({
    'user_id': USER_ID,
    'query': "Sea Point",
    'source_ids': [HUIS_HUIS_ID],
    'is_active': True,
    'last_scanned': None,
    'match_threshold': 50,
    'min_bedrooms': None,
    'max_price': 30000
})

print(f"✅ SUCCESS: Search restricted to 'Huis Huis' for 'Sea Point'.")
