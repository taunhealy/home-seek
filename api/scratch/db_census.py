import firebase_admin
from firebase_admin import credentials, firestore
import os

def check_structure():
    possible_paths = [
        'service-account.json',
        os.path.join(os.path.dirname(__file__), '..', 'service-account.json'),
        os.path.join(os.getcwd(), 'service-account.json'),
        '../service-account.json'
    ]
    creds_path = None
    for p in possible_paths:
        if os.path.exists(p):
            creds_path = p
            break
            
    if not creds_path:
        print("No keys found.")
        return

    try:
        cred = credentials.Certificate(creds_path)
        firebase_admin.initialize_app(cred)
    except: pass
    
    db = firestore.client()
    print(f"--- Firing Census for Project: {db.project} ---")
    user_id = "taun_test_user"
    
    # Check Top Level
    top_alerts = db.collection("alerts").where("user_id", "==", user_id).get()
    print(f"Top-Level Alerts Found: {len(top_alerts)}")
    
    # Check Nested
    nested_alerts = db.collection("users").document(user_id).collection("alerts").get()
    print(f"Nested Alerts Found: {len(nested_alerts)}")
    
    # Check User Profile
    user_doc = db.collection("users").document(user_id).get()
    if user_doc.exists:
        print(f"User Profile Doc: EXISTS ({user_doc.to_dict().get('tier')})")
    else:
        print("User Profile Doc: MISSING")

if __name__ == "__main__":
    check_structure()
