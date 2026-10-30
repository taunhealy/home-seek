import sys, re, urllib.request
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db

db = get_db()
docs = list(db.collection("users").document("taun_test_user").collection("reports").stream())
if not docs:
    print("No reports found")
    sys.exit(0)

listings = docs[0].to_dict().get("ranked_listings", [])

def extract_floor_and_lift(html_text: str, title: str = "", address: str = ""):
    combined = (title + " " + address + " " + html_text).lower()
    
    # 1. Floor Level
    floor = None
    if re.search(r'\bground\s*floor\b|\bground\s*level\b', combined):
        floor = "Ground Floor"
    elif re.search(r'\b1st\s*floor\b|\bfirst\s*floor\b', combined):
        floor = "1st Floor"
    elif re.search(r'\b2nd\s*floor\b|\bsecond\s*floor\b', combined):
        floor = "2nd Floor"
    elif re.search(r'\b3rd\s*floor\b|\bthird\s*floor\b', combined):
        floor = "3rd Floor"
    elif re.search(r'\b4th\s*floor\b|\bfourth\s*floor\b', combined):
        floor = "4th Floor"
    elif re.search(r'\btop\s*floor\b|\bpenthouse\b', combined):
        floor = "Top Floor"
    elif m := re.search(r'\b(\d+)(?:st|nd|rd|th)\s*floor\b', combined):
        floor = f"{m.group(1)}th Floor"
        
    # 2. Lift / Elevator
    lift = "unknown"
    if floor == "Ground Floor":
        lift = "N/A (Ground)"
    elif any(k in combined for k in ["lift in building", "elevator access", "with lift", "has a lift", "serviced by a lift", "elevator in building", "lifts in block"]):
        lift = "yes"
    elif any(k in combined for k in ["no lift", "stairs only", "walk-up", "walk up", "stair access only"]):
        lift = "no"
    elif floor in ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "Top Floor"]:
        # If older Art Deco / heritage without lift mention
        if "lift" in combined or "elevator" in combined:
            lift = "yes"
        else:
            lift = "unknown"

    # 3. Building / Complex Name
    building_name = None
    # Check title or address
    b_match = re.search(r'\bin\s+([A-Z0-9][a-zA-Z0-9\s]{2,30}?(?:Court|Mansions|Heights|Gardens|Square|Mews|Manor|Towers|View|Apartments|House|Terrace|Ridge|Plaza|Park|Close|St Martini|Scotts|Derwent))\b', title + " " + address, re.I)
    if b_match:
        building_name = b_match.group(1).strip()
    elif "28 scotts" in combined or "28 scott" in combined:
        building_name = "28 Scotts"
    elif "st martini" in combined:
        building_name = "St Martini Gardens"
    elif "wembley square" in combined:
        building_name = "Wembley Square"
    elif "derwent" in combined:
        building_name = "Derwent Court"

    return floor, lift, building_name

for l in listings[:6]:
    url = l.get("url")
    print(f"\n--- Checking #{l.get('rank')}: {l.get('listing_id')} ---")
    print(f"Title: {l.get('title')}")
    print(f"Address: {l.get('address')}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.property24.com/"})
        html = urllib.request.urlopen(req, timeout=5).read().decode("utf-8", errors="ignore")
        fl, lf, bldg = extract_floor_and_lift(html, l.get('title', ''), l.get('address', ''))
        print(f"-> Extracted: Floor: {fl} | Lift: {lf} | Building: {bldg}")
    except Exception as e:
        print(f"Fetch failed: {e}")

