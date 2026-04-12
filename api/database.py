import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

def get_db():
    # To use this in production, the user needs to provide a service account JSON
    # Path should be in GOOGLE_APPLICATION_CREDENTIALS
    
    if not firebase_admin._apps:
        # Check if environment variable for path exists
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback for local dev/testing if possible, or just fail gracefully
            print("FIREBASE_SERVICE_ACCOUNT_PATH not found. Firestore will be disabled.")
            return None
            
    return firestore.client()

async def save_listing(listing_dict: dict):
    db = get_db()
    if not db:
        print("Mock Saving:", listing_dict['title'])
        return
        
    # Add timestamp
    listing_dict['timestamp'] = firestore.SERVER_TIMESTAMP
    
    # Add to 'listings' collection
    db.collection('listings').add(listing_dict)
    print(f"Saved listing: {listing_dict['title']}")

async def get_sources(user_id: str = "demo-user"):
    db = get_db()
    if not db:
        # Hardcoded Fallback for testing/offline mode
        return [
            {"name": "Property24", "url": "https://www.property24.com/to-rent/claremont/cape-town/9143"},
            {"name": "Facebook", "url": "https://www.facebook.com/marketplace/capetown/propertyrentals"}
        ]
    
    try:
        docs = db.collection('sources').where('user_id', '==', user_id).stream()
        results = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        
        # If DB is connected but empty, still provide defaults
        return results if results else [
            {"name": "Property24", "url": "https://www.property24.com/to-rent/claremont/cape-town/9143"},
            {"name": "Facebook", "url": "https://www.facebook.com/marketplace/capetown/propertyrentals"}
        ]
    except Exception as e:
        print(f"Firestore Error: {e}")
        return [{"name": "Property24", "url": "https://www.property24.com/to-rent/claremont/cape-town/9143"}]

async def get_user_profile(user_id: str):
    db = get_db()
    if not db:
        # Development fallback profile
        return {
            "uid": user_id,
            "email": "demo@example.com",
            "tier": "paid",
            "whatsapp": "27721234567"
        }
    
    try:
        doc = db.collection('users').document(user_id).get()
        if doc.exists:
            return doc.to_dict()
    except Exception:
        pass
    
    return {
        "uid": user_id,
        "email": "demo@example.com",
        "tier": "paid",
        "whatsapp": "27721234567"
    }

def create_task(user_id: str, query: str):
    db = get_db()
    if not db:
        print("Mock Task Created:", query)
        return "mock-task-id"
    
    task_ref = db.collection('tasks').document()
    task_ref.set({
        "user_id": user_id,
        "query": query,
        "status": "Starting...",
        "logs": ["🚀 Initializing Sniper Engine..."],
        "timestamp": firestore.SERVER_TIMESTAMP,
        "completed": False
    })
    return task_ref.id

def update_task(task_id: str, status: str, log_entry: str = None, completed: bool = False):
    db = get_db()
    if not db:
        if log_entry: print(f"Mock Log [{status}]: {log_entry}")
        return
    
    task_ref = db.collection('tasks').document(task_id)
    updates = {"status": status, "completed": completed}
    if log_entry:
        updates["logs"] = firestore.ArrayUnion([log_entry])
    
    task_ref.update(updates)
