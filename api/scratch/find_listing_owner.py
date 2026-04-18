
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

TARGET_IDS = [
    "2xYGMCe55MVNojk3F9tO",
    "RqwZcIkuKkU20lkh4sqz",
    "TYpFRK9jc2FtXhCxqRA1",
    "edDMvB0jPaWud9TI6AGd",
    "gb0RtvgFwhQKmpa4x4K1",
    "iPbzXxegYTfK5zHzF2xH"
]

def find_owner():
    print("[TRACER] Searching for listing owners...")
    users_ref = db.collection("users").stream()
    
    found_id = None
    for user_doc in users_ref:
        user_id = user_doc.id
        # Check listings subcollection
        for tid in TARGET_IDS:
            doc = db.collection("users").document(user_id).collection("listings").document(tid).get()
            if doc.exists:
                print(f"  [FOUND] Doc {tid} belongs to User ID: {user_id}")
                found_id = user_id
                # Only need one to confirm the owner
                break
        if found_id: break
    
    if not found_id:
        print("  [WARNING] Could not find these IDs in any user subcollection. Checking global listings...")
        for tid in TARGET_IDS:
            doc = db.collection("listings").document(tid).get()
            if doc.exists:
                print(f"  [FOUND] Doc {tid} is in Global Listings.")

if __name__ == "__main__":
    find_owner()
