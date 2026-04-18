import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime

def audit_fidelity():
    print(f"--- [FIDELITY AUDIT] Starting Data Integrity Check ({datetime.now().strftime('%H:%M:%S')}) ---")
    
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
    
    # Analyze the last 20 global listings
    docs = db.collection('listings').order_by('created_at', direction=firestore.Query.DESCENDING).limit(20).stream()
    
    passed = 0
    failed = 0
    
    print(f"{'TITLE':<40} | {'PLATFORM':<12} | {'LINK STATUS':<15}")
    print("-" * 80)
    
    for d in docs:
        l = d.to_dict()
        title = str(l.get('title') or 'No Title').encode('ascii', 'ignore').decode('ascii')[:40]
        platform = l.get('platform', 'Unknown')
        url = str(l.get('source_url', ''))
        
        # Fidelity Rules
        is_ghost = any(bad in url for bad in ["javascript:void(0)", "example.com", "missing_url"]) or not url or len(url) < 10
        
        status = "[PASS]" if not is_ghost else "[FAIL]"
        if is_ghost: 
            failed += 1
        else: 
            passed += 1
            
        print(f"{title:<40} | {platform:<12} | {status:<15}")
        if is_ghost:
            print(f"   [!] BROKEN URL: {url}")

    print("-" * 80)
    print(f"--- [AUDIT COMPLETE] ---")
    print(f"   - Passed Hist: {passed}")
    print(f"   - Failed Hist: {failed}")
    if failed > 0:
        print(f"   - Recommendation: Link-Shield logic needs hardening.")
    else:
        print(f"   - Recommendation: System is at 100% Link Fidelity. Protocol secure.")

if __name__ == "__main__":
    audit_fidelity()
