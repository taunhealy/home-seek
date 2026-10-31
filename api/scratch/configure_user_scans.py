import sys
import datetime as dt
sys.path.append('api')
from main import get_db

db = get_db()
user_ids = ['taun_test_user', 'R4R2k7z2XAQGgRjB57ctZcOkEbp2']

city_bowl_anchors = [
    {
        "id": "anchor-kloof",
        "label": "Kloof Street Cafes & Dining",
        "target_place": "Kloof Street, Gardens",
        "commute_mode": "walking",
        "max_commute_mins": 15,
        "max_distance_km": 1.5,
        "lat": -33.9315,
        "lng": 18.4105
    },
    {
        "id": "anchor-mtb",
        "label": "Table Mountain MTB Trails",
        "target_place": "Deer Park, Table Mountain",
        "commute_mode": "bicycling",
        "max_commute_mins": 15,
        "max_distance_km": 3.0,
        "lat": -33.9420,
        "lng": 18.4280
    },
    {
        "id": "anchor-cbd",
        "label": "Cape Town CBD",
        "target_place": "Cape Town CBD",
        "commute_mode": "driving",
        "max_commute_mins": 15,
        "max_distance_km": 5.0,
        "lat": -33.9249,
        "lng": 18.4241
    }
]

atlantic_anchors = [
    {
        "id": "anchor-promenade",
        "label": "Sea Point Promenade",
        "target_place": "Sea Point Promenade, Beach Road",
        "commute_mode": "walking",
        "max_commute_mins": 10,
        "max_distance_km": 1.0,
        "lat": -33.9165,
        "lng": 18.3880
    },
    {
        "id": "anchor-gp-park",
        "label": "Green Point Urban Park & Virgin Active",
        "target_place": "Green Point Urban Park, Bill Peters Dr",
        "commute_mode": "bicycling",
        "max_commute_mins": 10,
        "max_distance_km": 2.5,
        "lat": -33.9050,
        "lng": 18.4050
    },
    {
        "id": "anchor-kloof-commute",
        "label": "Kloof Street Cafes",
        "target_place": "Kloof Street, Gardens",
        "commute_mode": "driving",
        "max_commute_mins": 15,
        "max_distance_km": 8.0,
        "lat": -33.9315,
        "lng": 18.4105
    }
]

common_tastes = (
    "Acoustic privacy for music, carrying mountain bike to apartment (too many stairs are a deal breaker as I bike often), "
    "easy walk to lively cafes, decent natural light, low street noise, secure parking."
)
common_prompt = (
    "Remote web designer working from home. I enjoy mountain biking, trail running, walking on the beach, "
    "flying my FPV drone, and working from a cafe twice a week. I'd like to date and have spontaneous chats with interesting people, "
    "occasionally have a friend over, and listen to/make music."
)

for uid in user_ids:
    print(f"Configuring scans for {uid}...")
    user_ref = db.collection('users').document(uid)
    
    # 1. Delete old / duplicate alerts
    existing_alerts = list(user_ref.collection('alerts').stream())
    for a in existing_alerts:
        if a.id not in ['alert_tamboerskloof_gardens', 'alert_greenpoint_seapoint']:
            print(f"  Removing legacy alert: {a.id}")
            user_ref.collection('alerts').document(a.id).delete()

    # 2. Configure Scan 1: Tamboerskloof & Gardens
    scan_1_data = {
        "id": "alert_tamboerskloof_gardens",
        "name": "Tamboerskloof & Gardens",
        "search_query": "AI Radar: Tamboerskloof & Gardens (1+ Beds, max R18,000)",
        "target_area": "Gardens",
        "areas": ["Tamboerskloof", "Gardens"],
        "max_price": 18000,
        "min_price": 12000,
        "min_bedrooms": [1],
        "property_type": "Apartment",
        "personal_tastes": common_tastes,
        "prompt": common_prompt,
        "exclude_landlord_on_site": True,
        "exclude_shared_house": True,
        "require_independent_living": True,
        "require_private_entrance": True,
        "location_anchors": city_bowl_anchors,
        "commute_anchors": city_bowl_anchors,
        "is_active": True,
        "alert_enabled": True,
        "trigger_initial_scan": True,
        "updated_at": dt.datetime.now(dt.timezone.utc)
    }
    user_ref.collection('alerts').document('alert_tamboerskloof_gardens').set(scan_1_data)
    print("  Saved Scan 1: Tamboerskloof & Gardens")

    # 3. Configure Scan 2: Green Point & Sea Point
    scan_2_data = {
        "id": "alert_greenpoint_seapoint",
        "name": "Green Point & Sea Point",
        "search_query": "AI Radar: Green Point & Sea Point (1+ Beds, max R18,000)",
        "target_area": "Green Point",
        "areas": ["Green Point", "Sea Point"],
        "max_price": 18000,
        "min_price": 12000,
        "min_bedrooms": [1],
        "property_type": "Apartment",
        "personal_tastes": common_tastes,
        "prompt": common_prompt,
        "exclude_landlord_on_site": True,
        "exclude_shared_house": True,
        "require_independent_living": True,
        "require_private_entrance": True,
        "location_anchors": atlantic_anchors,
        "commute_anchors": atlantic_anchors,
        "is_active": True,
        "alert_enabled": True,
        "trigger_initial_scan": True,
        "updated_at": dt.datetime.now(dt.timezone.utc)
    }
    user_ref.collection('alerts').document('alert_greenpoint_seapoint').set(scan_2_data)
    print("  Saved Scan 2: Green Point & Sea Point")

print("SUCCESS: Configured exactly 2 dedicated scans in Firestore!")

