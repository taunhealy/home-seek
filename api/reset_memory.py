import firebase_admin
from firebase_admin import credentials, firestore
import os

def reset_memory():
    print("--- [MEMORY WIPE] Resetting Atomic Fingerprints (v98.2) ---")
    
    # Load credentials
    cred_path = 'service-account.json'
    if not os.path.exists(cred_path):
        cred_path = os.path.join(os.path.dirname(__file__), 'service-account.json')
    
    if not os.path.exists(cred_path):
        print("Error: service-account.json not found.")
        return

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    
    # [v98.2] Wipe the 'known_listings' collection
    docs = db.collection('known_listings').stream()
    count = 0
    for d in docs:
        d.reference.delete()
        count += 1
        
    print(f"\n--- MEMORY RESET COMPLETE ---")
    print(f"Total Fingerprints Excised: {count}")

if __name__ == "__main__":
    reset_memory()
