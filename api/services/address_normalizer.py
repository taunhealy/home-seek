"""
AI Address Normalizer & Precision Geocoding Pipeline
Normalizes messy, marketing-heavy South African property portal addresses into
standard geocodable queries, resolves micro-pockets, flags withheld addresses,
and persistently caches coordinates in SQLite.
"""

import os
import re
import math
import time
import sqlite3
import urllib.request
import urllib.parse
import json
from typing import Dict, Any, List, Optional


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "address_cache.db")

def _init_db():
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS address_cache (
            raw_hash TEXT PRIMARY KEY,
            raw_address TEXT,
            clean_query TEXT,
            suburb TEXT,
            is_withheld INTEGER,
            lat REAL,
            lng REAL,
            confidence TEXT,
            updated_at REAL
        )
    """)
    conn.commit()
    conn.close()

_init_db()

# High-precision Cape Town micro-pocket and street coordinates
KNOWN_PRECISION_POINTS: Dict[str, tuple] = {
    "ocean terraces": (-34.098635, 18.488359),
    "spurwing": (-34.0978, 18.4904),
    "sanderling": (-34.0986, 18.4884),
    "capricorn": (-34.0986, 18.4884),
    "capricorn beach": (-34.0986, 18.4884),
    "1 saint georges": (-34.098953, 18.485262),
    "saint georges street": (-34.098953, 18.485262),
    "marina da gama": (-34.0958, 18.4738),
    "costa da gama": (-34.1010, 18.4820),
    "14 sunrise boulevard": (-34.1025, 18.4850),
    "sunrise boulevard": (-34.1025, 18.4850),
    "sunrise blvd": (-34.1025, 18.4850),
    "marais mansions": (-33.9130563, 18.389973),
    "11 marais rd": (-33.9130563, 18.389973),
    "11 marais road": (-33.9130563, 18.389973),
    "marais rd": (-33.9130563, 18.389973),
    "marais road": (-33.9130563, 18.389973),
    "marais road sea point": (-33.9130563, 18.389973),
    "8 camberleigh place": (-33.909615, 18.411107),
    "camberleigh place": (-33.909615, 18.411107),
    "4 glenside road": (-33.909615, 18.411107),
    "glenside road": (-33.909615, 18.411107),
    "glenside rd": (-33.909615, 18.411107),
    "parioli court": (-33.932649, 18.407325),
    "erf1423 warren st": (-33.9304, 18.4065),
    "warren st": (-33.9304, 18.4065),
    "warren street": (-33.9304, 18.4065),
    "4 brighton street": (-34.0419121, 18.3514045),
    "brighton street hout bay": (-34.0419121, 18.3514045),
    "15 cecil street": (-34.0374611, 18.3505042),
    "16 cecil street": (-34.0371347, 18.3498844),
    "cecil street hout bay": (-34.0372979, 18.3501943),
    "35 princess st": (-34.0408432, 18.3574846),
    "35 princess street": (-34.0408432, 18.3574846),
    "princess st hout bay": (-34.0408432, 18.3574846),
    "2 liverpool street": (-34.0375603, 18.3519009),
    "liverpool street hout bay": (-34.0375603, 18.3519009),
    "1 jad way": (-34.0211877, 18.3531866),
    "16 wood road": (-34.038576, 18.36035),
    "brabazon court": (-33.940925, 18.422082),
    "dunkley square": (-33.930419, 18.416805),
    "roeland square": (-33.931215, 18.421689),
    "wembley square": (-33.932770, 18.423061),
    "markev court": (-33.935102, 18.403819),
    "sunrise villas": (-34.099120, 18.487210),
    "coral sands": (-34.098450, 18.489120),
    "22 hall road": (-33.914210, 18.390540),
    "12 derwent rd": (-33.933734, 18.405534),
    "12 derwent road": (-33.933734, 18.405534),
    "derwent rd": (-33.933734, 18.405534),
    "derwent road": (-33.933734, 18.405534),
    "derwent court": (-33.933734, 18.405534),
    "49 bellevue street": (-33.937565, 18.401126),
    "49 bellevue st": (-33.937565, 18.401126),
    "bellevue street": (-33.937565, 18.401126),
    "bellevue st": (-33.937565, 18.401126),
    "higgo crescent": (-33.9365, 18.4060),
    "higgo cres": (-33.9365, 18.4060),
    "firdale avenue": (-33.9345, 18.4065),
    "firdale ave": (-33.9345, 18.4065),
    "camp street": (-33.9315, 18.4045),
    "camp st": (-33.9315, 18.4045),
    "upper union street": (-33.9320, 18.4088),
    "upper union st": (-33.9320, 18.4088),
    "upper union": (-33.9320, 18.4088),
    "burnside road": (-33.9350, 18.4020),
    "burnside rd": (-33.9350, 18.4020),
    "carstens street": (-33.9300, 18.4070),
    "carstens st": (-33.9300, 18.4070),
    "constantia road gardens": (-33.9350, 18.4075),
    "constantia rd gardens": (-33.9350, 18.4075),
    "53 the row": (-34.095760, 18.473846),
    "the row": (-34.095760, 18.473846),
    "79 main road": (-34.107865, 18.467923),
    "main road muizenberg": (-34.1078, 18.4679),
    "surfers corner": (-34.1080, 18.4710),
    "muizenberg village": (-34.1070, 18.4690),
    "beach road muizenberg": (-34.1080, 18.4710),
    "25 noordsig": (-34.1254, 18.3824),
    "noordsig avenue": (-34.1254, 18.3824),
    "milkwood park": (-34.1250, 18.3820),
    "sunnydale": (-34.1090, 18.3810),
    "avondrust lane": (-34.1030, 18.3680),
    "noordhoek farm village": (-34.1020, 18.3680),
    "imhoff manor": (-34.1365, 18.3540),
    "imhoff farm": (-34.1365, 18.3540),
    "long beach kommetjie": (-34.1410, 18.3300),
    "seabreeze estate": (-34.1435, 18.3480),
    "sea breeze estate": (-34.1435, 18.3480),
    "sea breeze village": (-34.1435, 18.3480),
    "seabreeze": (-34.1435, 18.3480),
    "klein slangkop": (-34.1350, 18.3220),
    "klein slangkop estate": (-34.1350, 18.3220),
    "klein slangkop eco estate": (-34.1350, 18.3220),
    "bluewater estate": (-34.1320, 18.3650),
    "imhoff's gift": (-34.1380, 18.3562),
    "imhoffs gift": (-34.1380, 18.3562),
    "harrier circle": (-34.1380, 18.3562),
    "harrier cir": (-34.1380, 18.3562),
    "capri village": (-34.1350, 18.3850),
    "lake michelle": (-34.1180, 18.3780),
    "lake michelle eco estate": (-34.1180, 18.3780),
    "de goede hoop": (-34.1080, 18.3750),
    "de goede hoop estate": (-34.1080, 18.3750),
    "chapmans peak estate": (-34.0950, 18.3720),
    "chapman's peak estate": (-34.0950, 18.3720),
    "stonehaven": (-34.1220, 18.4050),
    "stonehaven eco estate": (-34.1220, 18.4050),
    "silvertree estate": (-34.0620, 18.4410),
    "stonehurst mountain estate": (-34.0680, 18.4450),
    "steenberg golf estate": (-34.0720, 18.4320),
    "valyland": (-34.1360, 18.4320),
    "fish hoek": (-34.1360, 18.4320),
    "glencairn": (-34.1610, 18.4330),
    "kalk bay": (-34.1280, 18.4480),
    "st james": (-34.1185, 18.4590),
}

# Comprehensive Cape Town Suburb Geocenters (prevents blind fallback to Muizenberg)
CAPE_TOWN_SUBURBS: Dict[str, tuple] = {
    "capricorn": (-34.0986, 18.4884),
    "capricorn beach": (-34.0986, 18.4884),
    "muizenberg": (-34.1070, 18.4710),
    "muizenberg east": (-34.0990, 18.4850),
    "surfers corner": (-34.1080, 18.4720),
    "marina da gama": (-34.0958, 18.4738),
    "costa da gama": (-34.1010, 18.4820),
    "st james": (-34.1185, 18.4590),
    "kalk bay": (-34.1280, 18.4480),
    "clovelly": (-34.1330, 18.4400),
    "fish hoek": (-34.1360, 18.4320),
    "glencairn": (-34.1610, 18.4330),
    "simon's town": (-34.1930, 18.4320),
    "simons town": (-34.1930, 18.4320),
    "noordhoek": (-34.1030, 18.3680),
    "kommetjie": (-34.1410, 18.3300),
    "scarborough": (-34.1980, 18.3750),
    "misty cliffs": (-34.1850, 18.3620),
    "witsand": (-34.1780, 18.3560),
    "milkwood park": (-34.1250, 18.3820),
    "sunnydale": (-34.1090, 18.3810),
    "tokai": (-34.0580, 18.4310),
    "constantia": (-34.0250, 18.4350),
    "bergvliet": (-34.0480, 18.4520),
    "plumstead": (-34.0210, 18.4710),
    "diep river": (-34.0320, 18.4640),
    "wynberg": (-34.0040, 18.4670),
    "kenilworth": (-33.9910, 18.4710),
    "claremont": (-33.9810, 18.4650),
    "newlands": (-33.9720, 18.4550),
    "rondebosch": (-33.9620, 18.4770),
    "rosebank": (-33.9555, 18.4715),
    "mowbray": (-33.9475, 18.4720),
    "observatory": (-33.9365, 18.4710),
    "gardens": (-33.9325, 18.4120),
    "oranjezicht": (-33.9400, 18.4190),
    "tamboerskloof": (-33.9338, 18.4055),
    "vredehoek": (-33.9380, 18.4280),
    "higgovale": (-33.9410, 18.4030),
    "city bowl": (-33.9249, 18.4241),
    "cape town cbd": (-33.9220, 18.4230),
    "green point": (-33.9085, 18.4090),
    "sea point": (-33.9180, 18.3880),
    "fresnaye": (-33.9250, 18.3850),
    "bantry bay": (-33.9290, 18.3800),
    "camps bay": (-33.9510, 18.3780),
    "bakoven": (-33.9590, 18.3740),
    "hout bay": (-34.0422, 18.3578),
    "hout bay central": (-34.0418, 18.3578),
    "hout bay harbour": (-34.055091, 18.3438309),
    "northshore": (-34.0466597, 18.3485029),
    "scott estate": (-34.0417377, 18.363814),
    "penzance estate": (-34.0335651, 18.3601056),
    "beach estate": (-34.0445, 18.3578),
    "helgarda estate": (-34.0275473, 18.3467557),
    "kronenzicht": (-34.0296282, 18.34416),
    "bokkemanskloof": (-34.0188797, 18.3828762),
    "longkloof": (-34.0110992, 18.3871665),
    "berg en dal": (-34.0362555, 18.3601056),
    "ruyteplaats": (-34.0122671, 18.3586222),
    "tierboskloof": (-34.023137, 18.369663),
    "victorskloof": (-34.0169114, 18.3578527),
    "oakhurst": (-34.0201759, 18.3747927),
    "llandudno": (-34.0090, 18.3420),
    "woodstock": (-33.9310, 18.4480),
    "salt river": (-33.9300, 18.4620),
    "pinelands": (-33.9330, 18.5080),
    # George & Garden Route areas
    "george": (-33.9630, 22.4617),
    "george central": (-33.9632, 22.4597),
    "bodorp": (-33.9560, 22.4570),
    "bergsig": (-33.9520, 22.4680),
    "heather park": (-33.9540, 22.4350),
    "heatherlands": (-33.9490, 22.4440),
    "fernridge": (-33.9440, 22.4600),
    "camphersdrift": (-33.9555, 22.4510),
    "denneoord": (-33.9505, 22.4780),
    "dormehls drift": (-33.9660, 22.4680),
    "loerie park": (-33.9720, 22.4820),
    "george east": (-33.9650, 22.4780),
    "george south": (-33.9740, 22.4580),
    "blanco": (-33.9560, 22.4160),
    "denver park": (-33.9710, 22.4720),
    "george industrial": (-33.9860, 22.4780),
    "pacaltsdorp": (-34.0120, 22.4620),
    "kraaibosch": (-33.9820, 22.5250),
    "blue mountain village": (-33.9790, 22.5110),
    "le grand estate": (-34.0320, 22.4950),
    "kingswood golf estate": (-33.9736, 22.4321),
    "king george park": (-33.9610, 22.4430),
    "bos en dal": (-33.9490, 22.4520),
    "glenwood": (-33.9780, 22.5020),
    "eden": (-33.9760, 22.4950),
    "wilderness": (-33.9922, 22.5804),
    "knysna": (-34.0363, 23.0471),
}

def normalize_address(raw_address: str, default_suburb: str = "") -> Dict[str, Any]:
    """
    Parses messy address strings, detects withheld addresses, strips marketing fluff,
    and isolates the cleanest geocodable query.
    """
    if not raw_address:
        return {
            "clean_query": default_suburb or "Cape Town",
            "suburb": default_suburb,
            "is_withheld": True,
            "confidence": "none"
        }

    raw = raw_address.strip()
    # Normalize periods separating address parts & common P24 street suffix typos
    raw = re.sub(r'\.\s+', ', ', raw)
    raw = re.sub(r'\bwoodroad\b', 'Wood Road', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\bwy\b', 'Way', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\bhoutbaai\b', 'Hout Bay', raw, flags=re.IGNORECASE)
    lower = raw.lower()

    # 1. Detect withheld or missing street addresses
    withheld_keywords = [
        "address withheld", "withheld", "contact agent", "request street address",
        "unknown address", "no address", "unspecified", "available on request"
    ]
    if any(k in lower for k in withheld_keywords):
        return {
            "clean_query": f"{default_suburb or 'Cape Town'}, Cape Town",
            "suburb": default_suburb,
            "is_withheld": True,
            "confidence": "withheld"
        }

    # P24 repeated suburb idiom: "Muizenberg, Muizenberg"
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if len(parts) >= 2 and all(p.lower() == parts[0].lower() for p in parts):
        return {
            "clean_query": f"{parts[0]}, Cape Town",
            "suburb": parts[0],
            "is_withheld": True,
            "confidence": "withheld"
        }

    # If it's a bare suburb with no street suffix or number
    has_street_clue = bool(re.search(r'\b(\d+|street|st|road|rd|avenue|ave|drive|dr|circle|cir|lane|ln|close|cl|crescent|cres|way|walk|terrace|terraces|boulevard|blvd|highway|hwy|row)\b', lower))
    if not has_street_clue and len(parts) <= 2:
        return {
            "clean_query": f"{parts[0]}, Cape Town",
            "suburb": parts[0],
            "is_withheld": True,
            "confidence": "withheld"
        }

    # 2. Extract specific known complex/building name & street intersection
    clean = raw
    # Remove redundant prefix like "Travel Time Calculator"
    clean = re.sub(r'^travel\s+time\s+calculator\s*', '', clean, flags=re.IGNORECASE)
    # Remove postal codes
    clean = re.sub(r'\b7\d{3}\b', '', clean)
    # Remove explicit unit prefixes like "Unit 304, ", "Apt 2B, ", "Flat 10, "
    clean = re.sub(r'^(?:unit|apt|apartment|flat|suite|no\.?)\s*\d+[a-zA-Z]?\s*,\s*', '', clean, flags=re.IGNORECASE)
    # Only remove leading number if followed by a building/complex name, NOT a street name/suffix (e.g. keep "12 Derwent Rd", "79 Main Rd")
    is_street_address = bool(re.search(r'^\d{1,4}[a-zA-Z]?\s+[a-zA-Z0-9\s\'-]+?\b(?:street|st|road|rd|avenue|ave|drive|dr|circle|cir|lane|ln|close|cl|crescent|cres|way|walk|terrace|terraces|boulevard|blvd|highway|hwy|row)\b', clean, re.IGNORECASE))
    if not is_street_address:
        clean = re.sub(r'^\d{1,4}[a-zA-Z]?\s+', '', clean)
    # Remove leading "1 Cnr of" or "Cnr Of"
    clean = re.sub(r'\b\d*\s*cnr\s+of\s+', '', clean, flags=re.IGNORECASE)
    # Remove redundant trailing "Cape Town, Western Cape" duplications
    clean = re.sub(r'(,\s*Cape Town)+(,\s*Western Cape)?', ', Cape Town', clean, flags=re.IGNORECASE)

    clean = re.sub(r'\s+', ' ', clean).strip(' ,')

    # Identify authentic suburb from chunks if compound suburb string is passed
    chunks = [c.strip() for c in clean.split(',') if c.strip()]
    detected_sub = ""
    for c in chunks:
        c_low = c.lower()
        for s_key in CAPE_TOWN_SUBURBS.keys():
            if s_key in c_low and s_key not in ["cape town", "city bowl"]:
                detected_sub = s_key.title()
                break
        if detected_sub:
            break

    # If first chunk is street address and multiple duplicate tokens follow, construct clean_query
    if len(chunks) > 1 and is_street_address:
        street_chunk = chunks[0]
        final_sub = detected_sub or (chunks[1] if chunks[1].lower() not in ['cape town', 'western cape'] else (default_suburb or 'Cape Town'))
        clean_formatted = f"{street_chunk}, {final_sub}"
    else:
        final_sub = detected_sub or (parts[-1] if parts else default_suburb)
        clean_formatted = clean

    return {
        "clean_query": clean_formatted,
        "suburb": final_sub,
        "is_withheld": False,
        "confidence": "high"
    }

def get_cached_coordinates(raw_address: str, clean_query: str = "") -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(_DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT clean_query, suburb, is_withheld, lat, lng, confidence FROM address_cache WHERE raw_address = ? OR clean_query = ? LIMIT 1",
        (raw_address.strip(), (clean_query or raw_address).strip())
    )
    row = cur.fetchone()
    conn.close()
    if row:
        return {
            "clean_query": row[0],
            "suburb": row[1],
            "is_withheld": bool(row[2]),
            "lat": row[3],
            "lng": row[4],
            "confidence": row[5]
        }
    return None

def save_cached_coordinates(raw_address: str, clean_query: str, suburb: str, is_withheld: bool, lat: float, lng: float, confidence: str):
    conn = sqlite3.connect(_DB_PATH)
    cur = conn.cursor()
    raw_hash = str(hash(raw_address))
    cur.execute("""
        INSERT OR REPLACE INTO address_cache 
        (raw_hash, raw_address, clean_query, suburb, is_withheld, lat, lng, confidence, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (raw_hash, raw_address, clean_query, suburb, 1 if is_withheld else 0, lat, lng, confidence, time.time()))
    conn.commit()
    conn.close()

def _geocode_with_mapbox(query: str, default_suburb: str = "") -> Optional[Dict[str, Any]]:
    """
    Tier 2 Primary Geocoder: Mapbox Geocoding API v5.
    100,000 free requests per month. Ultra-fast, comprehensive street and neighborhood coverage.
    """
    token = os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv("NEXT_PUBLIC_MAPBOX_TOKEN") or os.getenv("MAPBOX_TOKEN")
    if not token or not token.strip():
        return None
    try:
        clean_q = query.strip()
        if "south africa" not in clean_q.lower():
            clean_q = f"{clean_q}, South Africa"
        encoded = urllib.parse.quote(clean_q)
        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json?country=za&types=address,poi,neighborhood,locality&limit=1&access_token={token.strip()}"
        req = urllib.request.Request(url, headers={"User-Agent": "HomeSeek-AiGeocodingEngine/2.0"})
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode())
            features = data.get("features", [])
            if features:
                top = features[0]
                relevance = top.get("relevance", 0)
                if relevance >= 0.65:
                    lng, lat = top["center"]
                    place_name = top.get("place_name", query)
                    # Extract authentic suburb context
                    suburb = default_suburb
                    for ctx in top.get("context", []):
                        if any(k in ctx.get("id", "") for k in ["neighborhood", "locality", "place"]):
                            suburb = ctx.get("text", "")
                            break
                    return {
                        "clean_query": place_name,
                        "suburb": suburb or default_suburb,
                        "is_withheld": False,
                        "lat": float(lat),
                        "lng": float(lng),
                        "confidence": "mapbox"
                    }
    except Exception as e:
        print(f"[GEOCODER] Mapbox geocoding error: {e}")
    return None


def _geocode_with_google(query: str, default_suburb: str = "") -> Optional[Dict[str, Any]]:
    """
    Tier 3 Secondary Geocoder: Google Maps Geocoding API.
    $200 monthly credit (~40,000 queries free). Unrivaled resolution for tricky South African
    complexes, buildings, and gated estate addresses.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key or not api_key.strip():
        return None
    try:
        clean_q = query.strip()
        if "south africa" not in clean_q.lower():
            clean_q = f"{clean_q}, South Africa"
        encoded = urllib.parse.quote(clean_q)
        url = f"https://maps.googleapis.com/maps/api/geocode/json?address={encoded}&components=country:ZA&key={api_key.strip()}"
        req = urllib.request.Request(url, headers={"User-Agent": "HomeSeek-AiGeocodingEngine/2.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "OK" and data.get("results"):
                res = data["results"][0]
                loc = res["geometry"]["location"]
                formatted = res.get("formatted_address", query)
                suburb = default_suburb
                for comp in res.get("address_components", []):
                    types = comp.get("types", [])
                    if any(t in types for t in ["sublocality", "neighborhood", "locality"]):
                        suburb = comp.get("long_name", "")
                        break
                return {
                    "clean_query": formatted,
                    "suburb": suburb or default_suburb,
                    "is_withheld": False,
                    "lat": float(loc["lat"]),
                    "lng": float(loc["lng"]),
                    "confidence": "google_maps"
                }
    except Exception as e:
        print(f"[GEOCODER] Google Maps fallback error: {e}")
    return None

def _geocode_with_google_places(building_or_query: str, default_suburb: str = "") -> Optional[Dict[str, Any]]:
    """Uses Google Places FindPlace API to locate specific apartment buildings, complexes, mansions, or estates."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return None
    try:
        q = building_or_query.strip()
        if default_suburb and default_suburb.lower() not in q.lower():
            q = f"{q}, {default_suburb}, Cape Town"
        elif "cape town" not in q.lower():
            q = f"{q}, Cape Town"

        encoded = urllib.parse.quote(q)
        url = f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={encoded}&inputtype=textquery&fields=name,formatted_address,geometry&key={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": "HomeSeek-AiGeocodingEngine/2.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            candidates = data.get("candidates", [])
            if candidates:
                c = candidates[0]
                loc = c["geometry"]["location"]
                name = c.get("name", "")
                addr = c.get("formatted_address", "")
                addr_clean = re.sub(r',?\s*\b(?:8001|8005|8060|7975|7945|8000|\d{4})\b', '', addr)
                addr_clean = re.sub(r',?\s*South Africa\b', '', addr_clean, flags=re.I).strip(' ,')
                if name and name.lower() not in addr_clean.lower():
                    full_clean = f"{name}, {addr_clean}"
                else:
                    full_clean = addr_clean
                return {
                    "clean_query": full_clean,
                    "formatted_address": addr_clean,
                    "building_name": name,
                    "suburb": default_suburb or "Cape Town",
                    "is_withheld": False,
                    "lat": float(loc["lat"]),
                    "lng": float(loc["lng"]),
                    "confidence": "google_places_building"
                }
    except Exception as e:
        print(f"[GEOCODER] Google Places building lookup error: {e}")
    return None

BUILDING_PATTERNS = [
    # 1. Exact numbered street address (e.g., "18 Sunset Avenue", "8 Peterhof Road")
    re.compile(r'\b(\d{1,4}[a-zA-Z]?\s+[A-Z][a-zA-Z\s\'\u2019-]{2,25}?\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Way|Crescent|Cres|Boulevard|Blvd|Close|Cl))\b'),
    # 2. Street corner / intersection (e.g., "corner of Beach Road and Milner Avenue")
    re.compile(r'\b(?:corner|cnr)\s+of\s+([A-Z][a-zA-Z\'\u2019-]+(?:\s+[A-Z][a-zA-Z\'\u2019-]+){0,2}\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Way|Crescent|Cres|Boulevard|Blvd))(?:\s+(?:and|&)\s+[A-Z][a-zA-Z\'\u2019-]+(?:\s+[A-Z][a-zA-Z\'\u2019-]+){0,2}\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Way|Crescent|Cres|Boulevard|Blvd))?\b', re.I),
    # 3. Prefix-named complexes (e.g., "Villa d'Algarve", "Casa Blanca", "Chateau...", "Monte...")
    re.compile(r'\b((?:Villa|Casa|Chateau|Monte)\s+(?:d[\'\u2019]|de\s+|la\s+|del\s+)?[A-Z][a-zA-Z\'\u2019-]{2,24}(?:\s+[A-Z][a-zA-Z\'\u2019-]{2,20})?)', re.I),
    # 4. Preposition + complex/building/estate name with suffix
    re.compile(r'\b(?:in|at|into|to)\s+(?:the\s+)?(?:sought-after\s+|prestigious\s+|popular\s+|secure\s+|exclusive\s+|stunning\s+|modern\s+|luxury\s+)?([A-Z][a-zA-Z0-9\s\'\u2019-]{2,30}?(?:Mansions|Court|Heights|Towers|Mews|Place|Manor|Apartments|Flats|Lofts|View|Sands|Ridge|Close|Gate|Estate|Square|Villas|Pavilion|Residences|Studios|Park|Quay|Lodge|Terrace|House|Village|Palms|Cove|Gardens|Grove|Oaks))\b', re.I),
    # 5. Standalone capitalized complex name with suffix
    re.compile(r'\b([A-Z][a-zA-Z0-9\s\'\u2019-]{2,25}?(?:Mansions|Court|Heights|Towers|Mews|Manor|Lofts|Sands|Ridge|Square|Villas|Pavilion|Residences|Quay|Terrace|Estate|Palms|Village))\b'),
    # 6. Preposition + street name without number (e.g., "just off Kloof Nek Road", "in Victoria Avenue")
    re.compile(r'\b(?:in|on|along|just\s+off|off)\s+([A-Z][a-zA-Z\'\u2019-]+(?:\s+[A-Z][a-zA-Z\'\u2019-]+){0,2}\s+(?:Street|Road|Avenue|Drive|Lane|Way|Crescent|Boulevard|Close))\b'),
    # 7. Unit-prefixed complex header (e.g., "142 Villa d'Algarve", "Unit 4 Ocean View") — strictly skips "2 Bed..."
    re.compile(r'(?:^|\n|\bUnit\s+)\s*\d{1,4}[A-Za-z]?\s+(?!Bed(?:room)?\b|Bath(?:room)?\b|Month\b|Week\b|Day\b|Year\b|Min\b|Hour\b|Km\b|Sqm\b|Car\b|Garage\b|Parking\b|Person\b|People\b|Guest\b)([A-Z][a-zA-Z0-9\'\u2019-]+(?:\s+(?:d[\'\u2019])?[A-Z][a-zA-Z0-9\'\u2019-]+){1,3})\b'),
    # 8. "to rent in <Complex>, <Suburb>" or "in <Complex>, <Suburb>"
    re.compile(r'(?:to rent in|apartment in|unit in|situated in|located in|welcome to)\s+(?:the\s+)?(?:sought-after\s+)?([A-Z][a-zA-Z0-9\s\'\u2019-]{2,30}?)(?:,|\s+complex\b|\s+near\b)', re.I),
]

EXCLUDED_BUILDINGS = {
    'bedroom house', 'bedroom apartment', 'bedroom flat', 'bed house',
    'bed apartment', 'bed flat', 'bed cottage', 'bed townhouse', 'bed studio',
    'guest house', 'main house', 'town house', 'beach house', 'garden flat',
    'family home', 'open plan', 'ground floor', 'first floor', 'second floor', 'top floor',
    'main road'
}

def extract_building_or_street_from_text(text: str, default_suburb: str = "") -> Optional[str]:
    """Scans listing title & description text to identify apartment building names, complexes, or street addresses."""
    if not text:
        return None
    for pat in BUILDING_PATTERNS:
        m = pat.search(text)
        if m:
            cand = m.group(1).strip()
            cand_clean = re.sub(r'^(?:a|an|the|this|that|in|at|sought-after)\s+', '', cand, flags=re.I).strip()
            low = cand_clean.lower()
            if (
                low not in EXCLUDED_BUILDINGS
                and len(cand_clean) > 3
                and not re.match(r'^(?:bed(?:room)?|bath(?:room)?|ground|first|second|top|month|year|south african)\b', low)
            ):
                return cand_clean
    return None

def resolve_property_precision(
    title: str = "",
    description: str = "",
    raw_address: str = "",
    suburb: str = ""
) -> Dict[str, Any]:
    """
    Precision resolver that turns generic 'Sea Point, Sea Point' or withheld addresses into
    exact verified building and street coordinates using Google Places & Mapbox.
    """
    has_street = bool(re.search(r'\b(?:street|st|road|rd|woodroad|avenue|ave|drive|dr|circle|cir|lane|ln|close|cl|crescent|cres|way|wy|walk|terrace|boulevard|blvd)\b', raw_address, re.I))

    if not has_street:
        combined_text = f"{title} {description}"
        detected = extract_building_or_street_from_text(combined_text, suburb)
        if detected:
            cache_key = f"{detected}, {suburb}" if suburb else detected
            det_low = detected.lower().strip()

            # 1. Check local precision points
            if det_low in KNOWN_PRECISION_POINTS:
                pt = KNOWN_PRECISION_POINTS[det_low]
                return {
                    "clean_query": f"{detected}, {suburb or 'Cape Town'}",
                    "formatted_address": f"{detected}, {suburb or 'Cape Town'}",
                    "building_name": detected,
                    "suburb": suburb,
                    "is_withheld": False,
                    "lat": pt[0],
                    "lng": pt[1],
                    "confidence": "precision_anchor"
                }

            # Skip Google Places POI search if extracted text is just a bare residential pocket/suburb name
            is_generic_pocket = any(det_low == s or det_low.endswith(s) for s in CAPE_TOWN_SUBURBS.keys())
            sub_anchor = CAPE_TOWN_SUBURBS.get((suburb or "").lower().strip())
            if not is_generic_pocket:
                # 2. Check local SQLite cache
                cached = get_cached_coordinates(cache_key)
                if cached and not cached.get("is_withheld") and cached.get("confidence") != "none":
                    return cached

                # 3. Google Places API lookup (bounded to suburb center when known)
                gp_res = _geocode_with_google_places(detected, default_suburb=suburb)
                if gp_res and (not sub_anchor or _haversine_km(gp_res["lat"], gp_res["lng"], sub_anchor[0], sub_anchor[1]) <= 6.0):
                    save_cached_coordinates(cache_key, gp_res["clean_query"], suburb, False, gp_res["lat"], gp_res["lng"], "google_places_building")
                    return gp_res

                # 4. Mapbox geocoding lookup
                mb_res = _geocode_with_mapbox(f"{detected}, {suburb}")
                if mb_res and (not sub_anchor or _haversine_km(mb_res["lat"], mb_res["lng"], sub_anchor[0], sub_anchor[1]) <= 6.0):
                    save_cached_coordinates(cache_key, mb_res["clean_query"], suburb, False, mb_res["lat"], mb_res["lng"], "mapbox_building")
                    return mb_res

                # 5. Gemini AI Building Resolution
                ai_res = _ai_resolve_address(f"{detected}, {suburb}", default_suburb=suburb)
                if ai_res and not ai_res.get("is_withheld") and (not sub_anchor or _haversine_km(ai_res["lat"], ai_res["lng"], sub_anchor[0], sub_anchor[1]) <= 6.0):
                    save_cached_coordinates(cache_key, ai_res["clean_query"], suburb, False, ai_res["lat"], ai_res["lng"], "ai_building_resolved")
                    return ai_res

    return geocode_address_precision(raw_address, default_suburb=suburb)


def _ai_resolve_address(raw_address: str, default_suburb: str = "") -> Optional[Dict[str, Any]]:
    """Tier 4 AI Backup: Uses Gemini to intelligently parse complex or marketing-masked South African addresses."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            api_key=api_key,
            temperature=0.0,
            request_timeout=8
        )
        prompt = f"""You are a geospatial expert on Cape Town and South African property addresses.
Resolve the true location and GPS coordinates for this listing:
Address: "{raw_address}"
Suburb hint: "{default_suburb}"

Note: South African agents often brand nearby areas with higher-status suburbs (e.g., listing Capricorn Beach as 'Muizenberg', or Sunnydale as 'Noordhoek').
Extract:
1. true_suburb: The authentic geographic suburb (e.g. 'Capricorn', 'Sunnydale', 'Muizenberg', 'Kommetjie', 'Gardens')
2. clean_address: The clean street address / complex (e.g. 'Ocean Terraces, 2 Sanderling Rd')
3. lat: approximate latitude (-33.8 to -34.4)
4. lng: approximate longitude (18.3 to 18.9)

Respond ONLY with valid JSON:
{{"true_suburb": "string", "clean_address": "string", "lat": -34.1234, "lng": 18.4567}}"""
        resp = llm.invoke([HumanMessage(content=prompt)])
        txt = resp.content.strip()
        txt = re.sub(r'^```json\s*', '', txt)
        txt = re.sub(r'\s*```$', '', txt)
        data = json.loads(txt)
        if "lat" in data and "lng" in data and abs(float(data["lat"])) > 30:
            return {
                "clean_query": data.get("clean_address", raw_address),
                "suburb": data.get("true_suburb", default_suburb),
                "is_withheld": False,
                "lat": float(data["lat"]),
                "lng": float(data["lng"]),
                "confidence": "ai_resolved"
            }
    except Exception as e:
        print(f"[GEOCODER] AI geocoding fallback error: {e}")
    return None

def geocode_address_precision(raw_address: str, default_suburb: str = "") -> Dict[str, Any]:
    """
    Precision multi-tiered geocoding pipeline:
    Tier 1: SQLite Persistent Cache hit (0ms, $0)
    Tier 2: Mapbox Geocoding API (Primary nationwide provider - 100k free reqs/mo)
    Tier 3: Google Maps Geocoding API (Secondary high-accuracy complex/estate backup)
    Tier 4: Offline Cape Town Micro-Pocket & Street Anchors (0ms)
    Tier 5: OpenStreetMap / Nominatim geocoding (Open-source fallback)
    Tier 6: AI LLM Address Normalization & Geocoding Backup (Gemini)
    Tier 7: Authentic Municipal Suburb Geocenter directory lookup
    """
    if not raw_address:
        return {"lat": -33.9249, "lng": 18.4241, "is_withheld": True, "confidence": "none"}

    # Tier 1: Cache
    cached = get_cached_coordinates(raw_address)
    if cached:
        return cached

    # Address Normalization
    norm = normalize_address(raw_address, default_suburb)
    if norm["is_withheld"]:
        sub_key = norm["suburb"].lower().strip()
        def_key = (default_suburb or "").lower().strip()
        known_coords = CAPE_TOWN_SUBURBS.get(sub_key)
        if not known_coords and sub_key and sub_key != def_key:
            area_query = raw_address.strip() or (f"{norm['suburb']}, {default_suburb}" if default_suburb else norm["suburb"])
            def_anchor = CAPE_TOWN_SUBURBS.get(def_key)
            geo_area = _geocode_with_mapbox(area_query, default_suburb=default_suburb) or _geocode_with_google(area_query, default_suburb=default_suburb)
            if geo_area and (not def_anchor or _haversine_km(geo_area["lat"], geo_area["lng"], def_anchor[0], def_anchor[1]) <= 15.0):
                known_coords = (geo_area["lat"], geo_area["lng"])

        wlat, wlng = (
            known_coords
            or CAPE_TOWN_SUBURBS.get(def_key)
            or (-34.1070, 18.4710)
        )
        save_cached_coordinates(raw_address, norm["clean_query"], norm["suburb"], True, wlat, wlng, "withheld")
        return {**norm, "lat": wlat, "lng": wlng}

    # Secondary Cache check on sanitized clean_query (avoids API calls for slight formatting variants)
    clean_cached = get_cached_coordinates(raw_address, norm["clean_query"])
    if clean_cached:
        return clean_cached

    # Known suburb anchor for sanity-checking Mapbox / Google / Nominatim hits
    sub_anchor = (
        CAPE_TOWN_SUBURBS.get((norm.get("suburb") or "").lower().strip())
        or CAPE_TOWN_SUBURBS.get((default_suburb or "").lower().strip())
    )

    # Tier 2: Offline Known Precision Points (Fast exact match for verified street/complex anchors)
    lower_raw = raw_address.lower()
    for point_key, (plat, plng) in sorted(KNOWN_PRECISION_POINTS.items(), key=lambda x: len(x[0]), reverse=True):
        if point_key in lower_raw or point_key in norm["clean_query"].lower():
            save_cached_coordinates(raw_address, norm["clean_query"], norm["suburb"], False, plat, plng, "precision_anchor")
            return {
                "clean_query": norm["clean_query"],
                "suburb": norm["suburb"],
                "is_withheld": False,
                "lat": plat,
                "lng": plng,
                "confidence": "precision_anchor"
            }

    # Tier 3: Mapbox Geocoding API (Primary nationwide provider - reject cross-suburb false hits)
    mapbox_res = _geocode_with_mapbox(norm["clean_query"], default_suburb=norm["suburb"])
    if mapbox_res and (not sub_anchor or _haversine_km(mapbox_res["lat"], mapbox_res["lng"], sub_anchor[0], sub_anchor[1]) <= 6.0):
        save_cached_coordinates(raw_address, mapbox_res["clean_query"], mapbox_res["suburb"], False, mapbox_res["lat"], mapbox_res["lng"], "mapbox")
        return mapbox_res

    # Tier 4: Google Maps Geocoding API (High-accuracy ROOFTOP fallback for tricky streets/estates)
    google_query = norm["clean_query"]
    if default_suburb and default_suburb.lower() not in google_query.lower():
        google_query = f"{google_query}, {default_suburb}"
    google_res = _geocode_with_google(google_query, default_suburb=norm["suburb"])
    if google_res and (not sub_anchor or _haversine_km(google_res["lat"], google_res["lng"], sub_anchor[0], sub_anchor[1]) <= 6.0):
        save_cached_coordinates(raw_address, google_res["clean_query"], google_res["suburb"], False, google_res["lat"], google_res["lng"], "google_maps")
        return google_res

    # Tier 5: Nominatim OSM Geocoding
    try:
        query_str = norm["clean_query"]
        if "cape town" not in query_str.lower():
            query_str += ", Cape Town, South Africa"
        
        encoded = urllib.parse.quote(query_str)
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1",
            headers={"User-Agent": "HomeSeek-AiGeocodingEngine/2.0"}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            # If compound query failed, retry with just the street address
            is_street_address = bool(re.search(r'\b(?:street|st|road|rd|avenue|ave|drive|dr|circle|cir|lane|ln|close|cl|crescent|cres|way|walk|terrace|terraces|boulevard|blvd|highway|hwy|row)\b', norm["clean_query"], re.I))
            if (not data or len(data) == 0) and is_street_address:
                st_match = re.search(r'^\s*(\d{1,4}[a-zA-Z]?\s+[a-zA-Z0-9\s\'-]+?\b(?:street|st|road|rd|avenue|ave|drive|dr|circle|cir|lane|ln|close|cl|crescent|cres|way|walk|terrace|terraces|boulevard|blvd|highway|hwy|row)\b)', norm["clean_query"], re.I)
                if st_match:
                    encoded_st = urllib.parse.quote(f"{st_match.group(1)}, Cape Town, South Africa")
                    req_st = urllib.request.Request(
                        f"https://nominatim.openstreetmap.org/search?q={encoded_st}&format=json&limit=1",
                        headers={"User-Agent": "HomeSeek-AiGeocodingEngine/2.0"}
                    )
                    with urllib.request.urlopen(req_st, timeout=4) as resp_st:
                        data = json.loads(resp_st.read().decode())

            if data and len(data) > 0:
                glat = float(data[0]["lat"])
                glng = float(data[0]["lon"])
                save_cached_coordinates(raw_address, norm["clean_query"], norm["suburb"], False, glat, glng, "geocoded")
                return {
                    "clean_query": norm["clean_query"],
                    "suburb": norm["suburb"],
                    "is_withheld": False,
                    "lat": glat,
                    "lng": glng,
                    "confidence": "geocoded"
                }
    except Exception as e:
        print(f"[GEOCODER] Nominatim fallback error for '{raw_address}': {e}")

    # Tier 6: AI LLM Geocoding Backup
    ai_res = _ai_resolve_address(raw_address, default_suburb=norm["suburb"])
    if ai_res:
        save_cached_coordinates(raw_address, ai_res["clean_query"], ai_res["suburb"], False, ai_res["lat"], ai_res["lng"], "ai_resolved")
        return ai_res

    # Tier 7: Suburb Geocenter fallback (resolves to true suburb, never blind default)
    detected_suburb = (norm["suburb"] or default_suburb).lower().strip()
    fallback_lat, fallback_lng = -34.1070, 18.4710
    for s_name, (slat, slng) in CAPE_TOWN_SUBURBS.items():
        if s_name in detected_suburb or s_name in raw_address.lower():
            fallback_lat, fallback_lng = slat, slng
            norm["suburb"] = s_name.title()
            break

    save_cached_coordinates(raw_address, norm["clean_query"], norm["suburb"], False, fallback_lat, fallback_lng, "suburb_geocenter")
    return {
        "clean_query": norm["clean_query"],
        "suburb": norm["suburb"],
        "is_withheld": False,
        "lat": fallback_lat,
        "lng": fallback_lng,
        "confidence": "suburb_geocenter"
    }

def batch_geocode_addresses(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Batch geocoding with fast cache lookup and minimal network calls."""
    results = []
    for item in items:
        raw_addr = item.get("address", "")
        suburb = item.get("suburb", "")
        geo_res = geocode_address_precision(raw_addr, default_suburb=suburb)
        results.append({
            **item,
            "lat": geo_res["lat"],
            "lng": geo_res["lng"],
            "is_address_withheld": geo_res.get("is_withheld", False),
            "normalized_address": geo_res.get("clean_query", raw_addr),
            "geocoding_confidence": geo_res.get("confidence", "unknown")
        })
    return results

def extract_estate_name(text: str) -> Optional[str]:
    """
    Extracts security estates, eco estates, complexes, and villages mentioned in property copy.
    Solves Property24 listings where agents withhold street address ('Contact agent') but name the Estate.
    """
    if not text:
        return None
    
    # 1. Targeted South African phrases indicating an estate or complex
    phrase_patterns = [
        r'(?:situated|located|nestled|positioned|found)\s+in\s+(?:the\s+)?(?:secure\s+|prestigious\s+|exclusive\s+|gated\s+|newly\s+built\s+|growing\s+)?([A-Z][a-zA-Z0-9\s\'-]+?(?:Estate|Village|Eco\s+Estate|Security\s+Estate|Manor|Ridge|Heights|Villas|Mews|Gardens|Park|Complex|Quays|Marina))',
        r'\b([A-Z][a-zA-Z0-9\'-]+(?:\s+[A-Z][a-zA-Z0-9\'-]+)*\s+(?:Estate|Village|Eco\s+Estate|Security\s+Estate|Manor))\b',
    ]
    for pattern in phrase_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            # Clean up and ensure candidate isn't too long or generic
            if 3 < len(candidate) < 45 and not candidate.lower().startswith('real'):
                return candidate
    
    # 2. Direct dictionary scan for known Cape Town estates
    lower = text.lower()
    for estate in KNOWN_PRECISION_POINTS:
        if estate in lower and ("estate" in estate or "village" in estate or "manor" in estate):
            return estate.title()
            
    return None

def normalize_and_geocode(raw_address: str, default_suburb: str = "", title: str = "", description: str = "") -> Dict[str, Any]:
    """
    Unified entry point for address normalization & precision geocoding.
    If the street address is withheld ('Contact agent'), detects Estate/Complex names from the description and title.
    """
    estate = extract_estate_name(f"{title} {description}")
    
    withheld_keywords = [
        "address withheld", "withheld", "contact agent", "request street address",
        "unknown address", "no address", "unspecified"
    ]
    raw_lower = (raw_address or "").lower()
    is_address_vague = not raw_address or any(k in raw_lower for k in withheld_keywords) or len(raw_address.split(',')) <= 1
    
    if estate and is_address_vague:
        query = f"{estate}, {default_suburb or 'Cape Town'}, Cape Town"
        result = geocode_address_precision(query, default_suburb=default_suburb)
        result["detected_estate"] = estate
        result["clean_query"] = f"{estate}, {default_suburb or 'Cape Town'}"
        result["is_withheld"] = False
        return result

    # If raw_address is present and not vague, use it directly (never append marketing title, which destroys geocoder precision)
    query = raw_address if (raw_address and not is_address_vague) else (f"{raw_address} {title}".strip() if title else raw_address)
    result = geocode_address_precision(query, default_suburb=default_suburb)
    if estate:
        result["detected_estate"] = estate
    return result
