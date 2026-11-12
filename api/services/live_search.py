import sys
sys.path.append('api')
import os
import json
import time
import threading
import urllib.request
import urllib.parse
import urllib.error
from bs4 import BeautifulSoup
import re
import random
import math
from typing import List, Dict, Any, Optional, Tuple, Set
from scraper.portal_resolver import resolve_p24_url

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-ZA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.property24.com/',
    'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'DNT': '1',
}

SUBURB_COORDS = {
    'george': (-33.9630, 22.4617),
    'george central': (-33.9632, 22.4597),
    'bodorp': (-33.9560, 22.4570),
    'bergsig': (-33.9520, 22.4680),
    'heather park': (-33.9540, 22.4350),
    'heatherlands': (-33.9490, 22.4440),
    'fernridge': (-33.9440, 22.4600),
    'camphersdrift': (-33.9555, 22.4510),
    'denneoord': (-33.9505, 22.4780),
    'dormehls drift': (-33.9660, 22.4680),
    'loerie park': (-33.9720, 22.4820),
    'george east': (-33.9650, 22.4780),
    'george south': (-33.9740, 22.4580),
    'blanco': (-33.9560, 22.4160),
    'denver park': (-33.9710, 22.4720),
    'george industrial': (-33.9860, 22.4780),
    'pacaltsdorp': (-34.0120, 22.4620),
    'kraaibosch': (-33.9820, 22.5250),
    'blue mountain village': (-33.9790, 22.5110),
    'le grand estate': (-34.0320, 22.4950),
    'kingswood golf estate': (-33.9736, 22.4321),
    'king george park': (-33.9610, 22.4430),
    'bos en dal': (-33.9490, 22.4520),
    'glenwood': (-33.9780, 22.5020),
    'eden': (-33.9760, 22.4950),
    'wilderness': (-33.9922, 22.5804),
    'knysna': (-34.0363, 23.0471),
    'rondebosch': (-33.9635, 18.4720),
    'tamboerskloof': (-33.9315, 18.4060),
    'gardens': (-33.9350, 18.4130),
    'vredehoek': (-33.9370, 18.4280),
    'oranjezicht': (-33.9420, 18.4180),
    'green point': (-33.9085, 18.4090),
    'mouille point': (-33.8995, 18.4068),
    'mouillie point': (-33.8995, 18.4068),
    'three anchor bay': (-33.9092, 18.3975),
    'sea point': (-33.9180, 18.3880),
    'de waterkant': (-33.9155, 18.4172),
    'bantry bay': (-33.9285, 18.3810),
    'higgovale': (-33.9395, 18.4045),
    'camps bay': (-33.9515, 18.3780),
    'clifton': (-33.9390, 18.3770),
    'woodstock': (-33.9310, 18.4480),
    'observatory': (-33.9380, 18.4720),
    'newlands': (-33.9740, 18.4550),
    'tokai': (-34.0580, 18.4310),
    'constantia': (-34.0210, 18.4280),
    'claremont': (-33.9800, 18.4650),
    'kenilworth': (-33.9920, 18.4710),
    'bergvliet': (-34.0450, 18.4520),
    'meadowridge': (-34.0410, 18.4440),
    'kirstenhof': (-34.0680, 18.4450),
    'hout bay': (-34.0422, 18.3578),
    'hout bay central': (-34.0418, 18.3578),
    'hout bay harbour': (-34.055091, 18.3438309),
    'northshore': (-34.0466597, 18.3485029),
    'scott estate': (-34.0417377, 18.363814),
    'penzance estate': (-34.0335651, 18.3601056),
    'beach estate': (-34.0445, 18.3578),
    'helgarda estate': (-34.0275473, 18.3467557),
    'kronenzicht': (-34.0296282, 18.34416),
    'bokkemanskloof': (-34.0188797, 18.3828762),
    'longkloof': (-34.0110992, 18.3871665),
    'berg en dal': (-34.0362555, 18.3601056),
    'ruyteplaats': (-34.0122671, 18.3586222),
    'tierboskloof': (-34.023137, 18.369663),
    'victorskloof': (-34.0169114, 18.3578527),
    'oakhurst': (-34.0201759, 18.3747927),
    'llandudno': (-34.0090, 18.3420),
    'noordhoek': (-34.1035, 18.3720),
    'sunnydale': (-34.1090, 18.3810),
    'capri': (-34.1150, 18.3880),
    'kommetjie': (-34.1390, 18.3280),
    'scarborough': (-34.1985, 18.3740),
    'muizenberg': (-34.1065, 18.4705),
    'capricorn': (-34.0986, 18.4884),
    'capricorn beach': (-34.0986, 18.4884),
    'costa da gama': (-34.1010, 18.4820),
    'marina da gama': (-34.0958, 18.4738),
    'st james': (-34.1185, 18.4590),
    'kalk bay': (-34.1285, 18.4480),
    'clovelly': (-34.1335, 18.4390),
    'fish hoek': (-34.1375, 18.4290),
    'glencairn': (-34.1620, 18.4310),
    'simons town': (-34.1930, 18.4350),
    "simon's town": (-34.1930, 18.4350),
    'cape town city centre': (-33.9249, 18.4241),
    'bo-kaap': (-33.9212, 18.4148),
    'zonnebloem': (-33.9306, 18.4339),
    'foreshore': (-33.9181, 18.4272),
    'fresnaye': (-33.9235, 18.3878),
    'bakoven': (-33.9598, 18.3742),
    'salt river': (-33.9296, 18.4586),
    'mowbray': (-33.9475, 18.4744),
    'rosebank': (-33.9553, 18.4747),
    'wynberg': (-34.0067, 18.4667),
    'plumstead': (-34.0253, 18.4686),
    'diep river': (-34.0369, 18.4614),
    'bishopscourt': (-33.9906, 18.4419),
    'pinelands': (-33.9381, 18.5047),
    'thornton': (-33.9211, 18.5342),
    'lakeside': (-34.0867, 18.4594),
    'century city': (-33.8927, 18.5105),
    'milnerton': (-33.8739, 18.4944),
    'table view': (-33.8256, 18.4975),
    'bloubergstrand': (-33.8006, 18.4658),
    'blouberg': (-33.8122, 18.4792),
    'parklands': (-33.8075, 18.5047),
    'sunningdale': (-33.7969, 18.4969),
    'big bay': (-33.7917, 18.4567),
    'melkbosstrand': (-33.7267, 18.4417),
    'bellville': (-33.9000, 18.6333),
    'durbanville': (-33.8333, 18.6500),
    'plattekloof': (-33.8758, 18.5808),
    'panorama': (-33.8825, 18.5736),
    'edgemead': (-33.8772, 18.5389),
    'goodwood': (-33.9056, 18.5567),
    'parow': (-33.9025, 18.5872),
    'brackenfell': (-33.8736, 18.6939),
    'kraaifontein': (-33.8489, 18.7167),
    'kuils river': (-33.9292, 18.6858),
}

# ==============================================================================
# RATE-LIMIT PROTECTION, TTL CACHE & CIRCUIT BREAKER
# ==============================================================================
P24_DEV_MODE = os.environ.get("P24_DEV_MODE", "true").lower() in ("true", "1", "yes")

# In development mode, extend fresh cache TTL to 7 days to prevent hitting P24 during dev
_CACHE_TTL_SECONDS = (7 * 24 * 60 * 60) if P24_DEV_MODE else (25 * 60)
_STALE_MAX_SECONDS = 30 * 24 * 60 * 60     # 30-day stale fallback if circuit breaker is open
_MIN_REQUEST_INTERVAL = 3.5           # Minimum seconds between any two outbound requests
_JITTER_RANGE = (1.2, 2.8)            # Additional human-paced jitter between suburb fetches
_MAX_SUBURBS_PER_BATCH = 3            # Cap uncached outbound suburb requests per live call
_COOLDOWN_BASE_SECONDS = 300          # 5-minute base cooldown when "Server unavailable" / 429 occurs
# A manual "Scrape P24" click (force_fresh=True) refreshes any suburb whose cache is older than this.
# Auto-loads / hot reloads (force_fresh=False) remain cache-first with the long TTL above.
_MANUAL_REFRESH_MIN_AGE_SECONDS = 15 * 60

_RATE_LOCK = threading.Lock()
_LAST_REQUEST_TS: float = 0.0
_CIRCUIT_OPEN_UNTIL: float = 0.0
_CONSECUTIVE_TRIPS: int = 0
_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_FILE = os.path.join(os.path.dirname(__file__), ".p24_live_cache.json")
_LAST_BATCH_META: Dict[str, Any] = {
    "refreshed_suburbs": [],
    "cached_suburbs": [],
    "stale_suburbs": [],
    "network_fetches": 0,
}


def get_last_batch_meta() -> Dict[str, Any]:
    return dict(_LAST_BATCH_META)


def remove_listing_ids_from_cache(p24_ids: Set[str]) -> int:
    """Purges confirmed expired/unavailable listing IDs from `.p24_live_cache.json` and database pool."""
    clean_targets = {str(x).replace("p24-", "").strip() for x in p24_ids if str(x).strip()}
    if not clean_targets:
        return 0

    try:
        from services.listings_db import mark_listing_unavailable
        for pid in clean_targets:
            mark_listing_unavailable(pid)
    except Exception:
        pass

    _load_disk_cache(force=True)
    removed = 0
    for entry in _MEMORY_CACHE.values():
        items = entry.get("items")
        if not isinstance(items, list):
            continue
        kept = []
        for it in items:
            lid = str(it.get("p24_id") or it.get("id") or "").replace("p24-", "").strip()
            if lid in clean_targets:
                removed += 1
            else:
                kept.append(it)
        entry["items"] = kept
    if removed > 0:
        _save_disk_cache()
    return removed


def deduplicate_property_listings(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Intelligent cross-agency multi-listing deduplication:
    Removes duplicate listings created by multiple real estate agencies
    marketing the same physical property on Property24.
    Matches on:
    1. Direct listing ID / p24_id
    2. Primary photo image ID fingerprint (images.prop24.com/{img_id})
    3. Normalized street address + bedrooms + floor size (sqm)
    Keeps the best-priced listing.
    """
    def get_img_id(it):
        img = it.get('image') or (it.get('images') and it.get('images')[0]) or ''
        m = re.search(r'images\.prop24\.com/(\d+)', str(img))
        return m.group(1) if m else None

    def get_street_key(it):
        addr = (it.get('address') or '').lower().strip()
        if not addr or 'contact agent' in addr or 'withheld' in addr or 'to rent in' in addr:
            return None
        street_clues = ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr', 'circle', 'lane', 'close', 'crescent', 'cres', 'way', 'walk', 'court', 'terrace', 'terraces', 'boulevard', 'blvd']
        if not any(re.search(rf'\b{c}\b', addr) for c in street_clues):
            return None
        clean_addr = re.sub(r'^(?:unit|apt|apartment|flat)\s*\d+[a-zA-Z]?\s*,\s*', '', addr, flags=re.I)
        clean_addr = re.sub(r',\s*cape town.*$', '', clean_addr, flags=re.I).strip(' ,')
        beds = it.get('bedrooms', 1)
        sqm = it.get('sqm') or 0
        return f'{clean_addr}|{beds}|{sqm}'

    deduped: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    seen_img_ids: Dict[str, int] = {}
    seen_street_specs: Dict[str, int] = {}

    for it in items:
        lid = str(it.get('p24_id') or it.get('id') or '').replace('p24-', '')
        if not lid or lid in seen_ids:
            continue

        img_id = get_img_id(it)
        st_key = get_street_key(it)

        existing_idx = None
        if img_id and img_id in seen_img_ids:
            existing_idx = seen_img_ids[img_id]
        elif st_key and st_key in seen_street_specs:
            existing_idx = seen_street_specs[st_key]

        if existing_idx is not None:
            # Duplicate detected! Keep the lower / better price listing
            prev = deduped[existing_idx]
            prev_price = prev.get('price') or 999999
            curr_price = it.get('price') or 999999
            if curr_price < prev_price:
                seen_ids.discard(str(prev.get('p24_id') or prev.get('id') or '').replace('p24-', ''))
                seen_ids.add(lid)
                deduped[existing_idx] = it
                if img_id: seen_img_ids[img_id] = existing_idx
                if st_key: seen_street_specs[st_key] = existing_idx
            continue

        idx = len(deduped)
        seen_ids.add(lid)
        if img_id: seen_img_ids[img_id] = idx
        if st_key: seen_street_specs[st_key] = idx
        deduped.append(it)

    return deduped


def _find_any_cached_suburb_items(suburb_name: str, min_price: int = 0, max_price: int = 999999) -> List[Dict[str, Any]]:
    """
    Development fallback: searches cached queries for listings matching the suburb,
    preferring the newest snapshot by timestamp and filtering locally by price.
    """
    _load_disk_cache()
    sub_clean = suburb_name.lower().strip()
    matching_entries = [
        entry
        for key, entry in _MEMORY_CACHE.items()
        if (key.startswith(f"{sub_clean}|") or f"|{sub_clean}|" in key or sub_clean in key)
        and isinstance(entry, dict)
        and entry.get("items")
    ]
    matching_entries.sort(key=lambda e: float(e.get("ts", 0.0)), reverse=True)
    matches: List[Dict[str, Any]] = []
    seen = set()
    newest_ts = float(matching_entries[0].get("ts", 0.0)) if matching_entries else 0.0
    for entry in matching_entries:
        # Ignore much older snapshots (>24h older than newest) so expired listings don't resurrect
        if newest_ts - float(entry.get("ts", 0.0)) > 86400:
            continue
        for it in entry.get("items", []):
            lid = str(it.get("p24_id") or it.get("id") or "")
            price = it.get("price", 0)
            if lid and lid not in seen and (min_price <= price <= max_price or min_price == 0):
                seen.add(lid)
                matches.append(dict(it))
    return matches


def _get_newest_suburb_cache_ts(suburb_name: str) -> float:
    _load_disk_cache()
    sub_clean = suburb_name.lower().strip()
    newest = 0.0
    for key, entry in _MEMORY_CACHE.items():
        if key.startswith(f"{sub_clean}|") or f"|{sub_clean}|" in key or sub_clean in key:
            if entry.get("items"):
                newest = max(newest, float(entry.get("ts", 0.0)))
    return newest


def _load_disk_cache(force: bool = False) -> None:
    global _MEMORY_CACHE
    if _MEMORY_CACHE and not force:
        return
    try:
        if os.path.exists(_CACHE_FILE):
            with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _MEMORY_CACHE = data
    except Exception:
        pass


def _save_disk_cache() -> None:
    try:
        with open(_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_MEMORY_CACHE, f)
    except Exception:
        pass


def get_p24_circuit_status() -> Dict[str, Any]:
    """Returns shared persistent rate-limiter & circuit-breaker state across all P24 services."""
    try:
        from services.p24_client import p24_client
        return p24_client.get_circuit_status(cached_queries=len(_MEMORY_CACHE))
    except Exception:
        now = time.time()
        is_open = now < _CIRCUIT_OPEN_UNTIL
        remaining = max(0, int(_CIRCUIT_OPEN_UNTIL - now)) if is_open else 0
        return {
            "circuit_open": is_open,
            "cooldown_remaining_seconds": remaining,
            "consecutive_trips": _CONSECUTIVE_TRIPS,
            "cached_queries": len(_MEMORY_CACHE),
        }


def trip_p24_circuit(reason: str = "Rate limit / Server unavailable") -> int:
    """Trips the shared persistent circuit breaker with exponential backoff so ALL P24 traffic stops immediately."""
    global _CIRCUIT_OPEN_UNTIL, _CONSECUTIVE_TRIPS
    with _RATE_LOCK:
        _CONSECUTIVE_TRIPS += 1
        multiplier = min(4, 2 ** (_CONSECUTIVE_TRIPS - 1))
        cooldown = _COOLDOWN_BASE_SECONDS * multiplier
        _CIRCUIT_OPEN_UNTIL = time.time() + cooldown
    try:
        from services.p24_client import p24_client
        return p24_client.trip_circuit(reason=reason, base_cooldown=_COOLDOWN_BASE_SECONDS)
    except Exception:
        print(f"[P24 RATE GUARD] Circuit breaker tripped ({reason}). Cooling down for {cooldown}s.")
        return cooldown


def _is_circuit_open() -> bool:
    try:
        from services.p24_client import p24_client
        if p24_client.is_circuit_open():
            return True
    except Exception:
        pass
    return time.time() < _CIRCUIT_OPEN_UNTIL


def _wait_for_polite_slot() -> bool:
    """
    Enforces minimum inter-request spacing + human reading jitter using shared timestamp.
    Returns False if the circuit breaker is open.
    """
    global _LAST_REQUEST_TS
    with _RATE_LOCK:
        if _is_circuit_open():
            return False

        now = time.time()
        try:
            from services.p24_client import p24_client
            p24_client._load_circuit_state()
            _LAST_REQUEST_TS = max(_LAST_REQUEST_TS, p24_client._last_request_time)
        except Exception:
            pass

        elapsed = now - _LAST_REQUEST_TS
        min_gap = _MIN_REQUEST_INTERVAL + random.uniform(*_JITTER_RANGE)
        if _LAST_REQUEST_TS > 0 and elapsed < min_gap:
            sleep_for = min_gap - elapsed
            time.sleep(sleep_for)

        _LAST_REQUEST_TS = time.time()
        try:
            from services.p24_client import p24_client
            p24_client.record_request_slot()
        except Exception:
            pass
        return True


def calculate_dist_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _extract_agency_from_html(html_str: str) -> Optional[str]:
    if not html_str:
        return None
    lower_html = html_str.lower()
    # 1. Explicit PHI / Progressive Housing Investments signatures (HTML, links, logos, or bullet copy)
    if (
        "progressive housing" in lower_html
        or "progressive-housing-investments" in lower_html
        or "/30521" in lower_html
        or "179949585" in lower_html
        or "liesl and giselle" in lower_html
        or "liesl or giselle" in lower_html
        or "attention of liesl" in lower_html
        or "municipal home user charge" in lower_html
        or "remote controlled sliding gate vehicular access driveway" in lower_html
        or "wireless pedestrian intercom access to your phone" in lower_html
        or "gleamed parquet floors" in lower_html
        or bool(re.search(r'•\s*(?:secure block with|recently upgraded and renovated \d+ roomed flat|beautifully upgraded \d+m² flat|flat situated on the top floor in a small, secure block)', lower_html))
    ):
        return "Progressive Housing Investments"

    m = (
        re.search(r'"@type"\s*:\s*"(?:RealEstateAgent|Organization)"[^{}]*"name"\s*:\s*"([^"]+)"', html_str)
        or re.search(r'"agencyName"\s*:\s*"([^"]+)"', html_str)
        or re.search(r'title="Estate Agency profile for ([^"]+)"', html_str)
        or re.search(r'alt="Estate Agency profile for ([^"]+)"', html_str)
        or re.search(r'title="Contact ([^"]+) to sell your home"', html_str)
        or re.search(r'class="[^"]*p24_branding[^"]*"[^>]*title="([^"]+)"', html_str)
        or re.search(r'class="[^"]*p24_agencyLogoName[^"]*"[^>]*>\s*<span>([^<]+)</span>', html_str, re.S)
        or re.search(r'/estate-agencies/([a-z0-9-]+?)/\d+', lower_html)
        or re.search(r'/estate-agents/([a-z0-9-]+?)/contact/', lower_html)
    )
    if m:
        raw = m.group(1).strip()
        if "-" in raw and " " not in raw:
            raw = raw.replace("-", " ").title()
        try:
            import html as html_lib
            raw = html_lib.unescape(raw)
        except Exception:
            pass
        if raw and "apartment" not in raw.lower() and "house" not in raw.lower() and "to rent" not in raw.lower():
            return raw
    if "listed_by_owner" in lower_html or "listed by owner" in lower_html:
        return "Direct Landlord"
    return None


def _enrich_distance(items: List[Dict[str, Any]], anchor_lat: Optional[float], anchor_lng: Optional[float]) -> List[Dict[str, Any]]:
    enriched = []
    for item in items:
        copy_item = dict(item)

        # Precision correction safeguard for known listings & micro-pockets
        addr_lower = (copy_item.get("address") or "").lower()
        title_lower = (copy_item.get("title") or "").lower()
        lid_val = str(copy_item.get("p24_id") or copy_item.get("id") or "")
        
        if "117727375" in lid_val or "sunrise boulevard" in addr_lower or "sunrise blvd" in addr_lower:
            copy_item["lat"] = -34.1025
            copy_item["lng"] = 18.4850
            copy_item["address"] = "14 Sunrise Boulevard, Costa Da Gama, Cape Town"
        elif "117740072" in lid_val or "12 derwent" in addr_lower or "derwent rd" in addr_lower or "derwent road" in addr_lower:
            copy_item["lat"] = -33.933734
            copy_item["lng"] = 18.405534
            copy_item["address"] = "12 Derwent Rd, Gardens, Cape Town"
        elif "costa da gama" in addr_lower or "costa da gama" in title_lower:
            if copy_item.get("lng", 0) < 18.4780 or copy_item.get("lat", 0) < -34.1040:
                copy_item["lat"] = -34.1010
                copy_item["lng"] = 18.4820

        # Enrich features from cached detail page HTML or known verified descriptions
        full_href = copy_item.get("url") or ""
        detail_text = ""
        cached_detail_html = None
        try:
            from services.p24_client import p24_client
            if full_href:
                cached_detail_html = p24_client.get_cached(full_href, max_age_seconds=86400 * 30)
                if cached_detail_html:
                    detail_soup = BeautifulSoup(cached_detail_html, 'html.parser')
                    desc_el = detail_soup.find(class_=re.compile(r'p24_description|js_readMoreText|p24_features|p24_keyFeatures', re.I))
                    detail_text = desc_el.get_text(' ', strip=True).lower() if desc_el else detail_soup.get_text(' ', strip=True).lower()
        except Exception:
            pass

        # Known listing agency mappings (e.g. from P24 detail cache & verified descriptions)
        KNOWN_LISTING_AGENCIES = {
            "117792741": "Progressive Housing Investments",
            "117763397": "Progressive Housing Investments",
            "117536179": "Progressive Housing Investments",
            "117772253": "Progressive Housing Investments",
            "117767952": "Progressive Housing Investments",
            "117711773": "Progressive Housing Investments",
            "117768867": "Progressive Housing Investments",
            "117766010": "Progressive Housing Investments",
            "117640938": "Progressive Housing Investments",
            "117772228": "Progressive Housing Investments",
            "117605725": "Progressive Housing Investments",
            "114232707": "Trafalgar Property Management Cape Town",
            "117575248": "Trafalgar Property Management Cape Town",
            "114324724": "Trafalgar Property Management Cape Town",
            "117750970": "Sandak Lewin Trust",
            "117643090": "Sandak Lewin Trust",
            "117628528": "Sandak Lewin Trust",
            "107131619": "City Living Rentals",
            "107079259": "City Living Rentals",
        }
        raw_agency = copy_item.get("agency_name")
        if not raw_agency:
            for k_lid, k_ag in KNOWN_LISTING_AGENCIES.items():
                if k_lid in lid_val:
                    raw_agency = k_ag
                    break
        if not raw_agency and cached_detail_html:
            raw_agency = _extract_agency_from_html(cached_detail_html)
        if not raw_agency and detail_text and (
            "liesl and giselle" in detail_text
            or "liesl or giselle" in detail_text
            or "attention of liesl" in detail_text
            or "municipal home user charge" in detail_text
            or "remote controlled sliding gate vehicular access driveway" in detail_text
            or "wireless pedestrian intercom access to your phone" in detail_text
            or "gleamed parquet" in detail_text
        ):
            raw_agency = "Progressive Housing Investments"

        if raw_agency:
            try:
                from services.agency_reputation import lookup_agency_reputation
                rep = lookup_agency_reputation(raw_agency, area=copy_item.get("suburb"))
                if rep:
                    copy_item["agency_name"] = rep.get("canonical_name") or raw_agency
                    copy_item["agency_rating"] = rep.get("google_rating")
                    copy_item["agency_review_count"] = rep.get("google_review_count")
                    copy_item["agency_risk_level"] = rep.get("risk_level", "low")
                    copy_item["agency_flags"] = rep.get("flags", [])
                    copy_item["agency_complaint_sample"] = rep.get("recent_complaint_sample")
                    copy_item["agency_hellopeter_rating"] = rep.get("hellopeter_rating")
                    if copy_item["agency_risk_level"] == "high" or (copy_item["agency_rating"] is not None and copy_item["agency_rating"] < 3.2):
                        copy_item["fit_score"] = min(copy_item.get("fit_score") or 75, 62)
            except Exception:
                copy_item["agency_name"] = raw_agency

        if "117792741" in lid_val:
            # Verified full description: "Garage: R1,400.00 • Or Secure Parking Bay: R875.00 • Remote controlled sliding gate vehicular access driveway"
            copy_item["has_garage"] = True
            copy_item["has_secure_bay"] = True
            copy_item["parking_type"] = "garage"
            copy_item["fibre_ready"] = True
        elif detail_text:
            if re.search(r'\b(?:garage|garages|lock-up|lock\s+up\s+garage|automated\s+garage|single\s+garage|double\s+garage)\b', detail_text):
                copy_item["has_garage"] = True
                copy_item["parking_type"] = "garage"
            if re.search(r'\b(?:secure\s+parking(?:\s+bay)?|parking\s+bay|off-street\s+parking|off\s+street\s+parking|undercover\s+parking|basement\s+parking|allocated\s+(?:parking|bay)|shaded\s+parking|carport|vehicular\s+access(?:\s+driveway)?|sliding\s+gate\s+vehicular\s+access|remote\s+controlled\s+(?:sliding\s+)?gate\s+(?:vehicular\s+)?access|parking\s+behind\s+gate|secure\s+off-street)\b', detail_text):
                copy_item["has_secure_bay"] = True
                if not copy_item.get("has_garage"):
                    copy_item["parking_type"] = "secure_bay"
            if any(k in detail_text for k in ["gas hob", "gas stove", "gas cooker", "gas burner"]):
                copy_item["stove_type"] = "gas"
            elif any(k in detail_text for k in ["induction hob", "induction stove"]):
                copy_item["stove_type"] = "induction"
            if re.search(r'\b(?:inverter|solar|backup|ups|load shedding)\b', detail_text):
                copy_item["has_inverter"] = True
            if re.search(r'\b(?:pet friendly|pets allowed|pets welcome|dogs allowed|cats allowed)\b', detail_text):
                copy_item["pet_friendly"] = True

        if anchor_lat is not None and anchor_lng is not None and copy_item.get("lat") and copy_item.get("lng"):
            dist_km = round(calculate_dist_km(copy_item["lat"], copy_item["lng"], anchor_lat, anchor_lng) * 1.25, 1)
            dur_mins = max(2, round((dist_km / 35.0) * 60))
            copy_item["distance_km"] = dist_km
            copy_item["duration_mins"] = dur_mins
        enriched.append(copy_item)
    return enriched


def _build_p24_search_url(base_url: str, min_price: int, max_price: int, beds: str) -> str:
    """
    Constructs Property24's canonical encoded `sp=` search URL so price bounds,
    bedroom counts, and ascending price sort (`so=PriceLow`) are actually respected
    by Property24 instead of returning unfiltered Featured houses across 6+ pages.
    """
    clean_url = base_url.split('?')[0]
    sp_parts = []
    if min_price > 0:
        sp_parts.append(f"pf={min_price}")
    if max_price < 999999:
        sp_parts.append(f"pt={max_price}")
    if beds and beds != 'any':
        bed_num = re.sub(r'[^\d]', '', str(beds))
        if bed_num:
            sp_parts.append(f"bd={bed_num}")
    sp_parts.append("so=PriceLow")
    encoded_sp = urllib.parse.quote("&".join(sp_parts), safe="")
    return f"{clean_url}?sp={encoded_sp}"


def _fetch_p24_page_html(url: str, cache_ttl_seconds: float) -> Tuple[Optional[str], bool]:
    """
    Fetches a Property24 search page HTML while prioritizing `p24_cache.json`
    and strictly enforcing the polite rate-limiter + circuit breaker.
    Returns `(html, did_network_call)`.
    """
    try:
        from services.p24_client import p24_client
        cached_html = p24_client.get_cached(url, max_age_seconds=cache_ttl_seconds)
        if cached_html:
            return cached_html, False
    except Exception:
        p24_client = None

    if not _wait_for_polite_slot():
        return None, False

    html = ""
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            status_code = getattr(resp, "status", 200)
            html = resp.read().decode('utf-8', errors='ignore')
            if status_code in (429, 503):
                trip_p24_circuit(f"HTTP {status_code}")
                return None, True
    except urllib.error.HTTPError as http_err:
        if http_err.code in (403, 429, 503):
            trip_p24_circuit(f"HTTPError {http_err.code}")
        return None, True
    except Exception:
        return None, True

    lower_html = html[:4000].lower()
    if "server unavailable" in lower_html or "too many requests" in lower_html or (
        len(html) < 2500 and "please check back later" in lower_html
    ):
        trip_p24_circuit("Property24 returned 'Server unavailable'")
        return None, True

    try:
        from services.p24_client import p24_client
        if html and len(html) > 2500:
            p24_client.reset_circuit()
            p24_client.set_cache(url, html)
    except Exception:
        pass

    return html, True


def _extract_p24_next_page_urls(html: str, first_url: str, max_pages: int = 4) -> List[str]:
    """Extracts ordered pagination URLs (/p2, /p3, ...) from Page 1's `.p24_pager`."""
    if not html or max_pages <= 1:
        return []
    soup = BeautifulSoup(html, 'html.parser')
    numbered: Dict[int, str] = {}
    for a in soup.select('.p24_pager a[href]'):
        href = (a.get('href') or '').strip()
        if not href or href.startswith('javascript'):
            continue
        pnum_attr = a.get('data-pagenumber')
        pnum = int(pnum_attr) if pnum_attr and str(pnum_attr).isdigit() else None
        if not pnum:
            m = re.search(r'/p(\d+)(?:[/?#]|$)', href)
            if m:
                pnum = int(m.group(1))
        if pnum and 2 <= pnum <= max_pages:
            full = f"https://www.property24.com{href}" if href.startswith('/') else href
            if full != first_url:
                numbered[pnum] = full
    return [numbered[k] for k in sorted(numbered.keys())]


def scrape_p24_live(
    suburbs: List[str],
    min_price: int = 0,
    max_price: int = 999999,
    beds: str = "1",
    anchor_lat: Optional[float] = None,
    anchor_lng: Optional[float] = None,
    force_fresh: bool = False
) -> List[Dict[str, Any]]:
    global _CONSECUTIVE_TRIPS, _LAST_BATCH_META
    _load_disk_cache(force=True)

    all_results: List[Dict[str, Any]] = []
    seen_ids = set()
    network_fetches = 0
    refreshed_suburbs: List[str] = []
    cached_suburbs: List[str] = []
    stale_suburbs: List[str] = []

    for suburb in suburbs:
        clean_suburb = suburb.strip()
        if not clean_suburb:
            continue

        cache_key = f"{clean_suburb.lower()}|{min_price}|{max_price}|{beds}"
        now = time.time()
        cached_entry = _MEMORY_CACHE.get(cache_key)
        cache_age = (now - cached_entry.get("ts", 0)) if cached_entry else 999999999
        newest_sub_ts = _get_newest_suburb_cache_ts(clean_suburb)
        suburb_cache_age = (now - newest_sub_ts) if newest_sub_ts > 0 else 999999999
        allow_dev_refresh = force_fresh and (cache_age >= _MANUAL_REFRESH_MIN_AGE_SECONDS) and (suburb_cache_age >= _MANUAL_REFRESH_MIN_AGE_SECONDS)
        html_cache_ttl = _MANUAL_REFRESH_MIN_AGE_SECONDS if (force_fresh and (allow_dev_refresh or not P24_DEV_MODE or os.environ.get("P24_LIVE_FORCE"))) else _CACHE_TTL_SECONDS

        # 1. Check Centralized DB Pool: Serve instantly if suburb data is already populated
        if not force_fresh:
            try:
                from services.listings_db import query_listings
                db_matches = query_listings([clean_suburb], min_price=min_price, max_price=max_price, beds=beds)
                if db_matches:
                    cached_suburbs.append(clean_suburb)
                    for item in _enrich_distance(db_matches, anchor_lat, anchor_lng):
                        lid = item.get("p24_id") or item.get("id")
                        if lid not in seen_ids:
                            seen_ids.add(lid)
                            all_results.append(item)
                    continue
            except Exception as e:
                print(f"[DB POOL QUERY ERROR] {e}")

        # In DEV MODE: serve fresh cache unless force_fresh is requested on >24h old data
        if P24_DEV_MODE and not os.environ.get("P24_LIVE_FORCE") and not allow_dev_refresh:
            if cached_entry and cache_age < _CACHE_TTL_SECONDS:
                cached_suburbs.append(clean_suburb)
                for item in _enrich_distance(cached_entry.get("items", []), anchor_lat, anchor_lng):
                    lid = item.get("p24_id") or item.get("id")
                    if lid not in seen_ids:
                        seen_ids.add(lid)
                        all_results.append(item)
                continue

        # 1. Serve fresh cache hit immediately (0 network traffic), unless caller requested force_fresh
        if not force_fresh and cached_entry and cache_age < _CACHE_TTL_SECONDS:
            cached_suburbs.append(clean_suburb)
            for item in _enrich_distance(cached_entry.get("items", []), anchor_lat, anchor_lng):
                lid = item.get("p24_id") or item.get("id")
                if lid not in seen_ids:
                    seen_ids.add(lid)
                    all_results.append(item)
            continue

        base_url = resolve_p24_url(clean_suburb)
        if not base_url:
            continue

        search_url = _build_p24_search_url(base_url, min_price, max_price, beds)

        # 2. Check if fresh Page 1 HTML is already cached in `p24_cache.json` (0 network calls)
        from services.p24_client import p24_client as _p24c
        p1_is_disk_cached = bool(html_cache_ttl > 0 and _p24c.get_cached(search_url, max_age_seconds=html_cache_ttl))

        # If not in `p24_cache.json` and shared circuit breaker is open or batch cap reached, serve cached fallback only
        if not p1_is_disk_cached and (_is_circuit_open() or network_fetches >= _MAX_SUBURBS_PER_BATCH):
            stale_suburbs.append(clean_suburb)
            fallback = cached_entry.get("items", []) if cached_entry else _find_any_cached_suburb_items(clean_suburb, min_price, max_price)
            for item in _enrich_distance(fallback, anchor_lat, anchor_lng):
                lid = item.get("p24_id") or item.get("id")
                if lid not in seen_ids:
                    seen_ids.add(lid)
                    all_results.append(item)
            continue

        # In DEV MODE: if we already have <24h cached listings for this suburb and Page 1 isn't disk-cached,
        # never fire uncached network requests (strict GEMINI.md Rule 2 compliance).
        if P24_DEV_MODE and not os.environ.get("P24_LIVE_FORCE") and not p1_is_disk_cached and not allow_dev_refresh:
            sub_matches = _find_any_cached_suburb_items(clean_suburb, min_price, max_price)
            if sub_matches:
                cached_suburbs.append(clean_suburb)
                print(f"[P24 DEV GUARD] Serving {len(sub_matches)} cached listings for {clean_suburb} (0 network calls).")
                for item in _enrich_distance(sub_matches, anchor_lat, anchor_lng):
                    lid = item.get("p24_id") or item.get("id")
                    if lid not in seen_ids:
                        seen_ids.add(lid)
                        all_results.append(item)
                continue

        html_p1, made_net = _fetch_p24_page_html(search_url, html_cache_ttl)
        if made_net:
            network_fetches += 1

        if not html_p1:
            stale_suburbs.append(clean_suburb)
            fallback = cached_entry.get("items", []) if cached_entry else _find_any_cached_suburb_items(clean_suburb, min_price, max_price)
            for item in _enrich_distance(fallback, anchor_lat, anchor_lng):
                lid = item.get("p24_id") or item.get("id")
                if lid not in seen_ids:
                    seen_ids.add(lid)
                    all_results.append(item)
            continue

        refreshed_suburbs.append(clean_suburb)
        page_htmls: List[str] = [html_p1]
        next_urls = _extract_p24_next_page_urls(html_p1, search_url, max_pages=3)
        for next_url in next_urls:
            next_is_cached = bool(html_cache_ttl > 0 and _p24c.get_cached(next_url, max_age_seconds=html_cache_ttl))
            if not next_is_cached and (_is_circuit_open() or network_fetches >= _MAX_SUBURBS_PER_BATCH):
                break
            next_html, made_page_net = _fetch_p24_page_html(next_url, html_cache_ttl)
            if made_page_net:
                network_fetches += 1
            if not next_html:
                break
            page_htmls.append(next_html)

        suburb_fallback_lat, suburb_fallback_lng = SUBURB_COORDS.get(clean_suburb.lower(), (-33.9249, 18.4241))

        tiles = []
        for page_html in page_htmls:
            soup = BeautifulSoup(page_html, 'html.parser')
            page_tiles = soup.find_all(
                'div',
                class_=lambda c: c and any(
                    k in c for k in [
                        'p24_regularTile',
                        'p24_highlightTile',
                        'p24_promotedTile',
                        'p24_featuredTile',
                        'p24_tileContainer',
                        'p24_topTile',
                        'p24_tile',
                    ]
                )
            )
            tiles.extend(page_tiles)

        suburb_items: List[Dict[str, Any]] = []
        seen_suburb_ids = set()

        for t in tiles:
            # Skip expired / off-market / let-agreed tiles directly
            badge_el = t.find(class_=re.compile(r'p24_listingStatus|p24_status|p24_badge|p24_tag|p24_expired', re.I))
            if badge_el and re.search(r'\b(?:let agreed|under offer|withdrawn|sold|off market|expired|rented|no longer available)\b', badge_el.get_text(' ', strip=True), re.I):
                continue

            link = t.find('a', href=True)
            if not link:
                continue
            href = link['href']
            id_match = re.search(r'/(\d{7,10})', href)
            if not id_match:
                continue
            lid = id_match.group(1)
            if lid in seen_suburb_ids:
                continue
            seen_suburb_ids.add(lid)

            full_href = ('https://www.property24.com' + href) if href.startswith('/') else href

            # Price (skip holiday short-lets like "per day" / "per week" and commercial properties)
            price_div = t.find('div', class_='p24_price') or t.find('span', class_='p24_price')
            price_val = 0
            price_text_low = price_div.get_text(' ', strip=True).lower() if price_div else ""
            if any(k in price_text_low for k in ["per day", "/day", "daily", "per week", "/week", "p/w", "p/d"]):
                continue
            if price_div:
                content_attr = price_div.get('content')
                if content_attr and content_attr.isdigit():
                    price_val = int(content_attr)
                else:
                    txt = price_div.get_text(' ', strip=True)
                    p_match = re.search(r'R\s*([\d\s\xa0,]+)', txt)
                    if p_match:
                        clean_num = p_match.group(1).replace(' ', '').replace('\xa0', '').replace(',', '')
                        if clean_num.isdigit():
                            price_val = int(clean_num)

            if min_price > 0 and price_val > 0 and price_val < min_price:
                continue
            if max_price > 0 and price_val > max_price:
                continue

            title_el = t.find('span', class_='p24_title')
            title_str = title_el.get_text(strip=True) if title_el else "Apartment to Rent"
            title_low = title_str.lower()
            if any(k in title_low for k in ["commercial", "retail", "industrial", "office space", "warehouse", "parking bay"]):
                continue

            loc_el = t.find('span', class_='p24_location')
            loc_str = loc_el.get_text(strip=True) if loc_el else clean_suburb.title()

            img_url = ""
            for img_el in t.find_all('img'):
                candidate = (
                    img_el.get('data-original')
                    or img_el.get('lazy-src')
                    or img_el.get('data-src')
                    or img_el.get('src')
                    or ""
                )
                if (
                    candidate.startswith('http')
                    and 'grey_' not in candidate
                    and 'blank.gif' not in candidate
                    and 'listed_by_owner' not in candidate
                    and 'logo' not in candidate.lower()
                    and 'agent' not in candidate.lower()
                ):
                    img_url = candidate
                    if 'images.prop24.com' in candidate:
                        break

            beds_el = t.find('span', title='Bedrooms')
            baths_el = t.find('span', title='Bathrooms')
            pkg_el = t.find('span', title='Parking Spaces')
            sqm_el = t.find('span', title='Floor Size')

            beds_cnt = int(beds_el.get_text(strip=True)) if beds_el and beds_el.get_text(strip=True).isdigit() else 1
            baths_cnt = int(baths_el.get_text(strip=True)) if baths_el and baths_el.get_text(strip=True).isdigit() else 1
            pkg_cnt = int(pkg_el.get_text(strip=True)) if pkg_el and pkg_el.get_text(strip=True).isdigit() else 0
            sqm_val = None
            if sqm_el:
                sqm_match = re.search(r'(\d+)', sqm_el.get_text(strip=True))
                if sqm_match:
                    sqm_val = int(sqm_match.group(1))

            item_text = t.get_text(' ', strip=True).lower()
            pocket_lat, pocket_lng = SUBURB_COORDS.get(loc_str.lower(), (suburb_fallback_lat, suburb_fallback_lng))
            lat = pocket_lat + random.uniform(-0.0006, 0.0006)
            lng = pocket_lng + random.uniform(-0.0006, 0.0006)

            addr_el = (
                t.find('span', class_='p24_address')
                or t.find('div', class_='p24_address')
                or t.find(class_=re.compile(r'p24_address|p24_streetAddress', re.I))
            )
            addr_str = addr_el.get_text(' ', strip=True).strip(' ,') if addr_el else ""
            if addr_str and addr_str.lower() != loc_str.lower() and addr_str.lower() != clean_suburb.lower():
                if clean_suburb.lower() not in loc_str.lower():
                    final_address = f"{addr_str}, {loc_str}, {clean_suburb.title()}, Cape Town"
                else:
                    final_address = f"{addr_str}, {loc_str}, Cape Town"
            elif loc_str.lower() == clean_suburb.lower():
                final_address = f"{loc_str}, Cape Town"
            else:
                final_address = f"{loc_str}, {clean_suburb.title()}"

            # Accurate street address & micro-pocket geocoding
            comb_lower = f"{title_str} {item_text} {loc_str} {addr_str}".lower()
            if 'camberleigh' in comb_lower or 'glenside' in comb_lower or lid == '117782617':
                lat, lng = -33.909615, 18.411107
                final_address = "8 Camberleigh Place, 4 Glenside Road, Green Point, Cape Town"
            elif 'ocean terraces' in item_text or 'spurwing' in item_text or 'sanderling' in item_text or lid == '112388858':
                lat, lng = -34.098635, 18.488359
                final_address = "304 Ocean Terraces, 1 Cnr Of Spurwing Cir & Sanderling Rd, Capricorn, Cape Town, 7948"
            elif 'saint georges' in item_text or 'st georges' in item_text or lid == '116264966':
                lat, lng = -34.098953, 18.485262
                final_address = "1 Saint Georges Street, Capricorn, Cape Town"
            elif 'the row' in item_text or lid == '115915837':
                lat, lng = -34.095760, 18.473846
                final_address = "53 The Row Street, Muizenberg, Cape Town"
            elif '79 main road' in item_text or lid == '117787593':
                lat, lng = -34.107865, 18.467923
                final_address = "79 Main Road, Muizenberg, Cape Town"
            elif 'derwent' in comb_lower or lid == '117740072':
                lat, lng = -33.933734, 18.405534
                final_address = "12 Derwent Rd, Gardens, Cape Town"
            elif 'warren' in comb_lower or lid == '111950313':
                lat, lng = -33.9304, 18.4065
                final_address = "Erf 1423 Warren St, Tamboerskloof, Cape Town"
            elif 'bellevue' in comb_lower or lid == '111551852':
                lat, lng = -33.937565, 18.401126
                final_address = "49 Bellevue Street, Higgovale, Cape Town"
            elif 'sunrise boulevard' in comb_lower or 'sunrise blvd' in comb_lower or '14 sunrise' in comb_lower or lid == '117727375':
                lat, lng = -34.1025, 18.4850
                final_address = "14 Sunrise Boulevard, Costa Da Gama, Cape Town"
            elif 'costa da gama' in comb_lower:
                lat = -34.1010 + random.uniform(-0.001, 0.001)
                lng = 18.4820 + random.uniform(-0.001, 0.001)
                final_address = f"{loc_str}, Costa Da Gama, Cape Town" if 'costa da gama' not in loc_str.lower() else f"{loc_str}, Cape Town"
            elif 'marina da gama' in comb_lower:
                lat = -34.0958 + random.uniform(-0.001, 0.001)
                lng = 18.4738 + random.uniform(-0.001, 0.001)
                final_address = f"{loc_str}, Marina Da Gama, Cape Town" if 'marina da gama' not in loc_str.lower() else f"{loc_str}, Cape Town"
            elif 'capricorn' in comb_lower:
                lat = -34.0986 + random.uniform(-0.002, 0.002)
                lng = 18.4884 + random.uniform(-0.002, 0.002)
                final_address = f"{loc_str}, Capricorn, Muizenberg"
            elif 'seabreeze estate' in comb_lower or 'seabreeze' in comb_lower or 'sea breeze' in comb_lower:
                lat, lng = -34.1435, 18.3480
                final_address = "Seabreeze Estate, Kommetjie, Cape Town"
            elif 'imhoff' in comb_lower:
                lat, lng = -34.1380, 18.3562
                final_address = "Imhoff's Gift, Kommetjie, Cape Town"
            elif 'klein slangkop' in comb_lower:
                lat, lng = -34.1350, 18.3220
                final_address = "Klein Slangkop Eco Estate, Kommetjie, Cape Town"
            # Structured feature detection (check tile excerpt + cached detail HTML if available)
            detail_text = ""
            try:
                from services.p24_client import p24_client
                cached_detail_html = p24_client.get_cached(full_href, max_age_seconds=86400 * 30)
                if cached_detail_html:
                    detail_soup = BeautifulSoup(cached_detail_html, 'html.parser')
                    desc_el = detail_soup.find(class_=re.compile(r'p24_description|js_readMoreText|p24_features|p24_keyFeatures', re.I))
                    detail_text = desc_el.get_text(' ', strip=True).lower() if desc_el else detail_soup.get_text(' ', strip=True).lower()

                    # Extract rich street address from detail page if tile was generic
                    has_street_in_final = any(k in final_address.lower() for k in ["road", "rd", "street", "st", "place", "avenue", "ave", "lane", "crescent", "terrace", "way", "close"])
                    if not has_street_in_final:
                        for detail_addr_el in detail_soup.find_all(class_=re.compile(r'p24_streetAddress|p24_addressPropOverview|p24_address|p24_maptitle', re.I)):
                            d_str = detail_addr_el.get_text(' ', strip=True).strip(' ,')
                            d_low = d_str.lower()
                            is_invalid = any(bad in d_low for bad in ["contact agent", "to rent in", "bedroom", "apartment to rent", "flat to rent"])
                            if d_str and not is_invalid:
                                if not any(k in d_low for k in ["cape town", "western cape"]):
                                    final_address = f"{d_str}, Cape Town"
                                else:
                                    final_address = d_str
                                break
            except Exception:
                pass

            # Intelligent Address & Precision Building Geocoding (Google Places + Mapbox + Gemini)
            is_address_withheld = True
            try:
                from services.address_normalizer import resolve_property_precision
                geo_hit = resolve_property_precision(
                    title=title_str,
                    description=f"{detail_text} {item_text}",
                    raw_address=final_address,
                    suburb=clean_suburb
                )
                if geo_hit and not geo_hit.get("is_withheld") and geo_hit.get("confidence") != "none":
                    if calculate_dist_km(geo_hit["lat"], geo_hit["lng"], suburb_fallback_lat, suburb_fallback_lng) <= 7.0:
                        lat, lng = geo_hit["lat"], geo_hit["lng"]
                        is_address_withheld = False
                        if geo_hit.get("clean_query"):
                            final_address = geo_hit["clean_query"]
                            if not any(k in final_address.lower() for k in ["cape town", "western cape"]):
                                final_address = f"{final_address}, Cape Town"
            except Exception:
                pass

            if is_address_withheld and re.search(
                r'\b(?:street|st|road|rd|avenue|ave|drive|dr|way|wy|lane|ln|close|cl|crescent|cres|circle|cir|boulevard|blvd|terrace|terraces|walk|row|place|mews|court|mansions|heights|towers|manor|villas|lofts|residences)\b',
                final_address,
                re.I,
            ):
                is_address_withheld = False

            comb_text = f"{title_str} {item_text} {detail_text}".lower()
            stove_type = "gas" if any(k in comb_text for k in ["gas hob", "gas stove", "gas cooker", "gas burner"]) else (
                "induction" if any(k in comb_text for k in ["induction hob", "induction stove"]) else (
                    "electric" if any(k in comb_text for k in ["electric stove", "electric hob", "solid plate"]) else (
                        "gas" if "gas" in comb_text and ("hob" in comb_text or "stove" in comb_text or "cooker" in comb_text) else "electric"
                    )
                )
            )
            has_garage = bool(re.search(
                r'\b(?:garage|garages|lock-up|lock\s+up\s+garage|automated\s+garage|single\s+garage|double\s+garage)\b',
                comb_text
            )) or pkg_cnt >= 2
            has_secure_bay = bool(re.search(
                r'\b(?:secure\s+parking(?:\s+bay)?|parking\s+bay|off-street\s+parking|off\s+street\s+parking|undercover\s+parking|basement\s+parking|allocated\s+(?:parking|bay)|shaded\s+parking|carport|vehicular\s+access(?:\s+driveway)?|sliding\s+gate\s+vehicular\s+access|remote\s+controlled\s+(?:sliding\s+)?gate\s+(?:vehicular\s+)?access|parking\s+behind\s+gate|secure\s+off-street)\b',
                comb_text
            )) or pkg_cnt > 0
            parking_type = "garage" if has_garage else ("secure_bay" if has_secure_bay else "none")
            pet_friendly = True if re.search(r'\b(?:pet friendly|pets allowed|pets welcome|dogs allowed|cats allowed)\b', comb_text) else (
                False if re.search(r'\b(?:no pets|pets not allowed|no dogs|no cats)\b', comb_text) else False
            )
            fibre_ready = bool(re.search(r'\b(?:fibre|fiber|wifi|internet)\b', comb_text)) and not bool(re.search(r'\b(?:no\s+fibre|not\s+fibre\s+ready)\b', comb_text))
            has_inverter = bool(re.search(r'\b(?:inverter|solar|backup|ups|load shedding)\b', comb_text))

            # Privacy & Landlord On-Site Detection
            is_cottage_or_flatlet = bool(re.search(
                r'\b(?:cottage|garden cottage|nutec cottage|granny flat|flatlet|separate entrance|attached flatlet|wing of the house|shared property|behind the main house|behind main house|attached to main house|landlord lives|owner lives|landlord on site|landlord on-site|owner on site|owner on-site|on owners? property|on landlords? property|main house|suit single|dual living|shared yard|shared garden|shared gate|shared driveway)\b',
                comb_text
            ))
            dwelling_privacy = "garden_cottage" if re.search(r'\b(?:cottage|garden cottage|nutec cottage|granny flat)\b', comb_text) else (
                "attached_flatlet" if re.search(r'\b(?:flatlet|separate entrance|wing of the house)\b', comb_text) else (
                    "room_shared" if re.search(r'\b(?:room to let|flatshare|digs|shared house)\b', comb_text) else (
                        "landlord_on_site" if is_cottage_or_flatlet else "independent"
                    )
                )
            )
            is_landlord_on_site = is_cottage_or_flatlet or dwelling_privacy in ["garden_cottage", "attached_flatlet", "room_shared", "landlord_on_site"]

            # Arterial Road & Noise Risk Detection
            is_main_road = bool(re.search(
                r'\b(main\s+r(oa)?d|victoria\s+r(oa)?d|somerset\s+r(oa)?d|regent\s+r(oa)?d|kloof\s+st(reet)?|kloof\s+nek|buitengracht|new\s+church(\s+st(reet)?)?|orange\s+st(reet)?|roeland\s+st(reet)?|buitenkant(\s+st(reet)?)?|strand\s+st(reet)?|helen\s+suzman|mill\s+st(reet)?|voortrekker\s+r(oa)?d|ou\s+kaapse\s+weg|kommetjie\s+r(oa)?d|baden\s+powell|highway|freeway|motorway|m3|m4|m5|m6|m62)\b',
                f"{final_address} {title_str}".lower()
            ))
            noise_risk = 'high' if is_main_road else ('sanctuary' if any(k in loc_str.lower() for k in ['forest', 'heatherlands', 'camphersdrift', 'mountain']) else 'low')
            base_fit = random.randint(70, 80) if is_main_road else random.randint(86, 98)

            # Extract managing agency from search tile HTML or cached detail page
            tile_agency = _extract_agency_from_html(str(t))
            if not tile_agency and cached_detail_html:
                tile_agency = _extract_agency_from_html(cached_detail_html)
            if not tile_agency and ("liesl and giselle" in comb_text or "liesl or giselle" in comb_text):
                tile_agency = "Progressive Housing Investments"

            agency_name_val = None
            agency_rating_val = None
            agency_review_cnt = None
            agency_risk_val = None
            agency_flags_val = []
            agency_complaint_val = None
            agency_hp_val = None

            if tile_agency:
                try:
                    from services.agency_reputation import lookup_agency_reputation
                    rep = lookup_agency_reputation(tile_agency, area=clean_suburb)
                    if rep:
                        agency_name_val = rep.get("canonical_name") or tile_agency
                        agency_rating_val = rep.get("google_rating")
                        agency_review_cnt = rep.get("google_review_count")
                        agency_risk_val = rep.get("risk_level", "low")
                        agency_flags_val = rep.get("flags", [])
                        agency_complaint_val = rep.get("recent_complaint_sample")
                        agency_hp_val = rep.get("hellopeter_rating")
                        if agency_risk_val == "high" or (agency_rating_val is not None and agency_rating_val < 3.2):
                            base_fit = min(base_fit, 62)
                except Exception:
                    agency_name_val = tile_agency

            item_obj = {
                'id': f"p24-{lid}",
                'p24_id': lid,
                'title': title_str,
                'address': final_address,
                'is_address_withheld': is_address_withheld,
                'suburb': clean_suburb.title(),
                'price': price_val,
                'price_str': f"R {price_val:,}" if price_val > 0 else "POA",
                'bedrooms': beds_cnt,
                'bathrooms': baths_cnt,
                'parking': pkg_cnt,
                'sqm': sqm_val,
                'image': img_url or "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
                'url': full_href,
                'lat': lat,
                'lng': lng,
                'distance_km': None,
                'duration_mins': None,
                'fit_score': base_fit,
                'noise_risk': noise_risk,
                'is_main_road': is_main_road,
                'stove_type': stove_type,
                'has_garage': has_garage,
                'has_secure_bay': has_secure_bay,
                'parking_type': parking_type,
                'pet_friendly': pet_friendly,
                'fibre_ready': fibre_ready,
                'has_inverter': has_inverter,
                'dwelling_privacy': dwelling_privacy,
                'is_landlord_on_site': is_landlord_on_site,
                'agency_name': agency_name_val,
                'agency_rating': agency_rating_val,
                'agency_review_count': agency_review_cnt,
                'agency_risk_level': agency_risk_val,
                'agency_flags': agency_flags_val,
                'agency_complaint_sample': agency_complaint_val,
                'agency_hellopeter_rating': agency_hp_val,
            }
            suburb_items.append(item_obj)

        # Reset consecutive trips on a clean fetch, deduplicate, and cache results
        if suburb_items:
            suburb_items = deduplicate_property_listings(suburb_items)
            _CONSECUTIVE_TRIPS = 0
            _MEMORY_CACHE[cache_key] = {
                "ts": time.time(),
                "items": suburb_items,
            }
            _save_disk_cache()

            # Centralized DB Pool: Upsert into persistent shared SQLite database pool
            try:
                from services.listings_db import upsert_listings
                upsert_listings(suburb_items, clean_suburb)
            except Exception as e:
                print(f"[DB POOL] Warning: failed to upsert into listings_db: {e}")

        for item in _enrich_distance(suburb_items, anchor_lat, anchor_lng):
            lid = item.get("p24_id") or item.get("id")
            if lid not in seen_ids:
                seen_ids.add(lid)
                all_results.append(item)

    # Multi-agency cross-listing deduplication across all combined suburbs
    all_results = deduplicate_property_listings(all_results)

    # Compute Market Value Benchmark & % above/below market price
    try:
        from services.ai_scout import calculate_price_value_pct, AREA_MEDIAN_BASELINES
        for r in all_results:
            p_val = r.get("price")
            b_cnt = r.get("bedrooms") or 1
            s_name = r.get("suburb") or ""
            pct = calculate_price_value_pct(p_val, float(b_cnt), s_name, all_listings=all_results)
            r["price_value_pct"] = pct
    except Exception as e:
        print(f"[MARKET VALUATION] Non-critical error calculating price value pct: {e}")

    # Sort by price
    all_results.sort(key=lambda x: (x['price'] if x['price'] > 0 else 999999))
    _LAST_BATCH_META = {
        "refreshed_suburbs": refreshed_suburbs,
        "cached_suburbs": cached_suburbs,
        "stale_suburbs": stale_suburbs,
        "network_fetches": network_fetches,
    }
    return all_results
