
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 🚚 DATA MIGRATION (v32.0)
# Moving listings from alias 'taunhealy' to real UID

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("[ERROR] service-account.json not found.")
    exit()

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def migrate_data():
    source_id = "taunhealy"
    target_id = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    
    print(f"[SYNC] Migrating listings from {source_id} to {target_id}...")
    
    docs = db.collection("users").document(source_id).collection("listings").stream()
    count = 0
    for doc in docs:
        db.collection("users").document(target_id).collection("listings").document(doc.id).set(doc.to_dict())
        count += 1
        
    print(f"[SUCCESS] {count} listings migrated to your live dashboard!")

if __name__ == "__main__":
    migrate_data()
