import firebase_admin
from firebase_admin import credentials, firestore
import base64
import os

# Initialize
cred = credentials.Certificate('service-account.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

# Get latest 1 task that HAS a screenshot
docs = db.collection('tasks').order_by('created_at', direction='DESCENDING').limit(10).stream()

for doc in docs:
    d = doc.to_dict()
    shot = d.get('landing_screenshot') or d.get('last_screenshot')
    if shot and 'base64,' in shot:
        print(f"Found screenshot in task: {doc.id}")
        img_data = shot.split('base64,')[1]
        
        # Ensure artifacts dir exists
        os.makedirs('artifacts', exist_ok=True)
        
        with open(f"artifacts/latest_forensic_{doc.id}.jpg", "wb") as f:
            f.write(base64.b64decode(img_data))
        print(f"SUCCESS: Saved to artifacts/latest_forensic_{doc.id}.jpg")
        break
else:
    print("No screenshots found in latest 10 tasks.")
