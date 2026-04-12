import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

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
        {"name": "Property24", "url": "https://www.property24.com/to-rent/cape-town/western-cape/432"},
        {"name": "Private Property", "url": "https://www.privateproperty.co.za/to-rent/western-cape/cape-town/1"},
        {"name": "Facebook Marketplace", "url": "https://www.facebook.com/marketplace/capetown/propertyrentals"},
        {"name": "Gumtree", "url": "https://www.gumtree.co.za/s-property-to-rent/cape-town/v1c2l3100001p1"}
    ]

    print("Seeding default sources for demo-user...")
    
    for source in defaults:
        source_data = {
            **source,
            "user_id": "demo-user",
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        # Check if exists first to avoid duplicates
        existing = db.collection('sources') \
                     .where('user_id', '==', 'demo-user') \
                     .where('url', '==', source['url']) \
                     .get()
        
        if not existing:
            db.collection('sources').add(source_data)
            print(f"✅ Added: {source['name']}")
        else:
            print(f"⏭️  Skipping (already exists): {source['name']}")

if __name__ == "__main__":
    seed_default_sources()
