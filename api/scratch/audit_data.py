
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 📊 DATA AUDIT (v26.1)
# Checking active sources and finding the Big Bay alert

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("[ERROR] service-account.json not found.")
    exit()

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def audit_sources_and_alerts():
    print("[AUDIT] Checking Active Sources...")
    sources = db.collection("sources").where("enabled", "==", True).stream()
    for s in sources:
        s_data = s.to_dict()
        print(f" - {s_data.get('name')} (ID: {s.id})")

    print("\n[AUDIT] Checking 'Big Bay' Alerts...")
    users = db.collection("users").stream()
    for u in users:
        alerts = db.collection("users").document(u.id).collection("alerts").stream()
        for a in alerts:
            a_data = a.to_dict()
            if "big bay" in a_data.get("search_query", "").lower():
                print(f"FOUND Big Bay alert for User: {u.id}")
                print(f" - Sources specified: {a_data.get('source_ids', 'NONE (Defaults to ALL)')}")

if __name__ == "__main__":
    audit_sources_and_alerts()
