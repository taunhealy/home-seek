
import requests
import sys

# [KICK-START] THE KICK-START TOOL (v24.3)
# Forces the Local Elite Node to instantly start an autonomous sniper pulse.

URL = "http://localhost:8000/force-pulse"

def trigger():
    print("[TEST] Sending Manual Overdrive signal to Local Elite Node...")
    try:
        response = requests.post(URL)
        if response.status_code == 200:
            print("[SUCCESS] Pulse signal received! Check your Local Node terminal to watch the hunt.")
        else:
            print(f"[FAILED] Server responded with status {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Could not connect to Local Node. Is 'main_local.py' running?\n({e})")

if __name__ == "__main__":
    trigger()
