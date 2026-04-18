
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 🧹 NUCLEAR WIPE (v26.0)
# Clears all saved alerts for all users to start fresh

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("[ERROR] service-account.json not found.")
    exit()

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def wipe_all_alerts():
    print("[RESET] Commencing global alert wipe...")
    users = db.collection("users").stream()
    
    wipe_count = 0
    for user in users:
        alerts = db.collection("users").document(user.id).collection("alerts").stream()
        for alert in alerts:
            db.collection("users").document(user.id).collection("alerts").document(alert.id).delete()
            wipe_count += 1
    
    print(f"[SUCCESS] Global Alert Wipe complete. {wipe_count} missions neutralized.")
    print("[READY] You can now add your fresh alerts in the web dashboard.")

if __name__ == "__main__":
    wipe_all_alerts()
