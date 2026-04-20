
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 🚚 DATA CONSOLIDATION (v35.0)
# Moving all intel from various IDs to 'taun_test_user'

def consolidate_data():
    cred_path = 'service-account.json'
    if not os.path.exists(cred_path):
        print("[ERROR] service-account.json not found.")
        return

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    
    source_ids = ["R4R2k7z2XAQGgRjB57ctZcOkEbp2", "taunhealy"]
    target_id = "taun_test_user"
    
    collections_to_move = ["alerts", "listings"]
    
    for sid in source_ids:
        print(f"\n--- [SYNC] Checking source: {sid} ---")
        for coll in collections_to_move:
            docs = db.collection("users").document(sid).collection(coll).stream()
            count = 0
            for doc in docs:
                data = doc.to_dict()
                # Update user_id inside the document if it exists
                if "user_id" in data:
                    data["user_id"] = target_id
                
                db.collection("users").document(target_id).collection(coll).document(doc.id).set(data)
                count += 1
            
            if count > 0:
                print(f"[SUCCESS] Moved {count} {coll} from {sid} to {target_id}")
            else:
                print(f"[INFO] No {coll} found in {sid}")

    # Also ensure the target user profile has a tier
    target_profile = db.collection("users").document(target_id).get()
    if not target_profile.exists or not target_profile.to_dict().get("tier"):
        print(f"[PROFILE] Initializing {target_id} with Gold tier for testing...")
        db.collection("users").document(target_id).set({
            "tier": "gold",
            "last_active": firestore.SERVER_TIMESTAMP
        }, merge=True)

if __name__ == "__main__":
    consolidate_data()
