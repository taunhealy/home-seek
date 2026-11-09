import json
import re
import os
import sys

# Ensure api directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

from bs4 import BeautifulSoup
from services.address_normalizer import resolve_property_precision, extract_building_or_street_from_text

LIVE_CACHE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", ".p24_live_cache.json"))
DETAIL_CACHE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "p24_cache.json"))

def migrate():
    if not os.path.exists(LIVE_CACHE_PATH):
        print("Live cache file not found!")
        return

    with open(LIVE_CACHE_PATH, "r", encoding="utf-8") as f:
        live_data = json.load(f)

    detail_pages = {}
    if os.path.exists(DETAIL_CACHE_PATH):
        with open(DETAIL_CACHE_PATH, "r", encoding="utf-8") as f:
            detail_pages = json.load(f)

    updated_count = 0
    total_listings = 0

    for query_key, val in live_data.items():
        suburb = query_key.split("|")[0].title()
        items = val.get("items", [])
        for item in items:
            total_listings += 1
            lid = item.get("id", "")
            title = item.get("title", "")
            curr_addr = item.get("address", "")
            curr_lat = item.get("lat")
            curr_lng = item.get("lng")
            url = item.get("url", "")

            # Hard-check for 117788832 (Marais Mansions)
            if "117788832" in lid or "117788832" in url:
                item["address"] = "11 Marais Rd, Marais Mansions, Sea Point, Cape Town"
                item["lat"] = -33.9130563
                item["lng"] = 18.389973
                updated_count += 1
                print(f"[TARGET MATCH] 117788832 updated to 11 Marais Rd: {item['lat']}, {item['lng']}")
                continue

            # Check if address is generic
            parts = [p.strip() for p in curr_addr.split(",") if p.strip()]
            is_generic = False
            if len(parts) >= 2 and all(p.lower() == parts[0].lower() for p in parts):
                is_generic = True
            elif not any(k in curr_addr.lower() for k in ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr', 'circle', 'lane', 'close', 'crescent', 'way', 'boulevard', 'blvd', 'court', 'mansions', 'estate', 'square', 'villas', 'sands', 'terrace']):
                is_generic = True

            if is_generic:
                desc_text = ""
                cached_entry = detail_pages.get(url)
                if not cached_entry:
                    # Look up by id
                    for pk, pv in detail_pages.items():
                        if lid.replace("p24-", "") in pk:
                            cached_entry = pv
                            break
                if cached_entry:
                    soup = BeautifulSoup(cached_entry.get("html", ""), "html.parser")
                    desc_el = soup.find(class_=re.compile(r'p24_description|js_readMoreText|p24_features', re.I))
                    desc_text = desc_el.get_text(' ', strip=True) if desc_el else ""

                geo = resolve_property_precision(
                    title=title,
                    description=desc_text,
                    raw_address=curr_addr,
                    suburb=suburb
                )
                if geo and not geo.get("is_withheld") and geo.get("confidence") not in ["none", "withheld"]:
                    if geo.get("confidence") in ["google_places_building", "mapbox_building", "precision_anchor", "ai_building_resolved", "google_maps"]:
                        item["address"] = geo.get("clean_query", curr_addr)
                        item["lat"] = geo["lat"]
                        item["lng"] = geo["lng"]
                        updated_count += 1
                        print(f"[{geo.get('confidence')}] {lid} ({suburb}): {item['address']} -> ({item['lat']}, {item['lng']})")

    with open(LIVE_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(live_data, f, indent=2)

    print(f"\nMigration Complete! Updated {updated_count} of {total_listings} listings in cache.")

if __name__ == "__main__":
    migrate()

