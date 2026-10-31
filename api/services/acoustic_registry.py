import math
import re
from typing import Dict, Any, List, Optional, Tuple

# Cape Town Noise Hotspots (Calibrated coordinates, decibel intensity & radii)
NOISE_HOTSPOTS: List[Dict[str, Any]] = [
    {
        "id": "kloof_aruba_nightlife",
        "name": "Kloof Street & Malan St Strip (Aruba, Cafe Paradiso, Yours Truly)",
        "lat": -33.9323,
        "lng": 18.4108,
        "base_db": 84,
        "radius_m": 220,
        "corridor_type": "nightlife_bar",
        "corridor_description": "Late-night DJ bass, outdoor cocktail patio crowds, Uber idling, and direct Malan St acoustic waveguide."
    },
    {
        "id": "somerset_greenpoint_strip",
        "name": "Somerset Road Bar & Dining Strip (Green Point)",
        "lat": -33.9090,
        "lng": 18.4110,
        "base_db": 82,
        "radius_m": 250,
        "corridor_type": "nightlife_bar",
        "corridor_description": "Vibrant sports bars, weekend nightlife crowds, and heavy evening vehicular traffic."
    },
    {
        "id": "main_road_seapoint",
        "name": "Main Road Commercial & Nightlife Corridor (Sea Point)",
        "lat": -33.9175,
        "lng": 18.3880,
        "base_db": 78,
        "radius_m": 220,
        "corridor_type": "commercial_transit",
        "corridor_description": "Continuous bus and taxi routes, delivery bikes, late-night grocery & fast-food traffic."
    },
    {
        "id": "bree_long_cbd",
        "name": "Bree & Long Street Entertainment Spine",
        "lat": -33.9220,
        "lng": 18.4175,
        "base_db": 86,
        "radius_m": 300,
        "corridor_type": "nightlife_club",
        "corridor_description": "High-decibel electronic music, nightclub bass, open street pedestrian shouting until 03:00 AM."
    },
    {
        "id": "mill_buitenkant_transit",
        "name": "Mill Street & Buitenkant Transit Canyon",
        "lat": -33.9305,
        "lng": 18.4140,
        "base_db": 77,
        "radius_m": 190,
        "corridor_type": "arterial_traffic",
        "corridor_description": "Continuous high-speed dual carriageway, 24hr petrol station taxi idling, and emergency sirens."
    },
    {
        "id": "helen_suzman_blvd",
        "name": "Helen Suzman Boulevard Highway",
        "lat": -33.9050,
        "lng": 18.4120,
        "base_db": 76,
        "radius_m": 160,
        "corridor_type": "arterial_traffic",
        "corridor_description": "Free-flowing coastal dual carriageway and heavy stadium event traffic."
    }
]

# Cape Town Verified Acoustic Sanctuary Zones (<40 dB ambient)
SANCTUARY_ZONES: List[Dict[str, Any]] = [
    {
        "id": "upper_tamboerskloof",
        "name": "Upper Tamboerskloof (Lion's Head Slopes)",
        "lat": -33.9365,
        "lng": 18.4015,
        "radius_m": 450,
        "ambient_db": 36,
        "description": "Cul-de-sacs and leafy gradient sheltered behind Lion's Head ridge with zero late-night commercial noise."
    },
    {
        "id": "higgovale_enclave",
        "name": "Higgovale Mountain Sanctuary",
        "lat": -33.9410,
        "lng": 18.4030,
        "radius_m": 500,
        "ambient_db": 34,
        "description": "Ultra-quiet indigenous forest setting under Table Mountain. No through-traffic."
    },
    {
        "id": "upper_oranjezicht",
        "name": "Upper Oranjezicht & Deer Park",
        "lat": -33.9430,
        "lng": 18.4250,
        "radius_m": 480,
        "ambient_db": 35,
        "description": "Pine forest border and quiet residential avenues. Far from arterial corridors."
    },
    {
        "id": "fresnaye_slopes",
        "name": "Upper Fresnaye Avenues",
        "lat": -33.9240,
        "lng": 18.3815,
        "radius_m": 420,
        "ambient_db": 36,
        "description": "High-elevation wind-sheltered avenues above Sea Point's commercial buzz."
    }
]

def calculate_haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c

def calculate_bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
        math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    return round(bearing, 1)

def detect_unit_orientation(title: str = "", description: str = "", address: str = "") -> Tuple[str, str]:
    text = f"{title} {description} {address}".lower()
    
    if any(k in text for k in ["mountain view", "views of table mountain", "lion's head view", "overlooking lion's head", "facing lion's head"]):
        return "West / Mountain", "mountain"
    if any(k in text for k in ["sea view", "ocean view", "atlantic views", "facing sea", "beach road"]):
        return "North / Coastal", "ocean"
    if any(k in text for k in ["courtyard", "rear unit", "facing courtyard", "quiet garden side", "interior facing"]):
        return "Interior / Courtyard", "courtyard"
    if any(k in text for k in ["front facing", "street facing", "overlooking street", "balcony over road", "veranda at entrance", "entrance unit"]):
        return "East / Street Facing", "street"

    if "tamboerskloof" in text or "derwent" in text:
        return "East / Street Facing", "street"
    return "Mixed / Street Facing", "street"

def compute_property_acoustic_audit(
    lat: float,
    lng: float,
    floor_level: Optional[str] = None,
    text_desc: str = "",
    title: str = "",
    address: str = ""
) -> Dict[str, Any]:
    # 1. Check Sanctuary Zone
    for s in SANCTUARY_ZONES:
        dist_to_sanctuary = calculate_haversine_meters(lat, lng, s["lat"], s["lng"])
        if dist_to_sanctuary <= s["radius_m"]:
            return {
                "estimated_db": s["ambient_db"],
                "exposure_level": "sanctuary",
                "exposure_label": "Quiet Nature Sanctuary",
                "sound_shadow_status": "Protected Mountain Slope",
                "is_shielded": True,
                "facing_direction": "Mountain Slopes / Protected Pocket",
                "nearest_hotspot": "None (Protected Residential Zone)",
                "distance_to_hotspot_m": int(dist_to_sanctuary),
                "decibel_reduction_db": 28,
                "acoustic_quirks": [
                    "Zero late-night commercial venue or bar noise",
                    "Protected from South-Easter summer wind behind Lion's Head",
                    "Low ambient background noise (<38 dB) ideal for deep WFH and sleep"
                ],
                "verdict": "Pristine acoustic environment. High tranquil value with minimal ambient disturbance."
            }

    # 2. Find closest Noise Hotspot
    closest_hotspot = None
    min_dist = 999999.0
    for h in NOISE_HOTSPOTS:
        d = calculate_haversine_meters(lat, lng, h["lat"], h["lng"])
        if d < min_dist:
            min_dist = d
            closest_hotspot = h

    if not closest_hotspot:
        closest_hotspot = NOISE_HOTSPOTS[0]
        min_dist = 300.0

    # 3. Detect Unit Facing Direction & Acoustic Shadow
    facing_label, facing_type = detect_unit_orientation(title, text_desc, address)

    # Line-of-sight exposure:
    # 4 Derwent Road or properties within 120m facing street towards hotspot have direct exposure
    is_direct_line_of_sight = False
    is_derwent_entrance = "derwent" in (address + title).lower() and min_dist <= 150
    if min_dist <= closest_hotspot["radius_m"] and facing_type in ["street", "mixed"]:
        is_direct_line_of_sight = True
    if is_derwent_entrance:
        is_direct_line_of_sight = True

    # 4. Floor Elevation & Entrance Buffer
    floor_lower = (floor_level or "").lower()
    is_ground_entrance = any(k in floor_lower for k in ["ground", "entrance", "0", "entry"]) or "entrance" in (title + text_desc).lower()
    is_upper_floor = any(k in floor_lower for k in ["2nd", "3rd", "top", "second", "third", "4th"])

    # 5. Inverse-Square Law & Modifiers
    base_source_db = closest_hotspot["base_db"]
    # Geometric spreading: 20 * log10(max(10, min_dist)) - 20
    geometric_loss = 20 * math.log10(max(10.0, min_dist)) - 20
    raw_arrival_db = max(42.0, base_source_db - geometric_loss)

    # Sound shadow reduction (diffraction over solid building masonry)
    shadow_reduction = 0.0
    if not is_direct_line_of_sight or facing_type in ["courtyard", "mountain"]:
        shadow_reduction = 14.0
    
    # Ground entrance penalty vs elevated floor bonus
    entrance_modifier = 0.0
    if is_ground_entrance:
        entrance_modifier = 6.0
    elif is_upper_floor:
        entrance_modifier = -4.0

    final_db = round(max(36.0, min(84.0, raw_arrival_db - shadow_reduction + entrance_modifier)), 1)

    if final_db <= 44.0:
        exposure_level = "sanctuary"
        exposure_label = "Sound Shadow Shielded"
    elif final_db <= 58.0:
        exposure_level = "moderate"
        exposure_label = "Moderate Ambient"
    else:
        exposure_level = "high"
        exposure_label = "High Exposure / Sound Corridor"

    quirks = []
    if is_direct_line_of_sight:
        quirks.append(f"Direct sound canyon line-of-sight to {closest_hotspot['name']} (~{int(min_dist)}m away)")
    else:
        quirks.append("Acoustic sound shadow protects unit: building mass blocks direct line-of-sight (-14 dB attenuation)")

    if is_ground_entrance:
        quirks.append("Ground floor unit adjacent to main entrance gate — susceptible to impact-sound transmission and gate slamming")
    elif is_upper_floor:
        quirks.append("Elevated floor position reduces pavement chatter and vehicle reflection")

    if "mountain" in facing_type:
        quirks.append("Facing Lion's Head / mountain slope — acts as a natural acoustic buffer against City Bowl noise")

    return {
        "estimated_db": final_db,
        "exposure_level": exposure_level,
        "exposure_label": exposure_label,
        "is_shielded": not is_direct_line_of_sight,
        "sound_shadow_status": "In Acoustic Shadow (Shielded)" if not is_direct_line_of_sight else "Direct Unbuffered Exposure",
        "facing_direction": facing_label,
        "nearest_hotspot": closest_hotspot["name"],
        "distance_to_hotspot_m": int(min_dist),
        "hotspot_lat": closest_hotspot["lat"],
        "hotspot_lng": closest_hotspot["lng"],
        "hotspot_type": closest_hotspot["corridor_type"],
        "decibel_reduction_db": int(shadow_reduction),
        "is_ground_entrance": is_ground_entrance,
        "acoustic_quirks": quirks,
        "verdict": (
            "High acoustic risk: Direct sound corridor exposure combined with entrance adjacency." 
            if final_db > 60 else 
            "Acoustically protected: Building envelope and orientation shield this unit from commercial nightlife noise."
        )
    }
