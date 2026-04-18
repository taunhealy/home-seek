
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 🛠️ SOURCE IQ FIX (v27.0)
# Fixes Huis Huis Pet Friendly URL and verifies ID

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("[ERROR] service-account.json not found.")
    exit()

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def fix_huis_huis_pf():
    correct_url = "https://www.facebook.com/groups/158733218125929/"
    source_id = "x8j0OMfg6xn5X9aPI2MI"
    
    print(f"[REPAIR] Updating Huis Huis Pet Friendly URL to: {correct_url}")
    db.collection("sources").document(source_id).update({
        "url": correct_url,
        "name": "Huis Huis Pet Friendly (Cape Town)"
    })
    print("[SUCCESS] Source repaired.")

if __name__ == "__main__":
    fix_huis_huis_pf()
