import os
import json
import urllib.request
import re
from typing import Optional, Dict, Any

# Fast in-memory cache for instant resolutions
_AREAS_CACHE: Optional[Dict[str, list]] = None
CACHE_FILE = os.path.join(os.path.dirname(__file__), "p24_areas_cache.json")

# Instant zero-latency canonical lookup for high-frequency targets
CANONICAL_P24_URLS = {
    # Garden Route & Eden
    "george": "https://www.property24.com/to-rent/george/western-cape/321",
    "knysna": "https://www.property24.com/to-rent/knysna/western-cape/322",
    "mossel bay": "https://www.property24.com/to-rent/mossel-bay/western-cape/467",
    "plettenberg bay": "https://www.property24.com/to-rent/plettenberg-bay/western-cape/327",
    "wilderness": "https://www.property24.com/to-rent/wilderness/george/western-cape/9313",
    "sedgefield": "https://www.property24.com/to-rent/sedgefield/knysna/western-cape/9312",
    
    # Deep South & South Peninsula (Parent Region covers Fish Hoek, Noordhoek, Kommetjie, Scarborough, Simons Town, Muizenberg, etc.)
    "southern peninsula": "https://www.property24.com/to-rent/southern-peninsula/cape-town/western-cape/24",
    "south peninsula": "https://www.property24.com/to-rent/southern-peninsula/cape-town/western-cape/24",
    "deep south": "https://www.property24.com/to-rent/southern-peninsula/cape-town/western-cape/24",
    "fish hoek": "https://www.property24.com/to-rent/fish-hoek/western-cape/475",
    "noordhoek": "https://www.property24.com/to-rent/noordhoek/western-cape/479",
    "kommetjie": "https://www.property24.com/to-rent/kommetjie/western-cape/478",
    "scarborough": "https://www.property24.com/to-rent/scarborough/western-cape/652",
    "simons town": "https://www.property24.com/to-rent/simons-town/western-cape/401",
    "simon's town": "https://www.property24.com/to-rent/simons-town/western-cape/401",
    "muizenberg": "https://www.property24.com/to-rent/muizenberg/cape-town/western-cape/9025",
    "kalk bay": "https://www.property24.com/to-rent/kalk-bay/cape-town/western-cape/9067",
    "st james": "https://www.property24.com/to-rent/st-james/cape-town/western-cape/9039",
    "glencairn": "https://www.property24.com/to-rent/glencairn/simons-town/western-cape/9107",
    "capri": "https://www.property24.com/to-rent/capri/fish-hoek/western-cape/10997",
    "clovelly": "https://www.property24.com/to-rent/clovelly/fish-hoek/western-cape/10947",
    "sunnydale": "https://www.property24.com/to-rent/sunnydale/noordhoek/western-cape/9090",
    
    # Southern Suburbs & City Bowl
    "atlantic seaboard": "https://www.property24.com/to-rent/atlantic-seaboard/cape-town/western-cape/20",
    "city bowl": "https://www.property24.com/to-rent/city-bowl/cape-town/western-cape/22",
    "southern suburbs": "https://www.property24.com/to-rent/southern-suburbs/cape-town/western-cape/25",
    "cape town": "https://www.property24.com/to-rent/cape-town/western-cape/432",
    "meadowridge": "https://www.property24.com/to-rent/meadowridge/cape-town/western-cape/10052",
    "bergvliet": "https://www.property24.com/to-rent/bergvliet/cape-town/western-cape/10189",
    "constantia": "https://www.property24.com/to-rent/constantia/cape-town/western-cape/11742",
    "hout bay": "https://www.property24.com/to-rent/hout-bay/western-cape/615",
    "llandudno": "https://www.property24.com/to-rent/llandudno/cape-town/western-cape/9118",
    "sea point": "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021",
    "green point": "https://www.property24.com/to-rent/green-point/cape-town/western-cape/11017",
    "camps bay": "https://www.property24.com/to-rent/camps-bay/cape-town/western-cape/11014",
    "clifton": "https://www.property24.com/to-rent/clifton/cape-town/western-cape/11015",
    "bakoven": "https://www.property24.com/to-rent/bakoven/cape-town/western-cape/11012",
    "rondebosch": "https://www.property24.com/to-rent/rondebosch/cape-town/western-cape/10059",
    "claremont": "https://www.property24.com/to-rent/claremont/cape-town/western-cape/10034",
    "observatory": "https://www.property24.com/to-rent/observatory/cape-town/western-cape/10054",
    "woodstock": "https://www.property24.com/to-rent/woodstock/cape-town/western-cape/10065",
    
    # Northern Suburbs & Winelands
    "durbanville": "https://www.property24.com/to-rent/durbanville/western-cape/439",
    "stellenbosch": "https://www.property24.com/to-rent/stellenbosch/western-cape/459",
    "paarl": "https://www.property24.com/to-rent/paarl/western-cape/440",
    "somerset west": "https://www.property24.com/to-rent/somerset-west/western-cape/442",
    "hermanus": "https://www.property24.com/to-rent/hermanus/western-cape/400",

    # Provinces
    "western cape": "https://www.property24.com/to-rent/western-cape/9"
}

SA_PROVINCES = {
    "western cape", "eastern cape", "northern cape", "gauteng", 
    "kwazulu natal", "free state", "mpumalanga", "limpopo", "north west"
}

def _clean_slug(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", str(text or "").lower())
    return re.sub(r"[\s_]+", "-", cleaned).strip("-")

def get_areas_index() -> Dict[str, list]:
    global _AREAS_CACHE
    if _AREAS_CACHE is not None:
        return _AREAS_CACHE
        
    # Check on-disk cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _AREAS_CACHE = json.load(f)
                return _AREAS_CACHE
        except Exception:
            pass

    # Fetch from Property24 autocomplete catalog
    try:
        url = "https://www.property24.com/autocomplete/propertiesgrouped"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.property24.com/to-rent"
            }
        )
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode("utf-8"))
            if isinstance(data, dict):
                _AREAS_CACHE = data
                try:
                    with open(CACHE_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f)
                except Exception:
                    pass
                return _AREAS_CACHE
    except Exception as e:
        print(f"[PORTAL RESOLVER] Warning: Could not fetch Property24 index ({e})")
        
    return {}

def resolve_p24_url(area_query: str, is_pet_friendly: bool = False) -> Optional[str]:
    """
    Dynamically resolves any user input (e.g. 'George', 'Sea Point', 'Plettenberg Bay')
    into its canonical Property24 URL, appending pet filter if requested.
    """
    if not area_query:
        return None
        
    clean = str(area_query).strip()
    for marker in ["(MUST BE PET FRIENDLY)", "PET FRIENDLY", "(PET FRIENDLY)"]:
        clean = clean.replace(marker, "").replace(marker.lower(), "")
    clean = clean.strip().lower()
    
    if not clean:
        return None
        
    pet_suffix = "?sp=ptf%3dTrue" if is_pet_friendly else ""
    
    # 1. Check instant static registry
    if clean in CANONICAL_P24_URLS:
        base_url = CANONICAL_P24_URLS[clean]
        sep = "&" if "?" in base_url else "?"
        return f"{base_url}{sep}sp=ptf%3dTrue" if is_pet_friendly and "ptf" not in base_url else base_url

    # Check partial match in static registry (e.g. 'George Central' -> 'George')
    for name, base_url in CANONICAL_P24_URLS.items():
        if name in clean or clean in name:
            sep = "&" if "?" in base_url else "?"
            return f"{base_url}{sep}sp=ptf%3dTrue" if is_pet_friendly and "ptf" not in base_url else base_url

    # 2. Dynamic lookup in Property24 index
    index = get_areas_index()
    if not index:
        return None
        
    first_char = clean[0]
    entries = index.get(first_char, [])
    normalized_clean = clean.replace(" ", "").replace("-", "")
    
    # Find matching items
    exact_matches = []
    prefix_matches = []
    
    for item in entries:
        norm_name = str(item.get("normalizedName") or "").lower()
        item_name = str(item.get("name") or "").lower()
        
        if item_name == clean or norm_name == normalized_clean:
            exact_matches.append(item)
        elif clean.startswith(item_name) or norm_name.startswith(normalized_clean):
            prefix_matches.append(item)
            
    candidates = exact_matches or prefix_matches
    if not candidates:
        return None
        
    # Prefer Western Cape if ambiguous, and prefer Type 2 (City/Town) or Type 1 (Suburb)
    candidates.sort(key=lambda x: (
        1 if "western cape" in str(x.get("parentName", "")).lower() else 0,
        1 if x.get("type") in [1, 2] else 0
    ), reverse=True)
    
    best = candidates[0]
    item_id = best.get("id")
    name_slug = _clean_slug(best.get("name"))
    parent_raw = str(best.get("parentName") or "").lower()
    parent_slug = _clean_slug(parent_raw)
    
    if best.get("type") == 5 or not parent_raw:
        # Province itself (e.g. Western Cape -> /to-rent/western-cape/9)
        resolved = f"https://www.property24.com/to-rent/{name_slug}/{item_id}"
    elif parent_raw in SA_PROVINCES:
        resolved = f"https://www.property24.com/to-rent/{name_slug}/{parent_slug}/{item_id}"
    else:
        # It's a suburb under a town/city (e.g. Heatherlands under George)
        resolved = f"https://www.property24.com/to-rent/{name_slug}/{parent_slug}/western-cape/{item_id}"
        
    if is_pet_friendly:
        resolved += pet_suffix
        
    return resolved
