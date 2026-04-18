
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 1. Initialize Firebase
creds_path = 'service-account.json'
if not os.path.exists(creds_path):
    print("Error: service-account.json not found")
    exit()

cred = credentials.Certificate(creds_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

OLD_UID = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
NEW_UID = "taunhealy"

def migrate():
    print(f"[MIGRATION] Starting migration from {OLD_UID} to {NEW_UID}...")
    
    # Get listings from old collection
    old_listings_ref = db.collection("users").document(OLD_UID).collection("listings")
    listings = old_listings_ref.stream()
    
    count = 0
    for doc in listings:
        data = doc.to_dict()
        data["migrated_at"] = firestore.SERVER_TIMESTAMP
        
        # Save to new collection
        db.collection("users").document(NEW_UID).collection("listings").document(doc.id).set(data)
        count += 1
        print(f"  [MIGRATED] {data.get('title', 'Untitled')}")
        
    print(f"\n[DONE] Migration Complete: {count} listings moved to 'taunhealy'.")

if __name__ == "__main__":
    migrate()
