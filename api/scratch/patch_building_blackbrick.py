with open("c:/Ryoko/Projects/home-seek/api/services/building_reviews.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add blackbrick to CURATED_BUILDINGS
blackbrick_entry = '''    "blackbrick": {
        "name": "BlackBrick Gardens (Apartment Hotel)",
        "address": "Gardens, Cape Town",
        "google_rating": 4.4,
        "review_count": 86,
        "has_lift": "yes",
        "soundproofing": "Modern concrete hotel build with double glazing, but susceptible to corridor footfall and transient guest door slams",
        "body_corporate": "Managed by BlackBrick Hospitality Group; digital concierge, high-touch hotel service",
        "airbnb_risk": "Very High — operates as a hybrid design-led apartment hotel with heavy short-term tourist and business guest turnover",
        "backup_power": "Full industrial generator backup — 100% load shedding proof across units, co-working, and lifts",
        "review_summary": "Design-led apartment hotel with exceptional shared amenities (Rosetta Roastery, rooftop restaurant/pool, co-working spaces, Pilates studio). Perfect for lock-up-and-go remote workers, but high hotel guest turnover, lack of dedicated sports gear storage, and weekend rooftop social noise make it less suited for quiet long-term residential isolation."
    },
'''

content = content.replace('CURATED_BUILDINGS: Dict[str, Dict[str, Any]] = {', 'CURATED_BUILDINGS: Dict[str, Dict[str, Any]] = {\n' + blackbrick_entry, 1)

# Ensure extract_building_name prioritizes blackbrick
if "blackbrick" not in content.lower():
    print("Warning: blackbrick string check")

with open("c:/Ryoko/Projects/home-seek/api/services/building_reviews.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated building_reviews.py with BlackBrick Gardens!")

