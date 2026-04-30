import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path
from dotenv import load_dotenv

# Load env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

def get_db():
    try:
        firebase_admin.get_app()
    except ValueError:
        creds_path = os.path.join(os.path.dirname(__file__), '..', 'service-account.json')
        if os.path.exists(creds_path):
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()

def check_kalk_bay_alerts():
    db = get_db()
    user_id = "taun_test_user"
    
    print(f"Checking alerts for user: {user_id}")
    alerts_ref = db.collection("users").document(user_id).collection("alerts").stream()
    
    found = False
    for a in alerts_ref:
        data = a.to_dict()
        query = data.get("search_query", "")
        area = data.get("target_area", "")
        
        if "Kalk Bay" in query or "Kalk Bay" in area or "St James" in query or "St James" in area:
            found = True
            print(f"ID: {a.id}")
            print(f"Data: {data}")
            print("-" * 20)
            
    if not found:
        print("No Kalk Bay or St James alerts found.")

if __name__ == "__main__":
    check_kalk_bay_alerts()

if __name__ == "__main__":
    check_kalk_bay_alerts()
