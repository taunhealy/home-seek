
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
import shutil
import base64
import zipfile

# 🛡️ LEAN IDENTITY SYNC (v23.2)
# Packs only the ESSENTIALS to fit in Firestore (Limit: 1MB)

cred_path = 'service-account.json'
if not os.path.exists(cred_path):
    print("❌ Error: service-account.json not found.")
    exit()

cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def zip_essentials(path, zip_name):
    # Folders we DONT need for session persistence
    exclude = ['Cache', 'Code Cache', 'GPUCache', 'GrShaderCache', 'ShaderCache', 'GraphiteDawnCache', 'Crashpad']
    
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(path):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in exclude]
            
            for file in files:
                # Include everything else (Cookies, IndexedDB, etc)
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, path)
                zipf.write(file_path, arcname)

def package_identity():
    print("[IDENTITY] Packaging LEAN session for Cloud Deployment...")
    
    # 1. Sync cookies.json
    cookies = []
    if os.path.exists('cookies.json'):
        with open('cookies.json', 'r') as f:
            cookies = json.load(f)
    
    # 2. Sync local_session (Lean Zip)
    session_payload = None
    if os.path.exists('local_session'):
        print("  - local_session found. Stripping cache and zipping...")
        zip_name = 'lean_session.zip'
        zip_essentials('local_session', zip_name)
        
        file_size = os.path.getsize(zip_name)
        print(f"  - Zip File Size: {file_size / 1024:.2f} KB")
        
        if file_size > 950 * 1024:
            print("🚨 WARNING: Identity is near Firestore 1MB limit!")
            
        with open(zip_name, 'rb') as f:
            session_payload = base64.b64encode(f.read()).decode('utf-8')
        os.remove(zip_name)

    # 3. Upload to Firestore Vault
    print("[VAULT] Sending identity to Cloud Firestore...")
    db.collection('settings').document('facebook_identity').set({
        'cookies': cookies,
        'session_zip': session_payload,
        'deployed_at': firestore.SERVER_TIMESTAMP,
        'source_pc': os.environ.get('COMPUTERNAME', 'Unknown-PC')
    })
    
    print("\n✅ MISSION SUCCESS: Lean identity is now live in the Cloud Vault.")

if __name__ == "__main__":
    package_identity()
