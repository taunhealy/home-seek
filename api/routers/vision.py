import os
import re
import sys
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["vision"])


def print_safe(msg):
    try:
        safe_msg = str(msg).encode("ascii", "ignore").decode("ascii")
        print(safe_msg)
        sys.stdout.flush()
    except Exception:
        pass


class ForensicVisionRequest(BaseModel):
    id: str = ""
    url: str = ""
    title: str = ""
    address: str = ""
    price: float = 0
    bedrooms: float = 1
    bathrooms: float = 1
    sqm: Optional[float] = None
    description: str = ""
    images: List[str] = []
    uploaded_images: List[str] = []
    photo_source_mode: str = "both"
    personal_preferences: str = ""


_forensic_vision_cache: Dict[str, Dict[str, Any]] = {}


def _build_architectural_heuristics(req: ForensicVisionRequest, building_intel: Optional[dict] = None) -> dict:
    desc_lower = (req.description or "").lower()
    title_lower = (req.title or "").lower()
    all_text = f"{title_lower} {desc_lower}"
    prefs_lower = (req.personal_preferences or "").lower()
    is_wfh_full = "work from home (full-time)" in prefs_lower or "full-time" in prefs_lower
    is_wfh_any = "work from home" in prefs_lower or "remote" in prefs_lower or "wfh" in prefs_lower
    is_studio = (req.bedrooms is not None and req.bedrooms <= 0.5) or any(w in all_text for w in ["studio", "bachelor", "0.5 bed", "loft"])
    sqm = req.sqm or 0

    # 1. WFH & Layout Ergonomics
    if is_studio:
        size_note = f"({sqm} m²) " if sqm else ""
        if is_wfh_full:
            wfh_layout_verdict = (
                f"0.5-bed / studio footprint {size_note}poses full-time WFH friction: no acoustic door separating desk from fridge/kitchen hum, "
                "and bed may appear in video calls unless zoned with a screen or alcove."
            )
        elif is_wfh_any:
            wfh_layout_verdict = (
                f"0.5-bed / studio layout {size_note}is workable for part-time WFH / café hybrid if you place a compact desk near the window; "
                "watch for fridge hum and cooking smells in an open-plan room."
            )
        else:
            wfh_layout_verdict = (
                f"Open-plan 0.5-bed / studio {size_note}maximizes usable floor area without corridor waste; verify storage and dedicated dining/desk zones."
            )
    elif sqm and sqm < 52:
        wfh_layout_verdict = (
            f"Compact {sqm} m² floor plan: confirm a clear ≥1.2 m desk zone away from kitchen appliances and bedroom traffic for comfortable WFH."
        )
    else:
        wfh_layout_verdict = (
            "Separate bedroom(s) allow an acoustic door between sleeping/kitchen zones and a dedicated workspace for uninterrupted WFH calls."
        )

    # 2. Window Placement & Natural Light
    has_outdoor = any(w in all_text for w in ["balcony", "patio", "deck", "terrace", "sliding door"])
    if "north" in all_text:
        window_light_audit = (
            "North-facing aspect (Cape Town gold standard for all-day winter warmth & low damp risk). "
            + ("Balcony/sliding doors aid cross-ventilation." if has_outdoor else "Check window-to-wall ratio for airflow.")
        )
    elif "west" in all_text:
        window_light_audit = (
            "West-facing exposure brings warm afternoon sun but risks harsh late-afternoon screen glare during WFH calls; inspect blinds."
        )
    elif "south" in all_text:
        window_light_audit = (
            "South-facing aspect gets softer, indirect light and can feel cooler in winter — check for damp/condensation behind curtains and window frames."
        )
    else:
        window_light_audit = (
            ("Balcony/sliding doors support cross-ventilation and daylight. " if has_outdoor else "Single-aspect windows may limit cross-breeze; ")
            + "Verify during viewing that windows don't face a close brick wall (<3 m) forcing blinds closed all day."
        )

    # 3. Wall Type & Acoustics
    is_heritage = any(w in all_text for w in ["art deco", "parquet", "high ceiling", "heritage", "character", "solid brick"])
    is_modern_infill = any(w in all_text for w in ["new development", "modern block", "loft", "micro", "newly built"])
    if is_heritage:
        wall_acoustic_audit = (
            "Older/heritage solid brick construction typically blocks airborne neighbour voices well; "
            "if parquet floors exist, check upstairs footfall transmission."
        )
    elif is_modern_infill:
        wall_acoustic_audit = (
            "Modern infill/sectional title build: check whether internal walls are hollow drywall (higher voice/TV bleed) and note hard-tile echo on video calls."
        )
    else:
        wall_acoustic_audit = (
            "Standard masonry/sectional title build; check party-wall thickness, upstairs floor impact, and add a rug/curtains if rooms are all-tile to cut Zoom echo."
        )

    # 4. Ceiling Height & Volume
    if any(w in all_text for w in ["high ceiling", "double volume", "victorian", "art deco"]):
        ceiling_volume_audit = "High ceilings (~2.8 m–3.2 m+) boost airiness, daylight reach, and acoustic comfort for WFH; verify true room width beyond 0.5x lens photos."
    elif any(w in all_text for w in ["cottage", "garden flat", "basement", "attic"]):
        ceiling_volume_audit = "Cottage/ancillary structure: verify ceiling height (≥2.4 m) and bulkhead clearances in person, as low ceilings can feel tight during full-time WFH."
    else:
        ceiling_volume_audit = "Standard ~2.4 m–2.6 m ceiling height inferred; watch for 0.5x ultra-wide camera stretching in listing photos."

    # 5. Light Fixtures & Evening Livability
    if any(w in all_text for w in ["downlight", "recessed", "led", "renovated", "modern"]):
        lighting_fixtures_audit = "Likely fitted with modern recessed downlights/layered fixtures; check color temperature (warm 2700K–3000K vs harsh 5000K) and inverter-tied lights."
    else:
        lighting_fixtures_audit = "Check whether rooms rely on a single central overhead bulb (creates screen glare/shadows at night) and confirm bathroom extractor/window ventilation."

    # 6. Exterior & Building Communication
    if building_intel and building_intel.get("building_name"):
        bc = building_intel.get("body_corporate") or "Active sectional title management"
        exterior_building_audit = f"{building_intel.get('building_name')}: {bc}. Inspect façade paint, balcony drainage, and perimeter gate/intercom upkeep on arrival."
    elif any(w in all_text for w in ["estate", "24 hour", "concierge", "access control", "electric fence"]):
        exterior_building_audit = "Managed security perimeter signalled; check façade paint/rust streaks and bin-area neatness as a proxy for Body Corporate reserve health."
    else:
        exterior_building_audit = "Inspect exterior façade for peeling paint, rust/water streaks under balconies, and working gate motors/electric fencing — key clues to Body Corporate health."

    return {
        "wfh_layout_verdict": wfh_layout_verdict,
        "window_light_audit": window_light_audit,
        "wall_acoustic_audit": wall_acoustic_audit,
        "ceiling_volume_audit": ceiling_volume_audit,
        "lighting_fixtures_audit": lighting_fixtures_audit,
        "exterior_building_audit": exterior_building_audit,
    }


def _build_heuristic_vision_fallback(req: ForensicVisionRequest, clean_imgs: list, is_quota_err: bool = False, err_str: str = "", building_intel: Optional[dict] = None):
    desc_lower = (req.description or "").lower()
    title_lower = (req.title or "").lower()
    all_text = f"{title_lower} {desc_lower}"
    photo_count = max(len(clean_imgs), len(req.images or []))
    uploaded_count = len(req.uploaded_images or [])
    total_photos = photo_count + uploaded_count
    arch = _build_architectural_heuristics(req, building_intel=building_intel)

    fallback_pros = []
    fallback_cons = []

    if uploaded_count > 0:
        fallback_pros.append(f"Includes {uploaded_count} tenant-uploaded viewing/off-portal photo(s) for raw, un-retouched snagging & condition verification.")

    # 1. Gallery Depth & Visual Presentation
    if total_photos >= 5:
        fallback_pros.append(f"Gallery includes {total_photos}+ photos documenting interior living zones and fixtures.")
    else:
        fallback_cons.append(f"Limited photographic transparency ({total_photos} photos provided) — some interior angles withheld.")

    # 2. Kitchen & Finishes Visual Cues
    if any(w in all_text for w in ["modern", "renovated", "granite", "caesarstone", "contemporary", "sleek"]):
        fallback_pros.append("Modernised kitchen finishes, contemporary cabinetry, and clean worktop surfaces.")
    else:
        fallback_pros.append("Functional residential kitchen cabinetry and standard built-in worktops.")

    # 3. Daylight & Exterior Connections
    if any(w in all_text for w in ["balcony", "patio", "deck", "terrace", "garden", "braai"]):
        fallback_pros.append("Private outdoor extension (balcony/patio/courtyard) visible in gallery presentation.")
    if any(w in all_text for w in ["light", "sunny", "bright", "north", "views", "ocean", "mountain"]):
        fallback_pros.append("Natural daylighting through exterior glazing with elevated aspect.")

    # 4. Gaps, Missing Angles & Watchouts
    if not any(w in all_text for w in ["bathroom", "shower", "en-suite", "ensuite"]):
        fallback_cons.append("Missing photo gap: bathroom sanitaryware and shower condition not clearly featured.")
    if not any(w in all_text for w in ["garage", "bay", "carport", "parking"]):
        fallback_cons.append("Missing photo gap: dedicated off-street vehicle parking bay not verified in photos.")
    if (req.bedrooms is not None and req.bedrooms <= 0.5) or any(w in all_text for w in ["cottage", "studio", "bachelor", "compact"]):
        fallback_cons.append("Open-plan / studio footprint — check desk placement, fridge hum, and call backdrop.")

    fallback_cons.append("Real estate lens focal length: verify true room depth and ceiling heights in person.")

    photo_story = (
        f"Inspected {photo_count} photo(s). Gallery documents primary interior living spaces. "
        + ("(Live Gemini Vision paused: AI Studio prepayment depleted. Showing heuristic visual & architectural audit)."
           if is_quota_err else "(Showing heuristic visual & architectural audit).")
    )

    detected_stove = "gas" if "gas" in all_text else "electric"

    return {
        "photo_story": photo_story,
        "photo_pros": fallback_pros[:4],
        "photo_cons": fallback_cons[:4],
        "glazing": arch["window_light_audit"],
        "distortion": arch["ceiling_volume_audit"],
        "stove_type": detected_stove,
        **arch,
        "building_intel": building_intel,
        "inspected_photo_count": photo_count,
        "is_fallback": True,
        "fallback_reason": (
            "AI Studio prepayment credits depleted (402 RESOURCE_EXHAUSTED). Top up at aistudio.google.com/billing or use a free-tier key."
            if is_quota_err else (f"Vision service fallback: {err_str[:80]}" if err_str else "Heuristic visual inspection.")
        ),
    }

@router.post("/api/listing/forensic-vision")
async def listing_forensic_vision(req: ForensicVisionRequest):
    """Inspects listing gallery photos + tenant-uploaded viewing/off-portal photos with Gemini Vision."""
    uploaded_imgs = [u for u in (req.uploaded_images or []) if isinstance(u, str) and u.startswith("data:image/")][:8]
    mode = (req.photo_source_mode or "both").lower()
    cache_key = f"v3::{req.id or req.url}::{mode}::{len(uploaded_imgs)}::{req.personal_preferences.strip()[:80]}"
    if not uploaded_imgs and cache_key in _forensic_vision_cache:
        return {"status": "success", "vision": _forensic_vision_cache[cache_key], "cached": True}

    # Resolve building/complex intelligence via building_reviews.py
    building_intel = None
    try:
        from services.building_reviews import extract_building_name, get_building_reviews
        b_name = extract_building_name(req.title or "", req.address or "", req.description or "")
        if b_name:
            area_hint = (req.address or "Cape Town").split(",")[0].strip() or "Cape Town"
            building_intel = await get_building_reviews(b_name, area_hint)
    except Exception:
        building_intel = None

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    clean_imgs = (
        [] if mode == "uploaded" else [
            img for img in (req.images or [])
            if img and not any(bad in img for bad in ["UpperCrop200x200", "js_agentPhoto", "Fit450x225", "Fit200x100"])
        ][:5]
    )

    if not api_key or (not clean_imgs and not uploaded_imgs):
        fallback_vision = _build_heuristic_vision_fallback(req, clean_imgs, is_quota_err=False, err_str="No API key or image URLs available", building_intel=building_intel)
        if not uploaded_imgs:
            _forensic_vision_cache[cache_key] = fallback_vision
        return {"status": "fallback", "vision": fallback_vision, "cached": False}

    try:
        import asyncio
        import base64
        import json as json_mod
        from services.lens_rectifier import fetch_image_bytes
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        image_contents = []
        for data_url in uploaded_imgs:
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": data_url},
            })

        if clean_imgs:
            raw_images = await asyncio.gather(*[asyncio.to_thread(fetch_image_bytes, u) for u in clean_imgs])
            for raw_b in raw_images:
                if raw_b:
                    b64 = base64.b64encode(raw_b).decode("utf-8")
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    })

        if not image_contents:
            fallback_vision = _build_heuristic_vision_fallback(req, clean_imgs, is_quota_err=False, err_str="Could not download raw image bytes", building_intel=building_intel)
            if not uploaded_imgs:
                _forensic_vision_cache[cache_key] = fallback_vision
            return {"status": "fallback", "vision": fallback_vision, "cached": False}

        building_ctx = (
            f"{building_intel.get('building_name')} (Rating: {building_intel.get('google_rating')}★, "
            f"Soundproofing: {building_intel.get('soundproofing')}, Airbnb risk: {building_intel.get('airbnb_risk')})"
            if building_intel and building_intel.get("building_name") else "Unnamed / standalone property"
        )

        prompt = f"""You are a sharp, architect-trained Cape Town / South Africa rental property inspector.
Inspect the {len(image_contents)} attached listing photo(s) alongside the listing details and apply these FORENSIC GUIDELINES:
1. SPACE & WFH ERGONOMICS (VISUAL DESK PLACEMENT): Visually inspect the room layouts in the photos to judge where a proper WFH desk (>=1.2m x 0.6m) + ergonomic chair can actually fit without blocking walkways, sofas, or wardrobes. Note specific spots (e.g., lounge window wall, alcove, bedroom corner) or flag if tight circulation/open-plan kitchen-lounge forces a laptop onto a dining counter. Check acoustic separation (real door vs fridge/kitchen hum), video-call backdrop (bed/kitchen visible?), natural light angle (side light vs screen glare), and visible plug points. Tailor to User Preferences ({req.personal_preferences or 'None specified'}).
2. WINDOW PLACEMENT & DAYLIGHT: Check sightlines (brick wall/airshaft 'blind-lock' vs open sky/greenery), single-aspect vs cross-ventilation, Cape Town sun glare/damp risk, and window frame quality (thin aluminum vs double-glazed/timber).
3. WALL TYPE & ACOUSTICS: Infer solid brick/concrete (Art Deco/older) vs hollow drywall/studs (modern infill), hard-tile Zoom echo risk, and upstairs/party-wall exposure.
4. CEILING HEIGHT & VOLUME: Judge ceiling height (high >=2.8m vs standard 2.4m vs low <2.3m bulkheads) and flag 0.5x ultra-wide lens distortion.
5. LIGHT FIXTURES & EVENING LIVABILITY: Distinguish layered warm lighting (downlights/sconces/under-cabinet) from harsh single central bulbs or windowless bathrooms.
6. BUILDING EXTERIOR & BLOCK: If exterior/foyer is shown, note maintenance cues (peeling paint, rust streaks, gate/electric fence security, building era).
7. SHARED ERF / ATTACHED DWELLING & DRIVEWAY CHECK: Look carefully at exterior, parking, doorway photos, AND what is visible THROUGH the windows, sliding doors, and balconies for signs of a subdivided house / attached flatlet / shared driveway (a main house or second roof visible right outside the window, overlooking neighbour/owner windows, tandem parking, side-passage entry, shared garden/pool, or "Wi-Fi included" at a single street-number address without a unit/complex number). Flag this explicitly in photo_cons, window_light_audit, and exterior_building_audit if suspected.

LISTING DETAILS:
- Title: {req.title}
- Address: {req.address}
- Price: R {req.price:,.0f}/mo | {req.bedrooms} bed | {req.bathrooms} bath | {f'{req.sqm} m²' if req.sqm else 'size unstated'}
- Building Context: {building_ctx}
- Description: {(req.description or '')[:1400]}
- User Preferences: {req.personal_preferences or 'None specified'}

Return STRICT JSON only (no markdown fences) with these exact keys:
{{
  "photo_story": "3-4 concise sentences telling the real story across the photos: layout, finishes, light, surroundings, and what key rooms/angles are missing.",
  "photo_pros": ["3 to 5 specific visual pros directly observed in the photos"],
  "photo_cons": ["2 to 5 specific visual cons, WFH/layout friction, or missing-photo gaps observed"],
  "wfh_layout_verdict": "2-3 concise sentences based on what you SEE in the photos: where a desk + chair can/cannot be placed, circulation clearance, acoustic/door separation, video-call backdrop, and overall WFH suitability.",
  "window_light_audit": "1-2 concise sentences on window placement, sightlines, cross-ventilation, glare/damp risk, and glazing.",
  "wall_acoustic_audit": "1-2 concise sentences on wall construction (brick vs drywall), echo surfaces, and neighbour noise insulation.",
  "ceiling_volume_audit": "1 concise sentence on ceiling height, spatial volume, and 0.5x lens distortion.",
  "lighting_fixtures_audit": "1 concise sentence on light fixture quality (warm layered vs harsh overhead) and windowless rooms.",
  "exterior_building_audit": "1-2 concise sentences on what the exterior/era/security communicates (or note if exterior photo is missing).",
  "glazing": "1 concise sentence on windows, natural light, and outlook visible in the photos",
  "distortion": "1 concise sentence on camera focal length / ultra-wide 0.5x stretch vs true room proportions",
  "stove_type": "gas | induction | electric | unknown"
}}"""

        models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
        last_err = None
        parsed = None

        for m_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=m_name,
                    api_key=api_key,
                    temperature=0.2,
                    request_timeout=45,
                )
                msg = HumanMessage(content=[{"type": "text", "text": prompt}, *image_contents])
                resp = await llm.ainvoke([msg])
                text = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                text = re.sub(r'^```(?:json)?\s*', '', text)
                text = re.sub(r'\s*```$', '', text)
                parsed = json_mod.loads(text)
                parsed["inspected_photo_count"] = len(image_contents)
                parsed["building_intel"] = building_intel
                parsed["is_fallback"] = False
                _forensic_vision_cache[cache_key] = parsed
                if req.id and parsed.get("stove_type") in ("gas", "induction", "electric"):
                    try:
                        from services.listings_db import update_listing_vision_attributes
                        from services.live_search import update_cached_listing_fields
                        update_listing_vision_attributes(req.id, stove_type=parsed["stove_type"], vision_summary=parsed)
                        update_cached_listing_fields(req.id, {"stove_type": parsed["stove_type"], "vision_verified": True})
                    except Exception:
                        pass
                return {"status": "success", "vision": parsed, "cached": False}
            except Exception as e:
                last_err = e
                # If quota/prepayment exhausted, try fallback model
                if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e) or "402" in str(e):
                    continue
                raise e

        if last_err:
            raise last_err
    except Exception as e:
        print_safe(f"[FORENSIC VISION ERROR] {e}")
        err_str = str(e)
        is_quota_err = "RESOURCE_EXHAUSTED" in err_str or "402" in err_str or "429" in err_str
        fallback_parsed = _build_heuristic_vision_fallback(req, clean_imgs, is_quota_err=is_quota_err, err_str=err_str, building_intel=building_intel)
        _forensic_vision_cache[cache_key] = fallback_parsed
        return {"status": "fallback", "vision": fallback_parsed, "cached": False}


class ComparePropertiesRequest(BaseModel):
    properties: List[Dict[str, Any]] = []
    personal_preferences: str = ""


def _build_compare_fallback(props: List[Dict[str, Any]], prefs: str = "", reason: str = "") -> Dict[str, Any]:
    prefs_l = (prefs or "").lower()
    wants_wfh_full = "full-time" in prefs_l or "work from home" in prefs_l
    wants_cafes = "cafe" in prefs_l
    wants_private = "private" in prefs_l or "no landlord" in prefs_l
    wants_parking = "parking" in prefs_l or "garage" in prefs_l

    scored = []
    for p in props:
        pid = str(p.get("id", ""))
        price = float(p.get("price") or 0)
        beds = float(p.get("bedrooms") or 1)
        sqm = float(p.get("sqm") or 0)
        noise_risk = (p.get("noise_risk") or "moderate").lower()
        est_db = (p.get("acoustic_audit") or {}).get("estimated_db") or (38 if noise_risk == "sanctuary" else 48)
        fibre = bool(p.get("fibre_ready"))
        garage = bool(p.get("has_garage"))
        secure_bay = bool(p.get("has_secure_bay"))
        raw = f"{p.get('title', '')} {p.get('address', '')} {p.get('description', '')}".lower()
        landlord_onsite = any(k in raw for k in ["granny flat", "garden cottage", "shared property", "landlord on site", "separate entrance on property"])
        is_studio = beds <= 0.5 or "studio" in raw or "bachelor" in raw

        score = 72
        if noise_risk == "sanctuary":
            score += 10
        elif est_db >= 60:
            score -= 12
        if fibre:
            score += 6
        if garage:
            score += 6
        elif secure_bay:
            score += 3
        if landlord_onsite:
            score -= 14 if wants_private else 6
        else:
            score += 5
        if wants_wfh_full and is_studio:
            score -= 8
        if sqm >= 65:
            score += 5
        if p.get("stove_type") == "gas":
            score += 4
        score = max(35, min(98, score))

        best_for = []
        if noise_risk == "sanctuary":
            best_for.append("Quiet acoustic sanctuary")
        if fibre:
            best_for.append("Turnkey fibre WFH")
        if not landlord_onsite:
            best_for.append("100% private standalone living")
        if garage or secure_bay:
            best_for.append("Secure off-street parking")
        if not best_for:
            best_for.append("Core budget & location match")

        tradeoffs = []
        if landlord_onsite:
            tradeoffs.append("Shared grounds / landlord on-site")
        if wants_wfh_full and is_studio:
            tradeoffs.append("0.5-bed / studio lacks acoustic door for full-time WFH")
        if not fibre:
            tradeoffs.append("Fibre readiness unconfirmed")
        if est_db >= 55:
            tradeoffs.append(f"Elevated ambient noise (~{est_db} dBA)")
        if not (garage or secure_bay):
            tradeoffs.append("No dedicated secure parking confirmed")
        if not tradeoffs:
            tradeoffs.append("Verify utility split & street security in person")

        wfh_fit = (
            "Caution for full-time WFH (open-plan studio/0.5-bed lacks door separation)"
            if (wants_wfh_full and is_studio)
            else ("Strong WFH setup (fibre + separate room zoning)" if fibre and not is_studio else "Workable for hybrid/café mode; verify desk & fibre")
        )
        acoustic_verdict = f"~{est_db} dBA ({'Quiet sanctuary' if noise_risk == 'sanctuary' else 'Standard/exposed'})"
        value_verdict = f"R {price:,.0f}/mo" + (f" · R {price / sqm:,.0f}/m²" if sqm > 0 else "")

        scored.append({
            "id": pid,
            "score": score,
            "headline": f"{p.get('title', 'Listing')} ({p.get('suburb', 'Cape Town')})",
            "best_for": ", ".join(best_for[:2]),
            "biggest_tradeoff": "; ".join(tradeoffs[:2]),
            "wfh_fit": wfh_fit,
            "acoustic_verdict": acoustic_verdict,
            "value_verdict": value_verdict,
            "_price": price,
            "_db": est_db,
            "_sqm": sqm,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    for idx, item in enumerate(scored, start=1):
        item["rank"] = idx

    winner = scored[0]
    runner_up = scored[1] if len(scored) > 1 else None
    pref_note = f' against your preferences ("{prefs[:80]}")' if prefs else ""
    exec_verdict = (
        f"Top Pick (#1): {winner['headline']} scores {winner['score']}/100{pref_note}, "
        f"leading on {winner['best_for'].lower()}. "
        + (f"Runner-up {runner_up['headline']} ({runner_up['score']}/100) trades off {runner_up['biggest_tradeoff'].lower()}." if runner_up else "")
    )

    # Matrix highlights
    lowest_price = min(scored, key=lambda x: x["_price"] if x["_price"] > 0 else 999999)
    quietest = min(scored, key=lambda x: x["_db"])
    largest = max(scored, key=lambda x: x["_sqm"])
    matrix_highlights = [
        {"category": "Overall AI Fit", "winner_id": winner["id"], "note": f"Highest composite score ({winner['score']}/100)"},
        {"category": "Monthly Value", "winner_id": lowest_price["id"], "note": f"Lowest rent at {lowest_price['value_verdict']}"},
        {"category": "Acoustic Quietness", "winner_id": quietest["id"], "note": quietest["acoustic_verdict"]},
    ]
    if largest["_sqm"] > 0:
        matrix_highlights.append({"category": "Floor Space", "winner_id": largest["id"], "note": f"Largest at {largest['_sqm']:.0f} m²"})

    for item in scored:
        item.pop("_price", None)
        item.pop("_db", None)
        item.pop("_sqm", None)

    return {
        "winner_id": winner["id"],
        "executive_verdict": exec_verdict,
        "rankings": scored,
        "matrix_highlights": matrix_highlights,
        "is_fallback": True,
        "fallback_reason": reason or "Heuristic multi-factor comparison active.",
    }


@router.post("/api/properties/compare")
async def compare_properties_ai(req: ComparePropertiesRequest):
    """Runs a side-by-side AI comparison across 2–4 shortlisted properties tailored to user preferences."""
    props = (req.properties or [])[:4]
    if len(props) < 2:
        raise HTTPException(status_code=400, detail="Please select at least 2 properties to compare.")

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"status": "fallback", "comparison": _build_compare_fallback(props, req.personal_preferences, "No Gemini API key configured")}

    try:
        import json as json_mod
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        summaries = []
        for p in props:
            summaries.append({
                "id": str(p.get("id", "")),
                "title": p.get("title"),
                "suburb": p.get("suburb"),
                "address": p.get("address"),
                "price": p.get("price"),
                "bedrooms": p.get("bedrooms"),
                "bathrooms": p.get("bathrooms"),
                "sqm": p.get("sqm"),
                "noise_risk": p.get("noise_risk"),
                "estimated_db": (p.get("acoustic_audit") or {}).get("estimated_db"),
                "fibre_ready": p.get("fibre_ready"),
                "has_garage": p.get("has_garage"),
                "has_secure_bay": p.get("has_secure_bay"),
                "stove_type": p.get("stove_type"),
                "pet_friendly": p.get("pet_friendly"),
                "description": (p.get("description") or "")[:700],
            })

        prompt = f"""You are an objective Cape Town rental advisor comparing {len(summaries)} shortlisted properties side-by-side.
USER WORK & LIFESTYLE PREFERENCES: {req.personal_preferences or 'General quiet, safe, good-value residential rental'}

Apply our forensic guidelines:
- Evaluate 0.5-bed / <=55 m² open-plan units strictly if user works from home full-time (no acoustic door, fridge hum, call backdrop).
- Weigh acoustic dBA, privacy (landlord on-site vs standalone), parking security, load-shedding resilience (gas/solar), and price-per-sqm value.

PROPERTIES:
{json_mod.dumps(summaries, indent=2)}

Return STRICT JSON only (no markdown fences):
{{
  "winner_id": "id of #1 recommended property",
  "executive_verdict": "2-3 concise sentences explaining why the winner beats the others for this user's lifestyle and key trade-offs.",
  "rankings": [
    {{
      "id": "property id",
      "rank": 1,
      "score": 88,
      "headline": "Short title",
      "best_for": "Top 1-2 strengths",
      "biggest_tradeoff": "Top 1-2 compromises or risks",
      "wfh_fit": "1 concise sentence on WFH suitability",
      "acoustic_verdict": "1 concise sentence on noise/privacy",
      "value_verdict": "1 concise sentence on rent vs space/amenities"
    }}
  ],
  "matrix_highlights": [
    {{"category": "Overall AI Fit", "winner_id": "id", "note": "short reason"}},
    {{"category": "Monthly Value", "winner_id": "id", "note": "short reason"}},
    {{"category": "Acoustic & Privacy", "winner_id": "id", "note": "short reason"}}
  ]
}}"""

        for m_name in ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
            try:
                llm = ChatGoogleGenerativeAI(model=m_name, api_key=api_key, temperature=0.2, request_timeout=40)
                resp = await llm.ainvoke([HumanMessage(content=prompt)])
                text = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                text = re.sub(r'^```(?:json)?\s*', '', text)
                text = re.sub(r'\s*```$', '', text)
                parsed = json_mod.loads(text)
                parsed["is_fallback"] = False
                return {"status": "success", "comparison": parsed}
            except Exception as e:
                if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e) or "402" in str(e):
                    continue
                raise e
        return {"status": "fallback", "comparison": _build_compare_fallback(props, req.personal_preferences, "AI Studio prepayment credits depleted")}
    except Exception as e:
        print_safe(f"[COMPARE AI ERROR] {e}")
        return {"status": "fallback", "comparison": _build_compare_fallback(props, req.personal_preferences, str(e)[:80])}


class ListingChatMessage(BaseModel):
    role: str
    content: str


class ListingChatRequest(BaseModel):
    property: Dict[str, Any]
    audit: Optional[Dict[str, Any]] = None
    personal_preferences: str = ""
    messages: List[ListingChatMessage] = []
    question: str


@router.post("/api/listing/chat")
async def listing_followup_chat(req: ListingChatRequest):
    """Continues the forensic inspection conversation for a single property."""
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    prop = req.property or {}
    audit = req.audit or {}
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "status": "fallback",
            "reply": "Live Gemini AI is not configured (missing API key), so no credit was charged.",
            "is_fallback": True,
        }

    try:
        import json as json_mod
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

        context_obj = {
            "title": prop.get("title"),
            "address": prop.get("address"),
            "suburb": prop.get("suburb"),
            "price": prop.get("price"),
            "bedrooms": prop.get("bedrooms"),
            "bathrooms": prop.get("bathrooms"),
            "sqm": prop.get("sqm"),
            "description": (prop.get("description") or "")[:1800],
            "fibre_ready": prop.get("fibre_ready"),
            "has_garage": prop.get("has_garage"),
            "has_secure_bay": prop.get("has_secure_bay"),
            "stove_type": prop.get("stove_type"),
            "pet_friendly": prop.get("pet_friendly"),
            "is_security_estate": prop.get("is_security_estate"),
            "estate_name": prop.get("estate_name"),
            "acoustic_audit": prop.get("acoustic_audit"),
            "agency_name": prop.get("agency_name"),
            "agency_rating": prop.get("agency_rating"),
            "report_summary": {
                "tenancyType": audit.get("tenancyType"),
                "wfhLayoutVerdict": audit.get("wfhLayoutVerdict"),
                "windowLightAudit": audit.get("windowLightAudit"),
                "wallAcousticAudit": audit.get("wallAcousticAudit"),
                "photoStory": audit.get("photoStory"),
                "pros": (audit.get("pros") or [])[:6],
                "cons": (audit.get("cons") or [])[:6],
            },
            "user_preferences": req.personal_preferences,
        }

        sys_prompt = (
            "You are HomeSeek's forensic Cape Town rental advisor. Answer the user's follow-up question about this specific "
            "property concisely (2-5 sentences or tight bullet points), grounding your answer strictly in the listing data, "
            "location context, and forensic report below. Flag unknowns honestly and suggest what to verify at a viewing.\n\n"
            f"PROPERTY & REPORT CONTEXT:\n{json_mod.dumps(context_obj, default=str)}"
        )

        lc_msgs: List[Any] = [SystemMessage(content=sys_prompt)]
        for m in (req.messages or [])[-10:]:
            txt = (m.content or "").strip()
            if not txt:
                continue
            if m.role == "assistant":
                lc_msgs.append(AIMessage(content=txt))
            else:
                lc_msgs.append(HumanMessage(content=txt))
        lc_msgs.append(HumanMessage(content=question))

        for m_name in ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
            try:
                llm = ChatGoogleGenerativeAI(model=m_name, api_key=api_key, temperature=0.3, request_timeout=35)
                resp = await llm.ainvoke(lc_msgs)
                reply = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                if reply:
                    return {"status": "success", "reply": reply, "is_fallback": False}
            except Exception as e:
                if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e) or "402" in str(e):
                    continue
                raise e

        return {
            "status": "fallback",
            "reply": "AI Studio quota is currently depleted, so no credit was charged. Please try again later.",
            "is_fallback": True,
        }
    except Exception as e:
        print_safe(f"[LISTING CHAT ERROR] {e}")
        return {
            "status": "fallback",
            "reply": f"Could not reach Gemini AI right now ({str(e)[:80]}), so no credit was charged.",
            "is_fallback": True,
        }

