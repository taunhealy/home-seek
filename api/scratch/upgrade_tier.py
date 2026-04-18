
import firebase_admin
from firebase_admin import credentials, firestore
import os

# 🥈 SILVER UPGRADE (v28.0)
# Manually upgrading user Taun to Silver Tier

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("[ERROR] service-account.json not found.")
    exit()

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def upgrade_taun():
    # Targeted user ID from logs
    user_id = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
    
    print(f"[BILLING] Upgrading User {user_id} to SILVER tier...")
    db.collection("users").document(user_id).update({
        "tier": "silver",
        "plan_limit": 5, # Standard Silver limit
        "updated_at": firestore.SERVER_TIMESTAMP
    })
    print("[SUCCESS] License Upgraded! Welcome to the High-Trust Sniper Club.")

if __name__ == "__main__":
    upgrade_taun()
