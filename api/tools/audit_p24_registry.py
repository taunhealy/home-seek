import firebase_admin
from firebase_admin import credentials, firestore
import os

def audit_p24():
    print("--- [P24 REGISTRY AUDIT] Verifying Link Fidelity (v97.0) ---")
    
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
    
    # Audit Global AND User Collections
    registries = [db.collection('listings')]
    users = db.collection('users').stream()
    for u in users: registries.append(u.reference.collection('listings'))
    
    print(f"{'TITLE':<35} | {'PLATFORM':<12} | {'URL'}")
    print("-" * 140)
    
    count = 0
    valid_count = 0
    for col in registries:
        docs = col.stream()
        for d in docs:
            l = d.to_dict()
            platform = str(l.get('platform', '')).lower()
            if 'property24' not in platform: continue
            
            url = str(l.get('source_url', ''))
            title = str(l.get('title', 'Unknown'))[:35]
            
            # 9-Digit ID Check
            numeric_parts = [p for p in url.split('/') if p.isdigit()]
            max_id_len = max([len(p) for p in numeric_parts]) if numeric_parts else 0
            is_high_fidelity = max_id_len >= 8
            
            status = "[PASS]" if is_high_fidelity else "[FAIL]"
            print(f"{title:<35} | {l.get('platform'):<12} | {status} {url}")
            
            count += 1
            if is_high_fidelity: valid_count += 1
        
    print("-" * 120)
    print(f"Audit Complete: {valid_count}/{count} Property24 listings are High-Fidelity.")
    if count == 0:
        print("NOTE: Registry is currently empty of P24 listings (likely due to the Nuclear Purge). Initiate a new scan to verify extraction.")

if __name__ == "__main__":
    audit_p24()
