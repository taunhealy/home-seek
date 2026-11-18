import os
from fastapi import APIRouter

router = APIRouter(tags=["acoustics"])


@router.get("/api/acoustics/hotspots")
async def get_acoustic_hotspots():
    """Returns calibrated Cape Town noise hotspots, transit corridors, and sanctuary zones."""
    from services.acoustic_registry import NOISE_HOTSPOTS, SANCTUARY_ZONES
    return {
        "status": "success",
        "hotspots": NOISE_HOTSPOTS,
        "sanctuary_zones": SANCTUARY_ZONES
    }

@router.post("/api/acoustics/evaluate")
async def evaluate_property_acoustics(payload: dict):
    """Computes acoustic audit and sound shadow attenuation for given coordinates and building attributes."""
    from services.acoustic_registry import compute_property_acoustic_audit
    lat = float(payload.get("lat", -33.9323))
    lng = float(payload.get("lng", 18.4108))
    floor_level = payload.get("floor_level", "")
    text_desc = payload.get("description", "")
    title = payload.get("title", "")
    address = payload.get("address", "")
    audit = compute_property_acoustic_audit(lat, lng, floor_level, text_desc, title, address)
    return {"status": "success", "acoustic_audit": audit}

@router.get("/api/market-medians")
async def get_empirical_market_medians():
    """Computes live empirical median rent & R/m2 per (area/pocket, bedrooms) from local P24 caches (0 network calls)."""
    import json as json_mod
    import statistics

    micro_pockets = [
        "capricorn", "marina da gama", "costa da gama", "northshore",
        "hout bay harbour", "scott estate", "berg en dal", "penzance estate",
        "sunnydale", "capri", "sun valley", "clifton", "bantry bay", "bakoven",
        "de waterkant", "mouille point", "green point", "sea point",
        "tamboerskloof", "oranjezicht", "higgovale", "vredehoek", "gardens",
        "camps bay", "llandudno", "hout bay", "noordhoek", "kommetjie",
        "scarborough", "fish hoek", "kalk bay", "st james", "clovelly",
        "muizenberg", "rondebosch", "newlands", "claremont", "kenilworth",
        "constantia", "tokai", "woodstock", "observatory",
    ]

    seen_ids = set()
    buckets: dict = {}

    def ingest_listing(item: dict):
        if not isinstance(item, dict):
            return
        lid = str(item.get("p24_id") or item.get("id") or "")
        if not lid or lid in seen_ids:
            return
        price = item.get("price")
        if not isinstance(price, (int, float)) or price < 3000 or price > 250000:
            return
        seen_ids.add(lid)

        raw_beds = item.get("bedrooms")
        try:
            beds = max(0, min(3, int(round(float(raw_beds if raw_beds is not None else 1)))))
        except Exception:
            beds = 1

        text = f"{item.get('address') or ''} {item.get('suburb') or ''}".lower()
        area_key = None
        for mp in micro_pockets:
            if mp in text:
                area_key = mp
                break
        if not area_key:
            area_key = str(item.get("suburb") or "").lower().strip()
        if not area_key:
            return

        sqm = item.get("sqm")
        sqm_rate = None
        if isinstance(sqm, (int, float)) and 15 <= sqm <= 1000:
            sqm_rate = float(price) / float(sqm)

        b = buckets.setdefault(area_key, {}).setdefault(str(beds), {"prices": [], "sqm_rates": []})
        b["prices"].append(float(price))
        if sqm_rate is not None:
            b["sqm_rates"].append(sqm_rate)

    cache_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "services", ".p24_live_cache.json"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "p24_cache.json"),
    ]
    for cp in cache_paths:
        if not os.path.exists(cp):
            continue
        try:
            with open(cp, "r", encoding="utf-8") as f:
                raw = json_mod.load(f)
            if isinstance(raw, list):
                for it in raw:
                    ingest_listing(it)
            elif isinstance(raw, dict):
                for val in raw.values():
                    if isinstance(val, dict):
                        items_list = val.get("items") or val.get("listings")
                        if isinstance(items_list, list):
                            for it in items_list:
                                ingest_listing(it)
                    elif isinstance(val, list):
                        for it in val:
                            ingest_listing(it)
        except Exception:
            continue

    medians: dict = {}
    for area_key, bed_map in buckets.items():
        for bed_str, stats in bed_map.items():
            if len(stats["prices"]) >= 4:
                med_rent = int(round(statistics.median(stats["prices"]) / 100.0) * 100)
                med_sqm = int(round(statistics.median(stats["sqm_rates"]))) if len(stats["sqm_rates"]) >= 3 else None
                medians.setdefault(area_key, {})[bed_str] = {
                    "median_rent": med_rent,
                    "median_sqm_rate": med_sqm,
                    "count": len(stats["prices"]),
                }

    return {"status": "success", "unique_listings": len(seen_ids), "medians": medians}


