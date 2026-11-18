import sys
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["live-p24"])


def print_safe(msg):
    try:
        safe_msg = str(msg).encode("ascii", "ignore").decode("ascii")
        print(safe_msg)
        sys.stdout.flush()
    except Exception:
        pass


class LiveSearchRequest(BaseModel):
    suburbs: List[str]
    min_price: Optional[int] = 0
    max_price: Optional[int] = 999999
    bedrooms: Optional[str] = "1+"
    anchor_lat: Optional[float] = None
    anchor_lng: Optional[float] = None
    force_fresh: Optional[bool] = False

@router.post("/api/search/live-scrape")
async def live_scrape_search(req: LiveSearchRequest):
    """Live scraper that searches Property24 on-demand for target suburbs and price filters."""
    from services.live_search import scrape_p24_live, get_p24_circuit_status, get_last_batch_meta
    try:
        results = scrape_p24_live(
            suburbs=req.suburbs,
            min_price=req.min_price or 0,
            max_price=req.max_price or 999999,
            beds=req.bedrooms or "1+",
            anchor_lat=req.anchor_lat,
            anchor_lng=req.anchor_lng,
            force_fresh=bool(req.force_fresh)
        )
        circuit = get_p24_circuit_status()
        batch_meta = get_last_batch_meta()
        return {
            "status": "cooldown" if (circuit["circuit_open"] and len(results) == 0) else "success",
            "count": len(results),
            "listings": results,
            "rate_guard": circuit,
            "batch_meta": batch_meta,
        }
    except Exception as err:
        return {
            "status": "error",
            "message": str(err),
            "count": 0,
            "listings": []
        }

class VerifyFavouritesItem(BaseModel):
    id: str
    p24_id: Optional[str] = None
    url: Optional[str] = None

class VerifyFavouritesRequest(BaseModel):
    items: List[VerifyFavouritesItem] = []
    active_live_ids: List[str] = []
    force_fresh: Optional[bool] = True

@router.post("/api/p24/verify-favourites")
async def verify_p24_favourites(req: VerifyFavouritesRequest):
    """
    Verifies whether saved/imported Property24 favourites are still active.
    Uses freshly scraped live IDs first (0 network calls), then politely checks
    remaining URLs with p24_client concurrency/rate-limit protection.
    """
    from services.availability_checker import check_single_listing_availability
    from services.live_search import P24_DEV_MODE, remove_listing_ids_from_cache, get_p24_circuit_status
    from services.p24_client import p24_client

    active_set = {str(x).replace("p24-", "").strip() for x in (req.active_live_ids or []) if str(x).strip()}
    ttl = (15 * 60) if req.force_fresh else 86400 * 3

    expired_ids: List[str] = []
    expired_details: List[Dict[str, Any]] = []
    verified_active_ids: List[str] = []
    network_checks = 0
    max_checks_per_batch = 5

    for item in req.items:
        p24_id = str(item.p24_id or item.id or "").replace("p24-", "").strip()
        if p24_id and p24_id in active_set:
            verified_active_ids.append(item.id)
            continue

        url = (item.url or "").strip()
        if not url and p24_id.isdigit():
            url = f"https://www.property24.com/to-rent/listing/{p24_id}"
        if not url:
            continue

        is_cached_fresh = bool(p24_client.get_cached(url, max_age_seconds=ttl))
        if not is_cached_fresh and (p24_client.is_circuit_open() or network_checks >= max_checks_per_batch):
            continue

        res = await check_single_listing_availability(url, cache_ttl_seconds=ttl)
        if not is_cached_fresh:
            network_checks += 1

        if res.get("verified") and not res.get("is_available"):
            expired_ids.append(item.id)
            if p24_id:
                expired_ids.append(p24_id)
            expired_details.append({
                "id": item.id,
                "p24_id": p24_id,
                "reason": res.get("status_reason", "Expired"),
            })
        elif res.get("verified") and res.get("is_available"):
            verified_active_ids.append(item.id)

    if expired_ids:
        remove_listing_ids_from_cache(set(expired_ids))

    return {
        "status": "success",
        "checked": len(req.items),
        "network_checks": network_checks,
        "expired_ids": list(dict.fromkeys(expired_ids)),
        "expired_details": expired_details,
        "verified_active_ids": verified_active_ids,
        "rate_guard": get_p24_circuit_status(),
    }

@router.get("/api/listings/ghost")
async def get_ghost_listings_endpoint(
    suburbs: str = "",
    min_price: int = 0,
    max_price: int = 999999,
    bedrooms: str = "any",
):
    """Returns past / let (is_available = 0) listings from local SQLite for the map Ghost Layer."""
    try:
        from services.listings_db import query_ghost_listings
        sub_list = [s.strip() for s in (suburbs or "").split(",") if s.strip()]
        rows = query_ghost_listings(sub_list, min_price=min_price, max_price=max_price, beds=bedrooms)
        return {"status": "success", "count": len(rows), "listings": rows}
    except Exception as e:
        return {"status": "error", "count": 0, "listings": [], "message": str(e)}


@router.get("/api/pool/stats")
async def get_pool_stats_endpoint():
    """Returns status and metrics of the centralized listings pool and sync poller."""
    try:
        from services.listings_db import get_pool_stats
        return {"status": "success", "pool": get_pool_stats()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ImportP24FavouritesRequest(BaseModel):
    raw_input: str
    anchor_lat: Optional[float] = None
    anchor_lng: Optional[float] = None

@router.post("/api/p24/import-favourites")
async def import_p24_favourites(req: ImportP24FavouritesRequest):
    """
    Imports user's favourited properties from Property24 by parsing
    pasted URLs, listing numbers, or raw HTML copied from My Favourites page.
    """
    from services.favourites_importer import import_p24_favourites_pipeline
    try:
        res = await import_p24_favourites_pipeline(
            raw_input=req.raw_input,
            anchor_lat=req.anchor_lat,
            anchor_lng=req.anchor_lng
        )
        return res
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "count": 0,
            "listings": []
        }

@router.post("/api/address/normalize")
async def normalize_address_endpoint(payload: dict):
    """
    Normalizes messy marketing addresses and performs multi-tiered precision geocoding.
    """
    try:
        from services.address_normalizer import normalize_and_geocode
        raw_address = payload.get("address", "")
        suburb = payload.get("suburb", "")
        title = payload.get("title", "")
        description = payload.get("description", "")
        result = normalize_and_geocode(raw_address, suburb, title, description)
        return {
            "status": "success",
            "result": result
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


_listing_photos_cache: Dict[str, List[str]] = {}

@router.get("/api/listing-photos")
async def get_listing_photos(url: str):
    """Fetches high-res interior/exterior photos for a listing, filtering out agent headshots and logos."""
    if not url:
        return {"status": "error", "photos": []}

    # Check in-memory cache
    if url in _listing_photos_cache and _listing_photos_cache[url]:
        return {"status": "success", "photos": _listing_photos_cache[url]}

    clean_url = url
    if clean_url.startswith("/"):
        clean_url = f"https://www.property24.com{clean_url}"

    try:
        import re
        from services.p24_client import p24_client

        # Polite rate-limited fetch with disk/RAM caching & circuit breaking
        html = await p24_client.fetch_html(clean_url, cache_ttl_seconds=86400 * 7)
        if not html:
            return {"status": "success", "photos": []}

        # 1. Target genuine property gallery containers and lightbox elements
        lightbox_ids = re.findall(r'data-(?:lightbox-src|image-url)="https://images\.prop24\.com/(\d+)', html)
        listing_img_ids = re.findall(r'alt="Listing number:[^"]*"[^>]*(?:lazy-src|src)="https://images\.prop24\.com/(\d+)', html)
        gal_href_ids = re.findall(r'rel="photo\[pp_gal\]"[^>]*href="https://images\.prop24\.com/(\d+)', html)

        candidate_ids = []
        seen = set()
        for pid in lightbox_ids + listing_img_ids + gal_href_ids:
            if pid not in seen:
                seen.add(pid)
                candidate_ids.append(pid)

        # Fallback if specific gallery attributes are missing
        if not candidate_ids:
            all_ids = re.findall(r"""https://images\.prop24\.com/(\d+)/[^\s"'<>]+""", html)
            for pid in all_ids:
                if pid not in seen:
                    seen.add(pid)
                    candidate_ids.append(pid)

        # 2. Strict blacklisting of agent headshots, profile avatars, and agency logos
        agent_pids = set(re.findall(r'(?:agentPhoto|RealEstateAgent|agent-profile|agent-image|js_agentPhoto)[^>]*https://images\.prop24\.com/(\d+)', html))
        agent_pids.update(re.findall(r"""https://images\.prop24\.com/(\d+)/[^\s"'<>]*(?:UpperCrop|Fit450|Fit200|Fit150|Crop200x200)""", html))

        clean_photos = [f"https://images.prop24.com/{pid}/Crop600x400" for pid in candidate_ids if pid not in agent_pids]
        if clean_photos:
            _listing_photos_cache[url] = clean_photos[:24]

        # Extract full description features (garage, secure parking bay, stove, inverter, pet_friendly)
        html_lower = html.lower()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        desc_el = soup.find(class_=re.compile(r"p24_description|js_readMoreText|p24_features|p24_keyFeatures", re.I))
        desc_text = desc_el.get_text(" ", strip=True).lower() if desc_el else html_lower

        has_garage = bool(re.search(r"\b(?:garage|garages|lock-up|lock\s+up\s+garage|automated\s+garage|single\s+garage|double\s+garage)\b", desc_text))
        has_secure_bay = bool(re.search(r"\b(?:secure\s+parking(?:\s+bay)?|parking\s+bay|off-street\s+parking|off\s+street\s+parking|undercover\s+parking|basement\s+parking|allocated\s+(?:parking|bay)|shaded\s+parking|carport|vehicular\s+access(?:\s+driveway)?|sliding\s+gate\s+vehicular\s+access|remote\s+controlled\s+(?:sliding\s+)?gate\s+(?:vehicular\s+)?access|parking\s+behind\s+gate|secure\s+off-street)\b", desc_text))
        parking_type = "garage" if has_garage else ("secure_bay" if has_secure_bay else None)
        stove_type = "gas" if any(k in desc_text for k in ["gas hob", "gas stove", "gas cooker", "gas burner"]) else (
            "induction" if any(k in desc_text for k in ["induction hob", "induction stove"]) else None
        )
        has_inverter = bool(re.search(r"\b(?:inverter|solar|backup|ups|load shedding)\b", desc_text))
        pet_friendly = True if re.search(r"\b(?:pet friendly|pets allowed|pets welcome|dogs allowed|cats allowed)\b", desc_text) else None
        is_security_estate = bool(re.search(r"\b(?:security\s+estate|gated\s+estate|gated\s+community|eco\s+estate|24.?h(?:our)?\s+security|manned\s+gate|boom\s+gate|biometric)\b", desc_text))
        full_desc = desc_el.get_text(" ", strip=True)[:2000] if desc_el else ""
        if is_security_estate or full_desc:
            try:
                from services.live_search import update_cached_listing_fields
                pid_match = re.search(r"/(\d{6,12})(?:[/?#]|$)", clean_url)
                if pid_match:
                    patch_fields = {}
                    if is_security_estate:
                        patch_fields["is_security_estate"] = True
                    if full_desc:
                        patch_fields["description"] = full_desc
                    if patch_fields:
                        update_cached_listing_fields(pid_match.group(1), patch_fields)
            except Exception:
                pass

        # Extract agency reputation from detail page HTML
        agency_info = {}
        try:
            from services.live_search import _extract_agency_from_html
            from services.agency_reputation import lookup_agency_reputation
            raw_ag = _extract_agency_from_html(html)
            if not raw_ag and ("liesl and giselle" in desc_text or "liesl or giselle" in desc_text):
                raw_ag = "Progressive Housing Investments"
            if raw_ag:
                rep = lookup_agency_reputation(raw_ag)
                if rep:
                    agency_info = {
                        "agency_name": rep.get("canonical_name") or raw_ag,
                        "agency_rating": rep.get("google_rating"),
                        "agency_review_count": rep.get("google_review_count"),
                        "agency_risk_level": rep.get("risk_level", "low"),
                        "agency_flags": rep.get("flags", []),
                        "agency_complaint_sample": rep.get("recent_complaint_sample"),
                        "agency_hellopeter_rating": rep.get("hellopeter_rating"),
                    }
        except Exception:
            pass

        return {
            "status": "success",
            "photos": clean_photos[:24],
            "features": {
                "has_garage": has_garage,
                "has_secure_bay": has_secure_bay,
                "parking_type": parking_type,
                "stove_type": stove_type,
                "has_inverter": has_inverter,
                "pet_friendly": pet_friendly,
                "is_security_estate": is_security_estate,
                "description": full_desc,
                **agency_info,
            },
        }
    except Exception as e:
        print_safe(f"[LISTING PHOTOS ERROR] {e}")
        return {"status": "error", "photos": []}


