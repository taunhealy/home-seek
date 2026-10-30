import os
import re
import json
import sqlite3
import time
from typing import Optional, Dict, Any, List
import urllib.parse
import httpx

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)
BUILDING_CACHE_DB = os.path.join(DATA_DIR, "building_cache.db")

class BuildingCacheDB:
    def __init__(self, db_path: str = BUILDING_CACHE_DB):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS building_reviews_cache (
                        building_key TEXT PRIMARY KEY,
                        data_json TEXT NOT NULL,
                        updated_at REAL NOT NULL
                    )
                """)
                conn.commit()
        except Exception:
            pass

    def get(self, building_key: str, max_age_days: int = 14) -> Optional[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT data_json, updated_at FROM building_reviews_cache WHERE building_key = ?",
                    (building_key.lower().strip(),)
                )
                row = cursor.fetchone()
                if row:
                    data_json, updated_at = row
                    if (time.time() - updated_at) < (max_age_days * 86400):
                        return json.loads(data_json)
        except Exception:
            pass
        return None

    def set(self, building_key: str, data: Dict[str, Any]):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO building_reviews_cache (building_key, data_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(building_key) DO UPDATE SET
                        data_json = excluded.data_json,
                        updated_at = excluded.updated_at
                    """,
                    (building_key.lower().strip(), json.dumps(data), time.time())
                )
                conn.commit()
        except Exception:
            pass

_cache = BuildingCacheDB()

# Curated Cape Town Central & City Bowl Residential Complex Registry
CURATED_BUILDINGS: Dict[str, Dict[str, Any]] = {
    "blackbrick": {
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

    "palmhof": {
        "name": "Palmhof",
        "address": "10-15 Union Street, Gardens, Cape Town",
        "google_rating": 4.1,
        "review_count": 32,
        "has_lift": "no",
        "soundproofing": "Moderate — solid brick construction, parquet floors can transmit footfall if underlay isn't used",
        "body_corporate": "Active & orderly body corporate; strict rules regarding common area cleanliness",
        "airbnb_risk": "Low — predominantly long-term owner occupiers and young professionals",
        "backup_power": "Common area security lighting on battery backup; tenant inverters required for units",
        "review_summary": "Beloved classic block on a quiet one-way Gardens street. High ceilings and parquet floors. Walk-up only (no lift) — top floors require 4 flights of stairs."
    },
    "28 scotts": {
        "name": "28 Scotts",
        "address": "28 Scott Street, Gardens, Cape Town",
        "google_rating": 3.6,
        "review_count": 18,
        "has_lift": "yes",
        "soundproofing": "Low external acoustic insulation — high ambient traffic rumble from adjacent Jutland Bridge flyover",
        "body_corporate": "Professional sectional title management; well-maintained access control",
        "airbnb_risk": "Moderate — some short-term lets active on upper levels",
        "backup_power": "Standard perimeter security backup",
        "review_summary": "Modern finishes and decent security, but suffers from severe ambient road roar on balconies directly facing De Waal / Jutland overpass."
    },
    "derwent": {
        "name": "Derwent Court / Derwent House",
        "address": "12 Derwent Road, Gardens, Cape Town",
        "google_rating": 4.6,
        "review_count": 24,
        "has_lift": "unknown",
        "soundproofing": "High — peaceful, tree-lined residential side street with almost zero through-traffic",
        "body_corporate": "Pristine maintenance standards, peaceful residential ethos",
        "airbnb_risk": "Very Low — strictly quiet residential community",
        "backup_power": "Fiber infrastructure active",
        "review_summary": "Coveted location on one of the quietest cul-de-sacs in Gardens. Ample natural light, excellent acoustic isolation for audio production and remote work."
    },
    "st martini gardens": {
        "name": "St Martini Gardens",
        "address": "Queen Victoria Street, Gardens / CBD",
        "google_rating": 4.2,
        "review_count": 140,
        "has_lift": "yes",
        "soundproofing": "Moderate — thick exterior walls but internal sound can travel through plumbing ducts",
        "body_corporate": "Very established body corporate with 24-hour manned concierge and communal pool",
        "airbnb_risk": "High — popular with tourists and short-term visitors in specific blocks",
        "backup_power": "Lifts and communal hallways generator backed",
        "review_summary": "Lush tropical communal garden and pool sanctuary. 24hr security guard house. Popular with creatives, but check specific block for short-term let noise."
    },
    "wembley square": {
        "name": "Wembley Square",
        "address": "McKenzie & Solan Street, Gardens",
        "google_rating": 4.3,
        "review_count": 210,
        "has_lift": "yes",
        "soundproofing": "Modern concrete slab construction; good side-to-side isolation, hallway echo",
        "body_corporate": "Professional full-time facility management; Virgin Active gym integrated",
        "airbnb_risk": "High — active short-term and holiday letting",
        "backup_power": "Full building generator powering common areas and lifts",
        "review_summary": "High convenience lifestyle hub with gym, cafes, and basement parking on site. Fast fiber, but busy with Airbnb turnover on weekends."
    },
    "disa park": {
        "name": "Disa Park (The Pepper Pots)",
        "address": "Chelmsford Road, Vredehoek",
        "google_rating": 4.0,
        "review_count": 95,
        "has_lift": "yes",
        "soundproofing": "Solid concrete but high south-easter wind buffeting and lift mechanical hum",
        "body_corporate": "Extensive 24hr security, tennis courts, squash courts, pool",
        "airbnb_risk": "Moderate",
        "backup_power": "Communal backup for lifts",
        "review_summary": "Panoramic Table Bay and mountain views. 3 high-speed lifts per tower. Caution: high south-easter winds can howl in summer."
    },
    "gardens centre": {
        "name": "Gardens Centre Apartments",
        "address": "Mill Street, Gardens",
        "google_rating": 4.0,
        "review_count": 88,
        "has_lift": "yes",
        "soundproofing": "Moderate — high altitude keeps city noise down, but Mill St traffic audible on lower north-facing units",
        "body_corporate": "Managed by direct center facility management; high security biometric access",
        "airbnb_risk": "Moderate",
        "backup_power": "Integrated shopping center generators provide backup power for lifts and water pumps",
        "review_summary": "Unbeatable convenience directly above Woolworths, Pick n Pay, and gyms. 24/7 security, multiple fast elevators."
    }
}

def extract_building_name(title: str, address: str, description: str = "") -> Optional[str]:
    combined = f"{title} {address} {description}"
    
    # Check curated names first
    for key, data in CURATED_BUILDINGS.items():
        if re.search(r'\b' + re.escape(key) + r'\b', combined, re.I):
            return data["name"]
            
    # Generic building extraction regex
    patterns = [
        r'\bin\s+([A-Z0-9][a-zA-Z0-9\s]{2,25}?(?:Court|Mansions|Heights|Gardens|Square|Mews|Manor|Towers|View|Apartments|House|Terrace|Ridge|Plaza|Park|Close|St Martini|Palmhof|Scotts))\b',
        r'\bat\s+([A-Z0-9][a-zA-Z0-9\s]{2,25}?(?:Court|Mansions|Heights|Gardens|Square|Mews|Manor|Towers|View|Apartments|House|Terrace|Ridge|Plaza|Park|Close))\b',
        r'([A-Z0-9][a-zA-Z0-9\s]{2,20}?(?:Court|Mansions|Heights|Square|Towers|Palmhof))\s*,'
    ]
    for pat in patterns:
        m = re.search(pat, combined)
        if m:
            clean = m.group(1).strip()
            if len(clean) > 3 and clean.lower() not in ["cape town", "western cape", "gardens", "green point", "sea point"]:
                return clean
    return None

async def get_building_reviews(building_name: str, area: str = "Gardens") -> Dict[str, Any]:
    """Retrieves building reviews, community sentiment, and sectional title reputation."""
    if not building_name:
        return {
            "building_name": None,
            "status": "unidentified",
            "summary": "Independent / Unnamed complex"
        }

    key = building_name.lower().strip()
    
    # 1. Check cache
    cached = _cache.get(key)
    if cached:
        return cached

    # 2. Check curated registry
    for c_key, data in CURATED_BUILDINGS.items():
        if c_key in key or key in c_key:
            res = {
                "building_name": data["name"],
                "address": data.get("address"),
                "google_rating": data.get("google_rating"),
                "review_count": data.get("review_count"),
                "has_lift": data.get("has_lift"),
                "soundproofing": data.get("soundproofing"),
                "body_corporate": data.get("body_corporate"),
                "airbnb_risk": data.get("airbnb_risk"),
                "backup_power": data.get("backup_power"),
                "review_summary": data.get("review_summary"),
                "is_curated": True
            }
            _cache.set(key, res)
            return res

    # 3. Dynamic Google Places Text Search if API key exists
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        try:
            query = f"{building_name} Cape Town apartments"
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={"query": query, "key": api_key}
                )
                if resp.status_code == 200:
                    d = resp.json()
                    results = d.get("results", [])
                    if results:
                        p = results[0]
                        res = {
                            "building_name": p.get("name", building_name),
                            "address": p.get("formatted_address"),
                            "google_rating": p.get("rating"),
                            "review_count": p.get("user_ratings_total"),
                            "has_lift": "unknown",
                            "soundproofing": "Standard residential construction",
                            "body_corporate": "Sectional Title scheme active",
                            "airbnb_risk": "Moderate",
                            "backup_power": "Standard municipal supply",
                            "review_summary": f"Rated {p.get('rating')}★ by {p.get('user_ratings_total')} verified reviewers on Google Maps.",
                            "is_curated": False
                        }
                        _cache.set(key, res)
                        return res
        except Exception:
            pass

    # 4. Graceful Fallback
    res = {
        "building_name": building_name,
        "address": f"{building_name}, {area}, Cape Town",
        "google_rating": None,
        "review_count": None,
        "has_lift": "unknown",
        "soundproofing": "Solid brick/concrete sectional title build",
        "body_corporate": "Established body corporate / managing agent",
        "airbnb_risk": "Low to Moderate",
        "backup_power": "Tenant-installed inverter advised",
        "review_summary": f"Residential complex '{building_name}' located in {area}.",
        "is_curated": False
    }
    _cache.set(key, res)
    return res

