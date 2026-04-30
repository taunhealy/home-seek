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

def check_all_alerts():
    db = get_db()
    
    print("Checking all alerts in the system...")
    users_ref = db.collection("users").stream()
    
    for u in users_ref:
        print(f"User: {u.id}")
        alerts_ref = db.collection("users").document(u.id).collection("alerts").stream()
        for a in alerts_ref:
            data = a.to_dict()
            print(f"  Alert ID: {a.id}")
            print(f"  Data: {data}")
            print("  " + "-" * 10)
        print("-" * 30)

if __name__ == "__main__":
    check_all_alerts()
