import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

# [STABILITY] Ensure Firestore doesn't try to use the Scraping Proxy
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

def seed_default_sources():
    # Initialize Firebase
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not firebase_admin._apps:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print("FIREBASE_SERVICE_ACCOUNT_PATH not found or invalid.")
            return

    db = firestore.client()
    
    defaults = [
        {"name": "Property24", "url": "https://www.property24.com/to-rent/cape-town/western-cape/432", "type": "long-term"},
        {"name": "Property24 Pet Friendly", "url": "https://www.property24.com/to-rent/cape-town/western-cape/432/pet-friendly", "type": "long-term"},
        {"name": "Huis Huis (Short Term)", "url": "https://www.facebook.com/groups/158733218125929/", "type": "short-term"},
        {"name": "Sea Point Rentals (Short Term)", "url": "https://www.facebook.com/groups/seapointrentals", "type": "short-term"},
        {"name": "RentUncle", "url": "https://www.gumtree.co.za/s-property-to-rent/cape-town/v1c2l3100001p1", "type": "long-term"},
    ]

    print("Seeding default sources for demo-user...")
    
    for source in defaults:
        source_data = {
            **source,
            "user_id": "demo-user",
            "enabled": True,
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        # Check if exists first to avoid duplicates
        existing = db.collection('sources') \
                     .where('user_id', '==', 'demo-user') \
                     .where('url', '==', source['url']) \
                     .get()
        
        if not existing:
            db.collection('sources').add(source_data)
            print(f"[ADDED] {source['name']}")
        else:
            print(f"[SKIPPING] {source['name']} (already exists)")

if __name__ == "__main__":
    seed_default_sources()
