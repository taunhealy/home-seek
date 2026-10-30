from services.building_reviews import extract_building_name, get_building_reviews
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

AREA_MEDIAN_BASELINES: Dict[str, Dict[float, int]] = {
    "gardens": {1.0: 16500, 2.0: 22000, 0.0: 13000},
    "tamboerskloof": {1.0: 16800, 2.0: 23000, 0.0: 13500},
    "sea point": {1.0: 17500, 2.0: 25000, 0.0: 14000},
    "green point": {1.0: 17500, 2.0: 25000, 0.0: 14000},
    "hout bay": {1.0: 12500, 2.0: 17000, 0.0: 9500},
    "fish hoek": {1.0: 9500, 2.0: 13500, 0.0: 7500},
    "capri": {1.0: 9500, 2.0: 13500, 0.0: 7500}
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
    "hatfield": "Immediate proximity to Mill St dual-carriageway and arterial transit corridor"
}

def analyze_acoustic_risk(address: str, description: str = "") -> Dict[str, Any]:
    """Zero-cost heuristic detector for known high-decibel transit corridors and noise traps."""
    text_to_check = f"{address} {description}".lower()
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

def scrape_portal_listings(area: str, max_price: Optional[int] = None, min_price: Optional[int] = None, property_type: Optional[str] = None) -> List[Dict[str, Any]]:
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

    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    })
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[SCOUT SCRAPER] Error fetching {url}: {e}")
        return []

    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    tiles = re.split(pattern, html)
    listings = []
    seen = set()

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

        img_m = re.search(r'src="(https://images\.prop24\.com/[^"]+)"', b)
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

def enrich_candidate_listing(item: Dict[str, Any]) -> Dict[str, Any]:
    """Inspects listing detail page to extract exact parking spaces, security, and sqm if missing."""
    url = item.get("url")
    if not url:
        return item
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.property24.com/"}
        )
        html = urllib.request.urlopen(req, timeout=4).read().decode("utf-8", errors="ignore")
        
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
                property_type=prefs.property_type
            )
            raw_listings.extend(scraped)

        # 2. Hard filter on bedrooms, parking if strictly specified
        filtered = []
        for it in raw_listings:
            if prefs.max_price and it.get("price") and it["price"] > (prefs.max_price + 1000):
                continue
            if prefs.min_bedrooms and it.get("bedrooms") and it["bedrooms"] < prefs.min_bedrooms:
                continue
            if prefs.must_have_parking and (it.get("parking") is not None and it["parking"] == 0):
                continue
            filtered.append(it)

        # Fallback if filtered is too small, use raw_listings
        candidates = filtered if len(filtered) >= 3 else (raw_listings or [])
        # Limit to top 12 candidates for the LLM
        candidates = candidates[:12]
        for c in candidates:
            if c.get("parking") is None or not c.get("sqm"):
                enrich_candidate_listing(c)

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

CRITICAL ACOUSTIC & ROAD NOISE CONSTRAINT:
The user produces music and works remotely; acoustic privacy and low ambient street noise are paramount.
- Known arterial road traps (e.g. Annadale St / Mill St / Orange St next to highways and petrol stations, Buitengracht, Kloof Nek, Main Rd) suffer from severe traffic roar, taxi acceleration, delivery scooters, and sirens.
- You MUST penalize any listing on or bordering these high-traffic transit corridors (-30 to -40 fit score penalty) and prioritize peaceful residential streets (e.g. Camp St, Belle Ombre, side avenues).
- Explicitly flag road noise hazards in "cons".

CRITERIA:
- Target Areas: {', '.join(prefs.areas)}
- Budget Max: R {prefs.max_price or 'Flexible'} pm
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
                    
                    # Zero-cost acoustic corridor safety verification
                    acoustic_audit = analyze_acoustic_risk(base.get("address", ""), base.get("description", ""))
                    if acoustic_audit["risk"] == "high":
                        # Apply acoustic penalty if the LLM forgot to penalize
                        score = min(score, 55) # Hard cap at 55 out of 100
                        cons_list.insert(0, f"🚨 Severe Road Noise Risk: {acoustic_audit['reason']}")
                        verdict_txt = "Demoted: Sits on or adjacent to high-decibel transit corridor. Unsuitable for acoustic work."

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
                        image=base.get("image"),
                        images=base.get("images") or ([base["image"]] if base.get("image") else []),
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
                        pro_report=base.get("pro_report")
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

            # Zero-cost acoustic check
            acoustic = analyze_acoustic_risk(c.get("address", ""), c.get("description", ""))
            verdict_text = f"Top contender in {c['area']} to view immediately."
            
            if acoustic["risk"] == "high":
                score -= 35 # Heavy penalty drops it below 60
                cons_list.insert(0, f"🚨 Severe Traffic Noise Risk: {acoustic['reason']}")
                verdict_text = "Avoid if noise-sensitive: sits on high-decibel transit corridor."

            score = min(98, max(40, score))

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
                image=c.get("image"),
                images=c.get("images") or ([c["image"]] if c.get("image") else []),
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
                pro_report=c.get("pro_report")
            ))

        # Re-sort deterministically by score so noise-penalized listings drop to the bottom
        ranked.sort(key=lambda x: x.fit_score, reverse=True)
        for new_idx, itm in enumerate(ranked):
            itm.rank = new_idx + 1

        return ranked

scout_engine = AIScoutEngine()

