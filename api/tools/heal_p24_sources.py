import firebase_admin
from firebase_admin import credentials, firestore
import os

def heal_p24_sources():
    print("[BASE] Starting Property24 Source Surgery (v86.1)...")
    
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
    
    count = 0
    # Scan all sources
    docs = db.collection('sources').stream()
    
    for d in docs:
        source = d.to_dict()
        url = source.get('url', '')
        
        if "property24.com" in url and "/pet-friendly" in url:
            # Repair: Replace broken slug with official parameter
            new_url = url.replace("/pet-friendly/", "").replace("/pet-friendly", "")
            
            # Ensure we use the correct query joining
            sep = "&" if "?" in new_url else "?"
            new_url = f"{new_url}{sep}f7=1"
            
            print(f"  - Healing: {source.get('name')} | {url} -> {new_url}")
            d.reference.update({'url': new_url})
            count += 1
            
    print(f"\n--- SURGERY COMPLETE ---")
    print(f"Healed {count} Property24 sources. High-fidelity missions restored.")

if __name__ == "__main__":
    heal_p24_sources()
