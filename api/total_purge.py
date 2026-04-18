import firebase_admin
from firebase_admin import credentials, firestore
import os

def total_purge():
    print("[NUCLEAR PURGE] Starting Cross-Collection ID Lockdown (v94.2)...")
    
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
    
    total_count = 0
    collections_to_check = [db.collection('listings')]
    
    # 🕵️‍♂️ Add all user sub-collections
    users_docs = db.collection('users').stream()
    for u in users_docs:
        collections_to_check.append(u.reference.collection('listings'))

    print(f"[PURGE] Scanning {len(collections_to_check)} listing registries...")

    for col in collections_to_check:
        docs = col.stream()
        for d in docs:
            l = d.to_dict()
            url = str(l.get('source_url', ''))
            title = l.get('title', 'Unknown')
            
            # 🎯 [v94.2] 9-DIGIT ID LOCKDOWN
            numeric_parts = [p for p in url.split('/') if p.isdigit()]
            max_id_len = max([len(p) for p in numeric_parts]) if numeric_parts else 0
            
            # Criteria A: P24 Suburb Link Trap (Generic IDs like /432)
            is_generic_p24 = "property24.com" in url and max_id_len < 8
            
            # Criteria B: FB Search Landing Trap
            is_generic_fb = "facebook.com/groups/" in url and "/posts/" not in url and "/permalink/" not in url and "/user/" not in url
            
            # Criteria C: Placeholders
            is_ghost = any(bad in url.lower() for bad in ["example.com", "unknown", "no url provided"]) or not url or len(url) < 15

            if is_generic_p24 or is_generic_fb or is_ghost:
                print(f"  - Excising: {title[:30]}... | URL: {url}")
                d.reference.delete()
                total_count += 1
            
    print(f"\n--- PURGE COMPLETE ---")
    print(f"Total Ghost Listings Excised: {total_count}")

if __name__ == "__main__":
    total_purge()
