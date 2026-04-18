import firebase_admin
from firebase_admin import credentials, firestore
import os

def heal_links():
    # Load credentials
    cred_path = 'service-account.json'
    if not os.path.exists(cred_path):
        cred_path = os.path.join(os.path.dirname(__file__), 'service-account.json')
    
    if not os.path.exists(cred_path):
        print("Error: service-account.json not found.")
        return

    cred = credentials.Certificate(cred_path)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    
    # 🩹 TARGET: any listing with a placeholder URL
    placeholders = ['https://example.com/missing_url', 'missing_url', 'N/A']
    
    count = 0
    for p in placeholders:
        docs = db.collection('listings').where('source_url', '==', p).stream()
        for d in docs:
            d.reference.update({
                'source_url': 'https://www.facebook.com/groups/158733218125929/' # Group fallback
            })
            count += 1
            
    print(f"--- HEAL COMPLETE ---")
    print(f"🩹 Healed {count} broken links across the marketplace.")

if __name__ == "__main__":
    heal_links()
