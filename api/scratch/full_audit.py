
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 📊 GLOBAL MISSION AUDIT (v28.1)
# Checking ALL alerts for user Taun

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("[ERROR] service-account.json not found.")
    exit()

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def full_audit():
    user_id = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    print(f"[AUDIT] Checking missions for User: {user_id}")
    
    alerts = db.collection("users").document(user_id).collection("alerts").stream()
    count = 0
    for a in alerts:
        a_data = a.to_dict()
        print(f"MISSION #{count+1}:")
        print(f" - Query: '{a_data.get('search_query')}'")
        print(f" - ID: {a.id}")
        count += 1
    
    if count == 0:
        print("[EMPTY] No missions found for this user.")

if __name__ == "__main__":
    full_audit()
