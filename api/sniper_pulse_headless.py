import time
import requests
import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime

# [v103.0] HEADLESS SNIPER PULSE
# This script monitors your Firestore alerts and dispatches missions to the Local Node.

def boot_pulse():
    print(f"--- [SNIPER PULSE] Initialized at {datetime.now().strftime('%H:%M:%S')} ---")
    
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
    
    print("[ACTIVE] Monitoring Sea Point and high-fidelity targets...")

    while True:
        try:
            # 1. Fetch Active Alerts
            docs = db.collection('alerts').where('enabled', '==', True).stream()
            alerts = [d.to_dict() for d in docs]
            
            if not alerts:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] No active alerts found. Sleeping...")
            
            for alert in alerts:
                query = alert.get('query')
                user_id = alert.get('user_id', 'taun_user') # Fallback
                
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [PULSE] Dispatching Discovery mission for '{query}'...")
                
                # 🎯 TRIGGER LOCAL NODE (Extraction Server)
                try:
                    response = requests.post("http://localhost:8000/trigger-snipe", json={
                        "query": query,
                        "user_id": user_id,
                        "source_ids": None # Use zonal filters
                    }, timeout=5)
                    
                    if response.status_code == 200:
                        print(f"  - [SUCCESS] Local Node dispatched task: {response.json().get('task_id')}")
                    else:
                        print(f"  - [FAILED] Local Node rejected task: {response.status_code}")
                except Exception as node_err:
                    print(f"  - [ERROR] Could not reach Local Node (uvicorn main_local:app --port 8000). Ensure it is running.")

            # 2. Wait for next pulse cycle (e.g. 5 minutes)
            time.sleep(300) 

        except Exception as e:
            print(f"[CRITICAL] Pulse Error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    boot_pulse()
