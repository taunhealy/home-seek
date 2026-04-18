import firebase_admin
from firebase_admin import credentials, firestore
import os

def scan_all_collections():
    possible_paths = [
        'service-account.json',
        os.path.join(os.path.dirname(__file__), '..', 'service-account.json'),
        os.path.join(os.getcwd(), 'service-account.json'),
        '../service-account.json'
    ]
    creds_path = None
    for p in possible_paths:
        if os.path.exists(p):
            creds_path = p
            break
            
    if not creds_path:
        print("No keys found.")
        return

    try:
        cred = credentials.Certificate(creds_path)
        firebase_admin.initialize_app(cred)
    except: pass
    
    db = firestore.client()
    print(f"--- Global Scan for Project: {db.project} ---")
    
    collections = db.collections()
    found_any = False
    for coll in collections:
        found_any = True
        # Get a sample doc to see count/fields
        docs = coll.limit(1).get()
        print(f"Collection: [{coll.id}] | Active: YES | Sample Docs: {'Yes' if len(docs)>0 else 'No'}")
        
        # If it's users, let's look for subcollections
        if coll.id == "users":
            user_docs = coll.stream()
            for ud in user_docs:
                print(f"  -> User: {ud.id}")
                subs = ud.reference.collections()
                for s in subs:
                    print(f"     -> Sub-collection: {s.id}")

    if not found_any:
        print("No collections found in this project.")

if __name__ == "__main__":
    scan_all_collections()
