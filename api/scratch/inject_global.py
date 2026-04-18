
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

USER_ID = "taunhealy"

def inject_global():
    print(f"[INJECTOR] Pulling listings from {USER_ID}...")
    listings = db.collection("users").document(USER_ID).collection("listings").stream()
    
    count = 0
    for doc in listings:
        data = doc.to_dict()
        # Ensure it has a timestamp for the global feed
        if "created_at" not in data:
            data["created_at"] = firestore.SERVER_TIMESTAMP
            
        # Push to GLOBAL collection
        db.collection("listings").document(doc.id).set(data)
        count += 1
        print(f"  [INJECTED] {data.get('title', 'Untitled')}")
        
    print(f"\n✅ Injection Complete: {count} listings are now LIVE in the Global Feed.")

if __name__ == "__main__":
    inject_global()
