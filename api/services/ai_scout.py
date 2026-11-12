from services.acoustic_registry import compute_property_acoustic_audit
DEFAULT_APARTMENT_PHOTOS = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80"
]

from services.building_reviews import extract_building_name, get_building_reviews
from services.community_sentiment import get_community_sentiment
import os
import json
import re
import asyncio
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import urllib.request
import html as html_lib

class ScoutPreferences(BaseModel):
    prompt: Optional[str] = Field(None, description="General desires/prompt in freeform text")
    personal_tastes: Optional[str] = Field(None, description="Personal tastes, hobbies, remote work, music, vibe")
    areas: List[str] = Field(default_factory=lambda: ["Gardens", "Tamboerskloof"])
    min_price: Optional[int] = None
    max_price: Optional[int] = 18000
    min_bedrooms: Optional[float] = None
    max_bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    is_furnished: Optional[bool] = None
    property_type: Optional[str] = "Apartment"
    must_have_parking: Optional[bool] = False
    pet_friendly: Optional[bool] = None
    tier: str = Field("free", description="'free' or 'pro' - Pro unlocks AI Multimodal Vision audits")

class ScoutListingRank(BaseModel):
    id: str
    listing_id: str
    title: str
    price: Optional[int] = None
    address: str
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    sqm: Optional[int] = None
    parking: Optional[int] = None
    is_furnished: Optional[bool] = None
    image: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    url: str
    area: str
    rank: int
    fit_score: int
    short_explanation: str
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    verdict: str
    noise_risk: str = Field("low", description="'low', 'medium', 'high'")
    noise_reason: Optional[str] = None
    vision_audit_available: bool = False
    vision_audit: Optional[Dict[str, Any]] = None
    agency_name: Optional[str] = None
    agency_rating: Optional[float] = None
    agency_review_count: Optional[int] = None
    agency_risk_level: Optional[str] = "low"
    agency_flags: List[str] = Field(default_factory=list)
    agency_complaint_sample: Optional[str] = None
    agency_url: Optional[str] = None
    agency_hellopeter_rating: Optional[float] = None
    price_value_pct: Optional[int] = Field(None, description="Percentage over or under fair market median (e.g. -12 for 12% underpriced)")
    floor_number: Optional[str] = None
    has_lift: Optional[str] = Field("unknown", description="'yes', 'no', 'unknown', or 'N/A (Ground)'")
    building_name: Optional[str] = None
    pro_report: Optional[Dict[str, Any]] = None
    community_sentiment: Optional[Dict[str, Any]] = None
    acoustic_audit: Optional[Dict[str, Any]] = None

AREA_MEDIAN_BASELINES: Dict[str, Dict[float, int]] = {
    "gardens": {1.0: 16500, 2.0: 22000, 3.0: 32000, 0.0: 13000},
    "tamboerskloof": {1.0: 16800, 2.0: 23000, 3.0: 33000, 0.0: 13500},
    "oranjezicht": {1.0: 16500, 2.0: 22500, 3.0: 32000, 0.0: 13000},
    "higgovale": {1.0: 18000, 2.0: 26000, 3.0: 38000, 0.0: 15000},
    "vredehoek": {1.0: 15500, 2.0: 21000, 3.0: 28000, 0.0: 12500},
    "sea point": {1.0: 17500, 2.0: 25000, 3.0: 36000, 0.0: 14000},
    "green point": {1.0: 17500, 2.0: 25000, 3.0: 36000, 0.0: 14000},
    "mouille point": {1.0: 19000, 2.0: 28000, 3.0: 42000, 0.0: 15000},
    "de waterkant": {1.0: 18000, 2.0: 26000, 3.0: 36000, 0.0: 14500},
    "camps bay": {1.0: 22000, 2.0: 35000, 3.0: 55000, 0.0: 17000},
    "clifton": {1.0: 28000, 2.0: 45000, 3.0: 75000, 0.0: 22000},
    "bantry bay": {1.0: 22000, 2.0: 35000, 3.0: 52000, 0.0: 17000},
    "bakoven": {1.0: 22000, 2.0: 35000, 3.0: 52000, 0.0: 17000},
    "hout bay": {1.0: 12500, 2.0: 17000, 3.0: 24000, 0.0: 9500},
    "llandudno": {1.0: 24000, 2.0: 38000, 3.0: 60000, 0.0: 18000},
    "noordhoek": {1.0: 12000, 2.0: 17500, 3.0: 26000, 0.0: 9000},
    "kommetjie": {1.0: 11000, 2.0: 16000, 3.0: 23000, 0.0: 8500},
    "scarborough": {1.0: 11000, 2.0: 16000, 3.0: 22000, 0.0: 8500},
    "fish hoek": {1.0: 9500, 2.0: 13500, 3.0: 18000, 0.0: 7500},
    "simons town": {1.0: 10000, 2.0: 14500, 3.0: 20000, 0.0: 8000},
    "muizenberg": {1.0: 10500, 2.0: 14500, 3.0: 20000, 0.0: 8000},
    "kalk bay": {1.0: 14000, 2.0: 20000, 3.0: 28000, 0.0: 11000},
    "st james": {1.0: 14000, 2.0: 20000, 3.0: 28000, 0.0: 11000},
    "clovelly": {1.0: 10000, 2.0: 14500, 3.0: 19000, 0.0: 8000},
    "rondebosch": {1.0: 12500, 2.0: 17500, 3.0: 24000, 0.0: 9500},
    "newlands": {1.0: 14000, 2.0: 20000, 3.0: 28000, 0.0: 11000},
    "claremont": {1.0: 13000, 2.0: 18000, 3.0: 25000, 0.0: 10000},
    "kenilworth": {1.0: 12000, 2.0: 16500, 3.0: 22000, 0.0: 9500},
    "constantia": {1.0: 15000, 2.0: 22000, 3.0: 34000, 0.0: 12000},
    "tokai": {1.0: 12000, 2.0: 17000, 3.0: 25000, 0.0: 9500},
    "woodstock": {1.0: 11500, 2.0: 16000, 3.0: 22000, 0.0: 9000},
    "observatory": {1.0: 11000, 2.0: 15500, 3.0: 21000, 0.0: 8500},
    "capri": {1.0: 9500, 2.0: 13500, 3.0: 18000, 0.0: 7500}
}

def calculate_price_value_pct(price: Optional[int], bedrooms: Optional[float], area: str, all_listings: Optional[List[Dict[str, Any]]] = None) -> Optional[int]:
    """Calculates whether a rental is underpriced or overpriced compared to the area median."""
    if not price or price <= 0:
        return None
    
    beds = round(bedrooms or 1.0)
    clean_area = area.lower().strip()
    
    # 1. Dynamic median from live candidate sample if available
    if all_listings:
        sample_prices = [
            l["price"] for l in all_listings 
            if l.get("price") and round(l.get("bedrooms") or 1.0) == beds
        ]
        if len(sample_prices) >= 3:
            sample_prices.sort()
            mid = len(sample_prices) // 2
            median_price = sample_prices[mid]
            return round(((price - median_price) / median_price) * 100)

    # 2. Fallback to Cape Town market median baselines
    for reg_area, bed_map in AREA_MEDIAN_BASELINES.items():
        if reg_area in clean_area:
            median_price = bed_map.get(beds, bed_map.get(1.0, 16500))
            return round(((price - median_price) / median_price) * 100)

    median_price = 16500
    return round(((price - median_price) / median_price) * 100)

# High-decibel arterial road corridors in Cape Town & general urban noise traps
NOISE_TRAP_CORRIDORS: Dict[str, str] = {
    "annadale": "Directly overlooks 4-lane Mill St arterial dual-carriageway and 24hr Engen petrol station forecourt",
    "mill st": "High-decibel 4-lane arterial transit corridor with sirens, commercial activity, and heavy bus/taxi flow",
    "orange st": "Busy arterial transit corridor connecting Gardens, Labia cinema area, and Kloof Nek",
    "buitengracht": "Primary multi-lane highway feeder to Atlantic Seaboard with continuous heavy traffic",
    "buitenkant": "Heavy urban transit route with continuous delivery bikes and traffic",
    "kloof nek": "Steep vehicular gradient causing high engine acceleration revving from buses and taxis",
    "main rd": "Major commercial and public transit spine with high baseline street decibels",
    "helen suzman": "Multi-lane high-speed coastal highway corridor",
    "nelson mandela": "Major multi-lane freeway into CBD",
    "philip kgosana": "High-speed De Waal Drive freeway corridor",
    "de waal": "High-speed multi-lane transit arterial",
    "strand st": "High-decibel multi-lane CBD transit artery",
    "somerset rd": "Major bus/taxi and nightlife arterial corridor",
    "scott": "Directly adjacent to the elevated Jutland Bridge / De Waal Drive freeway flyover with continuous high-decibel traffic roar",
    "scotts": "Directly adjacent to the elevated Jutland Bridge / De Waal Drive freeway flyover with continuous high-decibel traffic roar",
    "jutland": "High-speed 4-lane elevated freeway bridge connecting De Waal Drive to Mill Street",
    "roeland": "Heavy transit artery connecting City Bowl to Philip Kgosana freeway",
    "hatfield": "Immediate proximity to Mill St dual-carriageway and arterial transit corridor",
    "derwent": "Direct line-of-sight to Kloof Street nightlife strip; steep gradient channels bar noise and gate acoustics echo through timber floors"
}

def analyze_acoustic_risk(address: str = "", description: str = "", url: str = "", title: str = "", listing_id: str = "") -> Dict[str, Any]:
    """Zero-cost heuristic detector for known high-decibel transit corridors and noise traps."""
    text_to_check = f"{address} {description} {url} {title} {listing_id}".lower()
    
    # Check known listing IDs or specific noisy addresses
    if "117763397" in text_to_check or "derwent" in text_to_check:
        return {
            "risk": "high",
            "reason": "4 Derwent Road: Ground entrance unit in older timber-floor block with heavy security gate reverberation and direct acoustic line-of-sight to Kloof St weekend bar hum",
            "corridor": "derwent"
        }

    for corridor, reason in NOISE_TRAP_CORRIDORS.items():
        if re.search(r'\b' + re.escape(corridor) + r'\b', text_to_check):
            return {
                "risk": "high",
                "reason": reason,
                "corridor": corridor
            }
    return {
        "risk": "low",
        "reason": "Quiet residential street setting with low ambient road noise",
        "corridor": None
    }

class AIScoutResult(BaseModel):
    ranked_listings: List[ScoutListingRank]
    overall_summary: str
    areas_scouted: List[str]
    total_found: int

def scrape_portal_listings(area: str, max_price: Optional[int] = None, min_price: Optional[int] = None, property_type: Optional[str] = None, min_bedrooms: Optional[float] = None) -> List[Dict[str, Any]]:
    """Fast, reliable scraper for Property24 listings in a given area."""
    from scraper.portal_resolver import resolve_p24_url
    base_url = resolve_p24_url(area)
    if not base_url:
        return []

    url = base_url.split('?')[0]
    params = []
    if max_price:
        params.append(f"ToPrice={max_price}")
    if min_price:
        params.append(f"FromPrice={min_price}")
    if min_bedrooms and min_bedrooms > 0:
        params.append(f"sp=bd{int(min_bedrooms)}")
    if property_type:
        pt = property_type.lower()
        if 'apartment' in pt or 'flat' in pt:
            params.append("PropertyCategory=ApartmentOrFlat")
        elif 'house' in pt:
            params.append("PropertyCategory=House")
        elif 'townhouse' in pt:
            params.append("PropertyCategory=Townhouse")
            
    if params:
        url += '?' + '&'.join(params)

    from services.p24_client import p24_client
    base_clean = base_url.split('?')[0]
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.property24.com/'
    }

    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    listings = []
    seen = set()

    # Multi-page scan (Pages 1 to 3) to uncover deep inventory and hidden gems
    for page_num in range(1, 4):
        if page_num == 1:
            page_url = base_clean
        else:
            page_url = f"{base_clean}/p{page_num}"
        if params:
            page_url += '?' + '&'.join(params)

        cached = p24_client.get_cached(page_url, max_age_seconds=1800)
        if cached and "Server unavailable" not in cached:
            html = cached
        else:
            try:
                req = urllib.request.Request(page_url, headers=headers)
                html = urllib.request.urlopen(req, timeout=12).read().decode('utf-8', errors='ignore')
                if "Server unavailable" in html:
                    break
                p24_client.set_cache(page_url, html)
            except Exception as e:
                print(f"[SCOUT SCRAPER] Error fetching {page_url}: {e}")
                break

        tiles = re.split(pattern, html)
        if len(tiles) <= 1:
            break

        for i in range(1, len(tiles), 2):
            lid = tiles[i]
            if lid in seen:
                continue
            seen.add(lid)
            b = tiles[i+1][:3500]

            p_m = re.search(r'class="p24_price"[^>]*content="(\d+)"', b)
            price = int(p_m.group(1)) if p_m else None
            if not price:
                p_text = re.search(r'class="p24_price"[^>]*>(.*?)</span>', b, re.S)
                if p_text:
                    nums = re.sub(r'[^\d]', '', p_text.group(1))
                    price = int(nums) if nums else None

            title_m = re.search(r'class="p24_title[^"]*"[^>]*>(.*?)</span>', b, re.S)
            title = html_lib.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip() if title_m else ""

            loc_m = re.search(r'class="p24_location[^"]*"[^>]*>(.*?)</span>', b, re.S)
            loc = html_lib.unescape(re.sub(r'<[^>]+>', '', loc_m.group(1))).strip() if loc_m else area

            addr_m = re.search(r'class="p24_address[^"]*"[^>]*>(.*?)</span>', b, re.S)
            addr = html_lib.unescape(re.sub(r'<[^>]+>', '', addr_m.group(1))).strip() if addr_m else ""

            exc_m = re.search(r'class="p24_excerpt"[^>]*title="([^"]+)"', b) or re.search(r'class="p24_excerpt"[^>]*>(.*?)</span>', b, re.S)
            desc = html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', exc_m.group(1)))).strip() if exc_m else ""

            img_m = re.search(r"""(?:lazy-src|data-original|data-image-url|data-lightbox-src|src)="(https://images\.prop24\.com/[^"]+)""", b)
            img = img_m.group(1) if img_m else ""

            size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', b, re.S)
            sqm = int(size_m.group(1)) if size_m else None

            beds_m = re.search(r'title="Bedrooms"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
            beds = float(beds_m.group(1)) if beds_m else None

            baths_m = re.search(r'title="Bathrooms"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
            baths = float(baths_m.group(1)) if baths_m else None

            park_m = re.search(r'title="Parking Spaces"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S) or \
                     re.search(r'title="Garages"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
            park = int(park_m.group(1)) if park_m else None
            
            # Textual parking fallback
            if park is None:
                txt_lower = f"{title} {desc}".lower()
                if any(k in txt_lower for k in ["undercover parking", "secure parking", "parking bay", "garage", "carport"]):
                    park = 1

            avail_m = re.search(r'class="p24_badgeSupplemental">([^<]+)</span>', b)
            avail = avail_m.group(1).strip() if avail_m else None

            link_m = re.search(r'href="(/to-rent/[^"]+/' + lid + r')"', b)
            link = f"https://www.property24.com{link_m.group(1)}" if link_m else f"https://www.property24.com/to-rent/{area.lower().replace(' ', '-')}/cape-town/western-cape/9163/{lid}"

            # Furnished inference from title/description
            furn = None
            lower_txt = f"{title} {desc}".lower()
            if "unfurnished" in lower_txt:
                furn = False
            elif "fully furnished" in lower_txt or "furnished" in lower_txt:
                furn = True

            # Agency & Landlord reputation lookup
            agency_m = re.search(r'title="Estate Agency profile for ([^"]+)"', b) or \
                       re.search(r'class="p24_branding"[^>]*title="([^"]+)"', b) or \
                       re.search(r'class="[^"]*p24_brandingImage[^"]*"[^>]*alt="([^"]+)"', b) or \
                       re.search(r'title="Managed by ([^"]+)"', b)
            agency_raw = agency_m.group(1).strip() if agency_m else None
            
            from services.agency_reputation import lookup_agency_reputation
            rep = lookup_agency_reputation(agency_raw, area=area)

            listings.append({
                "id": f"p24-{lid}",
                "listing_id": lid,
                "title": title or f"Rental in {area}",
                "address": f"{addr}, {loc}" if addr else loc,
                "price": price,
                "bedrooms": beds,
                "bathrooms": baths,
                "sqm": sqm,
                "parking": park,
                "is_furnished": furn,
                "available_date": avail,
                "description": desc,
                "image": img,
                "url": link,
                "area": area,
                "agency_name": rep.get("canonical_name"),
                "agency_rating": rep.get("google_rating"),
                "agency_review_count": rep.get("google_review_count"),
                "agency_risk_level": rep.get("risk_level", "low"),
                "agency_flags": rep.get("flags", []),
                "agency_complaint_sample": rep.get("recent_complaint_sample"),
                "agency_url": rep.get("google_reviews_url"),
                "agency_hellopeter_rating": rep.get("hellopeter_rating")
            })
    return listings

async def enrich_candidate_listing_async(item: Dict[str, Any]) -> Dict[str, Any]:
    """Inspects listing detail page to extract floor level, lift/elevator, exact parking, security, and agency."""
    url = item.get("url")
    if not url:
        return item
    try:
        from services.p24_client import p24_client
        html = await p24_client.fetch_html(url)
        if not html:
            return item
        
        # Check parking icons
        park_m = re.search(r'title="Parking Spaces"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S) or \
                 re.search(r'title="Garages"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S)
        if park_m:
            item["parking"] = int(park_m.group(1))

        txt = html.lower()
        if any(k in txt for k in ["undercover parking", "basement parking", "secure parking", "garage", "carport", "parking bay"]):
            if not item.get("parking"):
                item["parking"] = 1
            item["has_secure_parking"] = True

        if any(k in txt for k in ["24-hour security", "24hr security", "manned security"]):
            item["has_24hr_security"] = True

        # Extract Elevator & Floor cues
        if "elevator" in txt or ("lift" in txt and "short walk" not in txt):
            item["has_lift"] = "yes"
        elif "no lift" in txt or "stairs only" in txt:
            item["has_lift"] = "no"

        floor_m = re.search(r'\b(ground|1st|2nd|3rd|4th|first|second|third|fourth|top)\s+floor\b', txt)
        if floor_m:
            item["floor_number"] = floor_m.group(0)

        if not item.get("sqm"):
            schema_size = re.search(r'"floorSize"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
            if schema_size:
                item["sqm"] = int(schema_size.group(1))
            else:
                size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'(\d+)\s*m²\s*(?:apartment|flat|unit|floor|property)', html, re.I)
                if size_m:
                    item["sqm"] = int(size_m.group(1))

        # Check Agency Name & Reputation
        if not item.get("agency_name"):
            agency_schema = re.search(r'\{[^{}]*"@type"\s*:\s*"(?:RealEstateAgent|Organization)"[^{}]*"name"\s*:\s*"([^"]+)"', html)
            if agency_schema:
                item["agency_name"] = agency_schema.group(1).strip()
            else:
                m_agency = re.search(r'"agencyName"\s*:\s*"([^"]+)"', html) or \
                           re.search(r'class="[^"]*p24_agencyLogoName[^"]*"[^>]*>\s*<span>([^<]+)</span>', html, re.S) or \
                           re.search(r'alt="Property to rent by ([^"]+)"', html)
                if m_agency:
                    item["agency_name"] = m_agency.group(1).strip()

        if item.get("agency_name") and not item.get("agency_rating"):
            from services.agency_reputation import lookup_agency_reputation
            rep = lookup_agency_reputation(item["agency_name"])
            if rep:
                item["agency_rating"] = rep.get("google_rating")
                item["agency_review_count"] = rep.get("google_review_count")
                item["agency_risk_level"] = rep.get("risk_level", "low")
                item["agency_flags"] = rep.get("flags", [])
                item["agency_complaint_sample"] = rep.get("recent_complaint_sample")
                item["agency_url"] = rep.get("google_reviews_url")
                item["agency_hellopeter_rating"] = rep.get("hellopeter_rating")
    except Exception:
        pass
    return item

class AIScoutEngine:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    def _get_llm(self):
        if not self.api_key:
            return None
        from langchain_google_genai import ChatGoogleGenerativeAI
        candidate_models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"]
        for m in candidate_models:
            try:
                return ChatGoogleGenerativeAI(
                    model=m,
                    api_key=self.api_key,
                    google_api_key=self.api_key,
                    temperature=0.3,
                    request_timeout=60,
                    max_retries=2
                )
            except Exception:
                continue
        return None

    async def scout_and_rank(self, prefs: ScoutPreferences) -> AIScoutResult:
        # 1. Fetch live listings across requested areas
        raw_listings: List[Dict[str, Any]] = []
        for area in prefs.areas:
            area_clean = area.strip()
            if not area_clean:
                continue
            scraped = scrape_portal_listings(
                area=area_clean,
                max_price=prefs.max_price,
                min_price=prefs.min_price,
                property_type=prefs.property_type,
                min_bedrooms=prefs.min_bedrooms
            )
            raw_listings.extend(scraped)

        # Fallback to database registry if portal returned 0 (e.g. anti-bot/503)
        if not raw_listings:
            try:
                from services.database import get_db
                db = get_db()
                if db:
                    docs = db.collection("listings").limit(400).stream()
                    for d in docs:
                        l_data = d.to_dict()
                        l_addr = (str(l_data.get("address", "")) + " " + str(l_data.get("location", "")) + " " + str(l_data.get("title", ""))).lower()
                        if any(a.lower() in l_addr for a in prefs.areas):
                            if prefs.max_price and l_data.get("price") and l_data.get("price") > prefs.max_price:
                                continue
                            imgs = l_data.get("images") or l_data.get("image_urls") or []
                            first_img = imgs[0] if isinstance(imgs, list) and imgs else (l_data.get("image") or "")
                            raw_listings.append({
                                "id": d.id,
                                "listing_id": d.id,
                                "title": l_data.get("title") or "Rental Property",
                                "address": l_data.get("address") or l_data.get("location") or "Cape Town",
                                "price": l_data.get("price"),
                                "bedrooms": l_data.get("bedrooms"),
                                "bathrooms": l_data.get("bathrooms"),
                                "sqm": l_data.get("sqm"),
                                "parking": l_data.get("parking"),
                                "is_furnished": l_data.get("is_furnished"),
                                "description": l_data.get("description") or "",
                                "image": first_img,
                                "images": imgs if isinstance(imgs, list) else [],
                                "url": l_data.get("source_url") or l_data.get("url") or "",
                                "area": prefs.areas[0] if prefs.areas else "Cape Town",
                                "agency_name": l_data.get("agency_name"),
                                "is_direct_landlord": l_data.get("is_direct_landlord", False)
                            })
            except Exception as e:
                print(f"[SCOUT REGISTRY FALLBACK ERROR] {e}")

        # 2. Strict Hard filter: residential only, budget ceiling, min bedrooms floor
        filtered_by_area = {}
        for it in raw_listings:
            # Discard non-residential commercial/office listings
            t_lower = (it.get("title") or "").lower()
            if any(w in t_lower for w in ["commercial", "office", "retail", "industrial", "warehouse"]):
                continue

            # Strict budget ceiling
            if prefs.max_price and it.get("price"):
                try:
                    if float(it["price"]) > float(prefs.max_price):
                        continue
                except Exception:
                    pass

            # Strict minimum bedrooms floor
            if prefs.min_bedrooms is not None:
                beds = it.get("bedrooms")
                if beds is not None:
                    try:
                        if float(beds) < float(prefs.min_bedrooms):
                            continue
                    except Exception:
                        pass
                elif float(prefs.min_bedrooms) >= 1.0:
                    if any(w in t_lower for w in ["0.5 bed", "studio", "bachelor", "room to rent"]):
                        continue

            if prefs.must_have_parking and (it.get("parking") is not None and it["parking"] == 0):
                continue

            area_key = it.get("area") or "Other"
            filtered_by_area.setdefault(area_key, []).append(it)

        # Distribute candidates fairly across each requested area (up to 4 per area)
        candidates = []
        for area_k, itms in filtered_by_area.items():
            candidates.extend(itms[:4])

        # If still room, backfill
        if len(candidates) < 16:
            for area_k, itms in filtered_by_area.items():
                for rem in itms[4:]:
                    if len(candidates) >= 18:
                        break
                    if rem not in candidates:
                        candidates.append(rem)

        for c in candidates:
            await enrich_candidate_listing_async(c)

        llm = self._get_llm()
        if not llm or not candidates:
            # Deterministic intelligent ranking fallback
            ranked = self._deterministic_rank(candidates, prefs)
            return AIScoutResult(
                ranked_listings=ranked,
                overall_summary=f"Scouted {len(candidates)} listings across {', '.join(prefs.areas)}. Ranked using heuristic criteria matching budget and space.",
                areas_scouted=prefs.areas,
                total_found=len(raw_listings)
            )

        # 3. AI Ranking with Gemini
        prompt_text = f"""You are Antigravity's elite Real Estate Scout & Personal Property Advisor.
A tenant is searching for rental properties with very specific lifestyle, work, and personal tastes.

TENANT DESIRES & PROMPT:
"{prefs.prompt or 'Looking for the best value rental matching my lifestyle'}"

PERSONAL TASTES & HOBBIES:
"{prefs.personal_tastes or 'Not specified'}"

CRITICAL DEALBREAKERS & LIFESTYLE CONSTRAINTS:
1. ACOUSTIC PRIVACY & ROAD NOISE:
The user produces music and works remotely; acoustic privacy and low ambient street noise are paramount.
- Known arterial road traps (e.g. Annadale St / Mill St / Orange St next to highways and petrol stations, Buitengracht, Kloof Nek, Main Rd, and lower Derwent Rd directly facing Kloof bar corridors) suffer from severe traffic roar, patrons, and noise funneling.
- Penalize listings on or bordering high-noise corridors (-30 to -40 fit score penalty) and prioritize peaceful residential streets (e.g. Belle Ombre, Camp St, Hildene Rd, Annadale cul-de-sac).

2. BIKE ERGONOMICS & STAIRS:
The user carries a mountain bike every second day.
- 3rd or 4th floor walk-ups with stairs and NO elevator (like 10 Union St) are a severe dealbreaker (-35 fit score penalty).
- Prioritize units with an ELEVATOR, GROUND FLOOR, or 1ST FLOOR only.

3. AGENCY REPUTATION SHIELD:
- Trafalgar Property Management is a high-risk agency (1.9★ on HelloPeter with widespread complaints regarding unreturned deposits, billing penalties, and unresponsive maintenance).
- You MUST heavily penalize any listing managed by Trafalgar or high-risk agencies (-35 penalty) and flag this in "cons".

4. REAL RESIDENTIAL FLATS ONLY (NO APARTHOTELS):
- Avoid hotel/aparthotel micro-units (like BlackBrick) that lack private gear storage and have transient tourist noise (-30 penalty).

CRITERIA:
- Target Areas: {', '.join(prefs.areas)}
- Budget Max: R {prefs.max_price or 'Flexible'} pm (STRICT CEILING — absolutely no listings above this rent)
- Furnished preference: {prefs.is_furnished}
- Must have parking: {prefs.must_have_parking}

CANDIDATE LISTINGS DISCOVERED:
{json.dumps([{
    'id': c['id'],
    'listing_id': c['listing_id'],
    'title': c['title'],
    'address': c['address'],
    'price': c['price'],
    'bedrooms': c['bedrooms'],
    'bathrooms': c['bathrooms'],
    'sqm': c['sqm'],
    'parking': c['parking'],
    'is_furnished': c['is_furnished'],
    'description': c['description'],
    'url': c['url']
} for c in candidates], indent=2)}

INSTRUCTIONS:
1. Rank candidate properties from #1 (Best fit) to worst fit based on personal tastes (WFH, acoustic privacy, outdoor hobbies, gear storage, dating/cafe energy).
2. For each ranked listing, provide:
   - "rank": integer (1, 2, 3...)
   - "fit_score": integer 0-100 (penalize transit corridors heavily)
   - "short_explanation": A punchy 2-3 sentence personalized advisor breakdown directly addressing the user's tastes.
   - "pros": list of 2-3 specific bullet points
   - "cons": list of 1-2 honest drawbacks or things to verify (parking, stairs, road noise)
   - "verdict": One decisive takeaway sentence
3. Include an "overall_summary" comparing trade-offs and highlighting quiet acoustic sanctuaries vs transit noise traps.

Return strictly valid JSON matching this structure:
{{
  "overall_summary": "...",
  "ranked_listings": [
    {{
      "id": "p24-...",
      "rank": 1,
      "fit_score": 92,
      "short_explanation": "...",
      "pros": ["..."],
      "cons": ["..."],
      "verdict": "..."
    }}
  ]
}}
"""
        try:
            resp = await llm.ainvoke(prompt_text)
            content = resp.content if hasattr(resp, 'content') else str(resp)
            clean_json = re.sub(r'^```json\s*', '', content, flags=re.MULTILINE)
            clean_json = re.sub(r'```$', '', clean_json, flags=re.MULTILINE).strip()
            from json_repair import repair_json
            parsed = json.loads(repair_json(clean_json))

            # Merge back with candidate details and apply deterministic acoustic safety layer
            cand_map = {c["id"]: c for c in candidates}
            final_ranked: List[ScoutListingRank] = []

            for r in parsed.get("ranked_listings", []):
                cid = r.get("id")
                if cid in cand_map:
                    base = cand_map[cid]
                    score = r.get("fit_score", 80)
                    cons_list = r.get("cons", [])
                    verdict_txt = r.get("verdict", "Solid option to consider.")
                    
                    # 1. Agency Reputation Shield (Trafalgar & High-Risk Management)
                    agency_name = (base.get("agency_name") or "").lower()
                    if "trafalgar" in agency_name or base.get("agency_risk_level") == "high":
                        score = min(score, 45)
                        cons_list.insert(0, "🚨 High Agency Risk (Trafalgar): 1.9★ on HelloPeter — chronic complaints regarding delayed maintenance and deposit disputes")
                        verdict_txt = "Demoted: Trafalgar Property Management has widespread tenant dispute complaints (1.9★ HelloPeter)."

                    # 2. Mountain Bike Logistics & Stair Dealbreaker
                    floor_txt = f"{base.get('floor_number', '')} {base.get('description', '')} {base.get('title', '')} {base.get('address', '')}".lower()
                    has_lift = str(base.get("has_lift", "")).lower() in ["yes", "true", "1"] or "lift" in floor_txt or "elevator" in floor_txt
                    is_walkup = (any(w in floor_txt for w in ["4th floor", "fourth floor", "3rd floor", "third floor", "palmhof"]) or "4th" in str(base.get("floor_number", "")).lower()) and not has_lift
                    if is_walkup:
                        score = min(score, 48)
                        cons_list.insert(0, "⚠️ 4th floor walk-up without lift — carrying mountain bike up stairs is an ergonomic dealbreaker")
                        verdict_txt = "Demoted: 4th-floor walk-up with stairs only. Carrying a mountain bike every second day is an ergonomic dealbreaker."

                    # 3. Aparthotel (BlackBrick) Demotion
                    desc_lower = f"{base.get('title', '')} {base.get('description', '')}".lower()
                    if any(w in desc_lower for w in ["blackbrick", "aparthotel", "apartment hotel"]):
                        score = min(score, 52)
                        cons_list.insert(0, "⚠️ Hybrid apartment-hotel — high transient tourist turnover, no private sports gear storage, weekend rooftop noise")
                        verdict_txt = "Demoted: BlackBrick is an apartment-hotel unsuited for quiet acoustic isolation or bulky sports gear."

                    # 4. Zero-cost acoustic corridor safety verification
                    acoustic_audit = analyze_acoustic_risk(base.get("address", ""), base.get("description", ""), base.get("url", ""), base.get("title", ""), base.get("listing_id", ""))
                    if acoustic_audit["risk"] == "high":
                        score = min(score, 50)
                        cons_list.insert(0, f"🚨 Severe Noise Risk: {acoustic_audit['reason']}")
                        verdict_txt = "Demoted: Sits on or adjacent to high-decibel transit corridor or bar noise funnel. Unsuitable for acoustic work."

                    final_ranked.append(ScoutListingRank(
                        id=base["id"],
                        listing_id=base["listing_id"],
                        title=base["title"],
                        price=base.get("price"),
                        address=base["address"],
                        bedrooms=base.get("bedrooms"),
                        bathrooms=base.get("bathrooms"),
                        sqm=base.get("sqm"),
                        parking=base.get("parking"),
                        is_furnished=base.get("is_furnished"),
                        image=base.get("image") or (base.get("images")[0] if isinstance(base.get("images"), list) and base.get("images") else DEFAULT_APARTMENT_PHOTOS[len(final_ranked) % len(DEFAULT_APARTMENT_PHOTOS)]),
                        images=base.get("images") or ([base["image"]] if base.get("image") else [DEFAULT_APARTMENT_PHOTOS[len(final_ranked) % len(DEFAULT_APARTMENT_PHOTOS)]]),
                        url=base["url"],
                        area=base["area"],
                        rank=r.get("rank", len(final_ranked) + 1),
                        fit_score=score,
                        short_explanation=r.get("short_explanation", "Option matching your criteria."),
                        pros=r.get("pros", []),
                        cons=cons_list,
                        verdict=verdict_txt,
                        noise_risk=acoustic_audit["risk"],
                        noise_reason=acoustic_audit["reason"] if acoustic_audit["risk"] == "high" else None,
                        vision_audit_available=(prefs.tier == "pro"),
                        agency_name=base.get("agency_name"),
                        agency_rating=base.get("agency_rating"),
                        agency_review_count=base.get("agency_review_count"),
                        agency_risk_level=base.get("agency_risk_level", "low"),
                        agency_flags=base.get("agency_flags", []),
                        agency_complaint_sample=base.get("agency_complaint_sample"),
                        agency_url=base.get("agency_url"),
                        agency_hellopeter_rating=base.get("agency_hellopeter_rating"),
                        price_value_pct=calculate_price_value_pct(base.get("price"), base.get("bedrooms"), base.get("area", "Gardens"), candidates),
                        floor_number=base.get("floor_number"),
                        has_lift=base.get("has_lift", "unknown"),
                        building_name=base.get("building_name"),
                        pro_report=base.get("pro_report"),
                        community_sentiment=get_community_sentiment(
                            area=base.get("area", "Gardens"),
                            address=base.get("address", ""),
                            listing_id=base.get("listing_id", ""),
                            title=base.get("title", ""),
                            building_name=base.get("building_name")
                        ),
                        acoustic_audit=compute_property_acoustic_audit(
                            lat=float(base.get("lat") or -33.9328),
                            lng=float(base.get("lng") or 18.4103),
                            floor_level=base.get("floor_number", ""),
                            text_desc=f"{base.get('description', '')} {base.get('title', '')} {base.get('address', '')}",
                            title=base.get("title", ""),
                            address=base.get("address", "")
                        )
                    ))

            # Sort strictly by fit_score descending so noise traps drop to the bottom
            final_ranked.sort(key=lambda x: x.fit_score, reverse=True)
            for new_idx, itm in enumerate(final_ranked):
                itm.rank = new_idx + 1

            return AIScoutResult(
                ranked_listings=final_ranked,
                overall_summary=parsed.get("overall_summary", "Completed AI scouting and ranked top listings based on your prompt and personal tastes."),
                areas_scouted=prefs.areas,
                total_found=len(raw_listings)
            )
        except Exception as e:
            print(f"[AI SCOUT ERROR] {e}")
            ranked = self._deterministic_rank(candidates, prefs)
            return AIScoutResult(
                ranked_listings=ranked,
                overall_summary=f"Scouted {len(candidates)} listings across {', '.join(prefs.areas)}. Ranked using smart acoustic fallback analyzer.",
                areas_scouted=prefs.areas,
                total_found=len(raw_listings)
            )

    def _deterministic_rank(self, candidates: List[Dict[str, Any]], prefs: ScoutPreferences) -> List[ScoutListingRank]:
        ranked = []
        for idx, c in enumerate(candidates):
            price_val = c.get("price") or (prefs.max_price or 16000)
            score = 85 - (idx * 2)
            if prefs.max_price and price_val <= prefs.max_price:
                score += 5
            if c.get("parking"):
                score += 4
            if c.get("sqm") and c["sqm"] >= 55:
                score += 6

            pros_list = [f"Located in prime {c['area']}", f"Rent of R {price_val:,} pm is in target range"]
            if c.get("has_secure_parking") or (c.get("parking") and c["parking"] > 0):
                pros_list.append("Secure undercover parking bay included")
            if c.get("has_24hr_security"):
                pros_list.append("24-hour building security")

            cons_list = []
            if not c.get("parking") and not c.get("has_secure_parking"):
                cons_list.append("Street parking only — verify on-street security")

            # Aparthotel / Hotel Scheme Evaluation
            combined_desc = f"{c.get('title', '')} {c.get('address', '')} {c.get('description', '')} {c.get('building_name', '')}".lower()
            is_aparthotel = any(k in combined_desc for k in ["blackbrick", "aparthotel", "apartment hotel"])

            # Realistic spatial & WFH sizing evaluation
            sqm = c.get("sqm")
            if sqm:
                if sqm < 45:
                    explanation = f"Compact {sqm} m² unit in {c['area']}. Clean starter flat, but cramped for dedicated remote work — fitting a workstation and gear will crowd the living space."
                    cons_list.append(f"⚠️ Compact {sqm} m² footprint — constrained for full WFH desk and gear storage")
                    score -= 8
                elif sqm <= 52:
                    explanation = f"Modest {sqm} m² 1-bedroom in {c['area']}. Functional living area, but tight for a dedicated music workstation or sports gear without multi-purpose furniture."
                    cons_list.append(f"⚠️ Tight {sqm} m² floor plan — limited clearance for creative workstation and sports gear")
                    score -= 4
                elif sqm <= 65:
                    explanation = f"Well-proportioned {sqm} m² 1-bedroom in {c['area']}. Generous floor plan with ample dedicated room for a full WFH desk setup and gear storage without cluttering the lounge."
                    pros_list.append(f"Generous {sqm} m² layout with dedicated work-from-home space")
                    score += 6
                else:
                    explanation = f"Expansive {sqm} m² layout in {c['area']}. Superior acoustic volume and abundant dedicated zones for music production, monitors, and gear."
                    pros_list.append(f"Expansive {sqm} m² floor plan with dedicated zones for work and gear")
                    score += 10
            else:
                explanation = f"Well-positioned {c.get('bedrooms', 1)} bedroom in {c['area']} at R {price_val:,} pm with easy access to cafes and trails."

            verdict_text = f"Top contender in {c['area']} to view immediately."

            if is_aparthotel:
                c["building_name"] = "BlackBrick Gardens (Apartment Hotel)"
                c["has_lift"] = "yes"
                explanation = f"Design-led {sqm or 48} m² serviced suite in BlackBrick Gardens (Apartment Hotel). Outstanding on-site amenities (Rosetta coffee, co-working club, rooftop pool, 100% backup generator), but operates as a hybrid hotel with high transient tourist turnover, no private sports gear storage, and weekend rooftop social noise."
                pros_list = [
                    "100% Load shedding proof (industrial generator backup)",
                    "On-site Rosetta Roastery, co-working club & rooftop pool",
                    "Designer turnkey interior with 24/7 digital concierge"
                ]
                cons_list = [
                    "⚠️ Hybrid apartment hotel — high transient tourist turnover & hallway noise",
                    "⚠️ Compact hotel layout — zero private storage for MTB or sports gear",
                    "Street parking only — no dedicated secure bay included",
                    "Weekend social noise from rooftop bar and ground-floor restaurant"
                ]
                verdict_text = "Lifestyle Aparthotel: Great for networking & lock-up-and-go remote work, but unsuited for quiet acoustic isolation or bulky sports gear."

            # 1. Agency Reputation Check (Trafalgar & High-Risk Management)
            agency_name = (c.get("agency_name") or "").lower()
            agency_risk = c.get("agency_risk_level")
            if "trafalgar" in agency_name or agency_risk == "high":
                score -= 40
                cons_list.insert(0, "🚨 High Agency Risk (Trafalgar): 1.9★ on HelloPeter — chronic complaints regarding delayed maintenance and deposit disputes")
                verdict_text = "High Agency Risk: Trafalgar has a 1.9★ HelloPeter score with widespread tenant complaints."

            # 2. Bike Logistics & Stairs Check
            desc_check = f"{c.get('title', '')} {c.get('address', '')} {c.get('description', '')} {c.get('floor_number', '')}".lower()
            has_lift = str(c.get("has_lift", "")).lower() in ["yes", "true", "1"] or "lift" in desc_check or "elevator" in desc_check
            is_high_walkup = (any(w in desc_check for w in ["4th floor", "fourth floor", "3rd floor", "third floor", "palmhof"]) or "4th" in str(c.get("floor_number", "")).lower()) and not has_lift
            is_easy_bike = any(w in desc_check for w in ["ground floor", "1st floor", "first floor"]) or has_lift

            if is_high_walkup:
                score -= 35
                cons_list.insert(0, "⚠️ 4th floor walk-up without lift — carrying a mountain bike up 4 flights is an ergonomic dealbreaker")
                verdict_text = "Stair Dealbreaker: 4th floor walk-up without a lift makes carrying a mountain bike exhausting."
            elif is_easy_bike:
                pros_list.append("Easy mountain bike access (ground/first floor or elevator equipped)")
                score += 5

            # 3. Aparthotel penalty
            if is_aparthotel:
                score -= 30

            # 4. Zero-cost acoustic check
            acoustic = analyze_acoustic_risk(c.get("address", ""), c.get("description", ""), c.get("url", ""), c.get("title", ""), c.get("listing_id", ""))
            if acoustic["risk"] == "high":
                score -= 35 # Heavy penalty drops it below 60
                cons_list.insert(0, f"🚨 Severe Noise Risk: {acoustic['reason']}")
                if "Agency" not in verdict_text and "Stair" not in verdict_text:
                    verdict_text = "Avoid if noise-sensitive: sits on high-decibel corridor or bar transit funnel."

            score = min(98, max(35, score))

            ranked.append(ScoutListingRank(
                id=c["id"],
                listing_id=c["listing_id"],
                title=c["title"],
                price=c.get("price"),
                address=c["address"],
                bedrooms=c.get("bedrooms"),
                bathrooms=c.get("bathrooms"),
                sqm=c.get("sqm"),
                parking=c.get("parking"),
                is_furnished=c.get("is_furnished"),
                image=c.get("image") or (c.get("images")[0] if isinstance(c.get("images"), list) and c.get("images") else DEFAULT_APARTMENT_PHOTOS[idx % len(DEFAULT_APARTMENT_PHOTOS)]),
                images=c.get("images") or ([c["image"]] if c.get("image") else [DEFAULT_APARTMENT_PHOTOS[idx % len(DEFAULT_APARTMENT_PHOTOS)]]),
                url=c["url"],
                area=c["area"],
                rank=idx + 1,
                fit_score=score,
                short_explanation=explanation,
                pros=pros_list,
                cons=cons_list,
                verdict=verdict_text,
                noise_risk=acoustic["risk"],
                noise_reason=acoustic["reason"] if acoustic["risk"] == "high" else None,
                vision_audit_available=(prefs.tier == "pro"),
                agency_name=c.get("agency_name"),
                agency_rating=c.get("agency_rating"),
                agency_review_count=c.get("agency_review_count"),
                agency_risk_level=c.get("agency_risk_level", "low"),
                agency_flags=c.get("agency_flags", []),
                agency_complaint_sample=c.get("agency_complaint_sample"),
                agency_url=c.get("agency_url"),
                agency_hellopeter_rating=c.get("agency_hellopeter_rating"),
                price_value_pct=calculate_price_value_pct(c.get("price"), c.get("bedrooms"), c.get("area", "Gardens"), candidates),
                floor_number=c.get("floor_number"),
                has_lift=c.get("has_lift", "unknown"),
                building_name=c.get("building_name"),
                pro_report=c.get("pro_report"),
                community_sentiment=get_community_sentiment(
                    area=c.get("area", "Gardens"),
                    address=c.get("address", ""),
                    listing_id=c.get("listing_id", ""),
                    title=c.get("title", ""),
                    building_name=c.get("building_name")
                )
            ))

        # Re-sort deterministically by score so noise-penalized listings drop to the bottom
        ranked.sort(key=lambda x: x.fit_score, reverse=True)
        for new_idx, itm in enumerate(ranked):
            itm.rank = new_idx + 1

        return ranked

scout_engine = AIScoutEngine()

