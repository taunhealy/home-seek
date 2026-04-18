import firebase_admin
from firebase_admin import credentials, firestore
import json

# Initialize
cred = credentials.Certificate('service-account.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

# Load local cookies
with open('cookies.json', 'r') as f:
    cookies = json.load(f)

# Update Firestore
db.collection('vault').document('global_cookies').set({
    'cookies': cookies,
    'updated_at': firestore.SERVER_TIMESTAMP
})

print("SUCCESS: Global cookies synchronized to Firestore.")
