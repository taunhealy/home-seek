
import firebase_admin
from firebase_admin import credentials, firestore
import os

creds_path = 'service-account.json'
if not os.path.exists(creds_path):
    print("Error: service-account.json not found")
    exit()

cred = credentials.Certificate(creds_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

def clear_fingerprints():
    print("[CLEANER] Purging Fingerprint Cache...")
    batch_size = 500
    docs = db.collection("fingerprints").limit(batch_size).stream()
    
    deleted = 0
    batch = db.batch()
    for doc in docs:
        batch.delete(doc.reference)
        deleted += 1
        
    if deleted > 0:
        batch.commit()
        print(f"  [SUCCESS] Deleted {deleted} fingerprints. Bot memory has been reset.")
    else:
        print("  [SUCCESS] Cache was already empty.")

if __name__ == "__main__":
    clear_fingerprints()
