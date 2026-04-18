import firebase_admin
from firebase_admin import credentials, firestore
import os

def purge_ghosts():
    print("[PURGE] Starting Low-Fidelity Link Cleanup (v89.2)...")
    
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
    # Stream all listings
    docs = db.collection('listings').stream()
    
    for d in docs:
        l = d.to_dict()
        url = str(l.get('source_url', ''))
        title = l.get('title', 'Unknown')
        platform = l.get('platform', 'Unknown')
        
        # 🎯 [v91.1] THE NUCLEAR PURGE (Total Actionability Protocol)
        # 🎯 [v94.1] 9-DIGIT SUBURB-TRAP (ID Lockdown)
        # Property24 listings have IDs like /114620025 (9 digits). Suburbs are /432 (3 digits).
        # We REJECT any P24 link where the longest numeric part is less than 8 digits.
        numeric_parts = [p for p in url.split('/') if p.isdigit()]
        max_id_len = max([len(p) for p in numeric_parts]) if numeric_parts else 0
        is_generic_p24 = "property24.com" in url and max_id_len < 8
        
        # Case B: Facebook must be a HIGH-FIDELITY direct link
        # Reject generic house-listing landing pages or group-only homepages
        is_direct_fb = any(x in url for x in ["/posts/", "/permalink/", "/user/", "/commerce/listing/"])
        is_generic_fb = platform == "Facebook" and not is_direct_fb
        
        # Case C: Mock/Legacy Debt
        is_mock = "listing_" in d.id or "dummy" in url or "example.com" in url
        
        # Case D: Technical Placeholders
        is_technical_ghost = any(bad in url.lower() for bad in ["javascript:void(0)", "unknown", "no url provided"]) or not url or len(url) < 15

        if is_generic_p24 or is_generic_fb or is_mock or is_technical_ghost:
            print(f"  - Nuclear Purge: {title[:30]}... | [{platform}] | URL: {url}")
            d.reference.delete()
            count += 1
            
    print(f"\n--- PURGE COMPLETE ---")
    print(f"✅ Excised {count} low-fidelity listings. Your marketplace is now 100% Direct-Link Only.")

if __name__ == "__main__":
    purge_ghosts()
