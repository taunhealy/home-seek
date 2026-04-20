import firebase_admin
from firebase_admin import credentials, firestore
import os

def ghost_sniper():
    print("--- [GHOST SNIPER] Excising Generic Suburb Links (v104.0) ---")
    
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
    
    # Target Collections
    registries = [("Global", db.collection('listings'))]
    users = db.collection('users').stream()
    for u in users: registries.append((f"User {u.id}", u.reference.collection('listings')))
    
    total_excised = 0
    for name, col in registries:
        print(f"Scanning {name} Registry...")
        docs = col.stream()
        for d in docs:
            l = d.to_dict()
            url = str(l.get('source_url', ''))
            title = str(l.get('title', 'Unknown'))
            
            # HEURISTIC: Is it a generic suburb link?
            # 1. Contains '/432' (Sea Point Suburb ID)
            # 2. DOES NOT contain any numeric part with 8+ digits (Property ID)
            is_generic = '/432' in url
            numeric_parts = [p for p in url.split('/') if p.isdigit()]
            has_property_id = any(len(p) >= 8 for p in numeric_parts)
            
            # Specific case for broken Facebook links too (e.g. unknown or just group homepage)
            is_ghost_fb = 'facebook.com' in url and ('/user/' not in url and '/posts/' not in url and '/commerce/' not in url)
            
            if (is_generic and not has_property_id) or is_ghost_fb:
                print(f"  - Excising GHOST: {title[:30]}... | URL: {url}")
                d.reference.delete()
                total_excised += 1
                
    print(f"\n--- GHOST SNIPER COMPLETE ---")
    print(f"Total Ghosts Excised: {total_excised}")

if __name__ == "__main__":
    ghost_sniper()
