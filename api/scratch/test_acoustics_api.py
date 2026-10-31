import urllib.request
import json
import time

time.sleep(1.5)
try:
    req = urllib.request.urlopen("http://localhost:8000/api/acoustics/hotspots", timeout=5)
    data = json.loads(req.read())
    print("SUCCESS: Endpoint responded. Hotspots:", len(data.get("hotspots", [])), "Sanctuaries:", len(data.get("sanctuary_zones", [])))
except Exception as e:
    print("API Error:", e)

