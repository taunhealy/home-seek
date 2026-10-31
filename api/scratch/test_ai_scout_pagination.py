import sys
sys.path.append('api')
from services.ai_scout import scrape_portal_listings

print("Testing scrape_portal_listings for Gardens...")
listings = scrape_portal_listings("Gardens", max_price=18000, min_bedrooms=1)
print(f"Total listings fetched: {len(listings)}")

found = [l for l in listings if '117772253' in str(l.get('id')) or '117772253' in str(l.get('url'))]
print("Found 117772253?", bool(found))
if found:
    print("Found listing details:", found[0])

