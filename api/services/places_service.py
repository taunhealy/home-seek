import os
import re
import urllib.parse
from typing import List, Dict, Any, Optional
try:
    import httpx
except ImportError:
    httpx = None

# Comprehensive Curated Cape Town POI / Life Anchor Database
CAPE_TOWN_PRESET_PLACES = [
    # Work & Tech Hubs
    {
        "main_text": "Amazon River Club HQ",
        "secondary_text": "Observatory, Cape Town",
        "category": "work",
        "suggested_mode": "driving",
        "default_label": "Work (Amazon River Club)",
        "default_mins": 25
    },
    {
        "main_text": "Cape Town CBD / Foreshore",
        "secondary_text": "City Bowl, Cape Town",
        "category": "work",
        "suggested_mode": "driving",
        "default_label": "Cape Town CBD",
        "default_mins": 15
    },
    {
        "main_text": "Workshop17 Kloof Street",
        "secondary_text": "Kloof Street, Gardens, Cape Town",
        "category": "work",
        "suggested_mode": "walking",
        "default_label": "Coworking (Workshop17 Kloof)",
        "default_mins": 10
    },
    {
        "main_text": "Workshop17 Watershed",
        "secondary_text": "V&A Waterfront, Cape Town",
        "category": "work",
        "suggested_mode": "driving",
        "default_label": "Coworking (Workshop17 V&A)",
        "default_mins": 15
    },
    {
        "main_text": "Roeland Square Tech Hub",
        "secondary_text": "Roeland Street, Gardens, Cape Town",
        "category": "work",
        "suggested_mode": "walking",
        "default_label": "Work (Roeland Square)",
        "default_mins": 15
    },
    {
        "main_text": "Century City Financial District",
        "secondary_text": "Century City, Cape Town",
        "category": "work",
        "suggested_mode": "driving",
        "default_label": "Work (Century City)",
        "default_mins": 30
    },
    {
        "main_text": "Cavendish Square & Financial Precinct",
        "secondary_text": "Claremont, Cape Town",
        "category": "work",
        "suggested_mode": "driving",
        "default_label": "Work (Claremont Precinct)",
        "default_mins": 25
    },
    {
        "main_text": "UCT Upper Campus",
        "secondary_text": "Rondebosch, Cape Town",
        "category": "study",
        "suggested_mode": "driving",
        "default_label": "University of Cape Town (UCT)",
        "default_mins": 20
    },

    # Lifestyle, Cafes & Dining
    {
        "main_text": "Kloof Street Cafes & Dining",
        "secondary_text": "Gardens, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "walking",
        "default_label": "Kloof Street Dining & Cafes",
        "default_mins": 10
    },
    {
        "main_text": "Bree Street Culinary Strip",
        "secondary_text": "City Bowl, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "walking",
        "default_label": "Bree Street Restaurants",
        "default_mins": 15
    },
    {
        "main_text": "V&A Waterfront",
        "secondary_text": "Breakwater Blvd, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "driving",
        "default_label": "V&A Waterfront",
        "default_mins": 15
    },
    {
        "main_text": "Gardens Shopping Centre",
        "secondary_text": "Mill Street, Gardens, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "walking",
        "default_label": "Gardens Centre (Groceries)",
        "default_mins": 8
    },
    {
        "main_text": "Sea Point Promenade",
        "secondary_text": "Beach Road, Sea Point, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "driving",
        "default_label": "Sea Point Promenade",
        "default_mins": 15
    },
    {
        "main_text": "Old Biscuit Mill",
        "secondary_text": "Albert Road, Woodstock, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "driving",
        "default_label": "Old Biscuit Mill (Woodstock)",
        "default_mins": 15
    },

    # Gyms & Fitness
    {
        "main_text": "Virgin Active Kloof Street",
        "secondary_text": "Kloof Street, Gardens, Cape Town",
        "category": "gym",
        "suggested_mode": "walking",
        "default_label": "Gym (Virgin Active Kloof)",
        "default_mins": 10
    },
    {
        "main_text": "Virgin Active Point",
        "secondary_text": "Bill Peters Drive, Green Point, Cape Town",
        "category": "gym",
        "suggested_mode": "driving",
        "default_label": "Gym (Virgin Active Point)",
        "default_mins": 15
    },
    {
        "main_text": "Zone Fitness Gardens",
        "secondary_text": "Gardens Shopping Centre, Cape Town",
        "category": "gym",
        "suggested_mode": "walking",
        "default_label": "Gym (Zone Fitness Gardens)",
        "default_mins": 8
    },
    {
        "main_text": "Roark Gyms City Bowl",
        "secondary_text": "Buitengracht Street, Cape Town",
        "category": "gym",
        "suggested_mode": "walking",
        "default_label": "Gym (Roark City Bowl)",
        "default_mins": 12
    },

    # Outdoor, Trails, Mountain & Surf
    {
        "main_text": "Table Mountain Deer Park MTB Trailhead",
        "secondary_text": "Deer Park Drive, Vredehoek, Cape Town",
        "category": "outdoors",
        "suggested_mode": "bicycling",
        "default_label": "Table Mountain MTB Trails",
        "default_mins": 15
    },
    {
        "main_text": "Kloof Nek Trailhead & Cableway Base",
        "secondary_text": "Tafelberg Road, Cape Town",
        "category": "outdoors",
        "suggested_mode": "driving",
        "default_label": "Kloof Nek Trailhead",
        "default_mins": 10
    },
    {
        "main_text": "Lions Head Hiking Trailhead",
        "secondary_text": "Signal Hill Road, Cape Town",
        "category": "outdoors",
        "suggested_mode": "driving",
        "default_label": "Lions Head Trail",
        "default_mins": 12
    },
    {
        "main_text": "Camps Bay Beach",
        "secondary_text": "Victoria Road, Camps Bay, Cape Town",
        "category": "outdoors",
        "suggested_mode": "driving",
        "default_label": "Camps Bay Beach",
        "default_mins": 12
    },
    {
        "main_text": "Clifton 4th Beach",
        "secondary_text": "Victoria Road, Clifton, Cape Town",
        "category": "outdoors",
        "suggested_mode": "driving",
        "default_label": "Clifton Beaches",
        "default_mins": 12
    },
    {
        "main_text": "Muizenberg Surfers Corner",
        "secondary_text": "Beach Road, Muizenberg, Cape Town",
        "category": "outdoors",
        "suggested_mode": "driving",
        "default_label": "Muizenberg Surf Spot",
        "default_mins": 30
    },
    {
        "main_text": "Glen Beach Surf Break",
        "secondary_text": "Camps Bay, Cape Town",
        "category": "outdoors",
        "suggested_mode": "driving",
        "default_label": "Glen Beach Surf",
        "default_mins": 12
    },

    # Neighborhoods & Common Streets
    {
        "main_text": "Union Street, Gardens",
        "secondary_text": "Gardens, Cape Town",
        "category": "location",
        "suggested_mode": "walking",
        "default_label": "Union Street (Gardens)",
        "default_mins": 5
    },
    {
        "main_text": "Warren Street, Tamboerskloof",
        "secondary_text": "Tamboerskloof, Cape Town",
        "category": "location",
        "suggested_mode": "walking",
        "default_label": "Warren Street (Tamboerskloof)",
        "default_mins": 10
    },
    {
        "main_text": "Derwent Road, Gardens",
        "secondary_text": "Gardens, Cape Town",
        "category": "location",
        "suggested_mode": "walking",
        "default_label": "Derwent Road (Gardens)",
        "default_mins": 5
    },
    {
        "main_text": "Hof Street, Gardens",
        "secondary_text": "Gardens, Cape Town",
        "category": "location",
        "suggested_mode": "walking",
        "default_label": "Hof Street (Gardens)",
        "default_mins": 5
    },
    {
        "main_text": "Camp Street, Gardens",
        "secondary_text": "Gardens, Cape Town",
        "category": "location",
        "suggested_mode": "walking",
        "default_label": "Camp Street (Gardens)",
        "default_mins": 8
    },
    {
        "main_text": "Buitenkant Street, City Bowl",
        "secondary_text": "City Bowl, Cape Town",
        "category": "location",
        "suggested_mode": "walking",
        "default_label": "Buitenkant Street",
        "default_mins": 10
    },
    {
        "main_text": "Main Road, Green Point",
        "secondary_text": "Green Point, Cape Town",
        "category": "location",
        "suggested_mode": "driving",
        "default_label": "Green Point Main Road",
        "default_mins": 12
    },
    {
        "main_text": "Regent Road, Sea Point",
        "secondary_text": "Sea Point, Cape Town",
        "category": "lifestyle",
        "suggested_mode": "driving",
        "default_label": "Regent Road (Sea Point)",
        "default_mins": 15
    }
]

async def search_places(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """
    Returns place suggestions matching the query.
    1. If GOOGLE_PLACES_API_KEY is configured, calls Google Places Autocomplete API.
    2. Merges with / falls back to curated Cape Town POI database.
    """
    clean_q = query.strip().lower()
    if not clean_q:
        return CAPE_TOWN_PRESET_PLACES[:limit]

    results = []
    seen = set()

    # 1. Try Google Places Autocomplete API if key is present
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key and httpx:
        try:
            url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
            params = {
                "input": query,
                "components": "country:za",
                "location": "-33.9249,18.4241", # Cape Town Center
                "radius": "45000",
                "key": api_key
            }
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    preds = data.get("predictions", [])
                    for p in preds:
                        desc = p.get("description", "")
                        fmt = p.get("structured_formatting", {})
                        main_t = fmt.get("main_text", desc)
                        sec_t = fmt.get("secondary_text", "")
                        
                        # Guess category
                        cat = "location"
                        lower = desc.lower()
                        if any(w in lower for w in ["gym", "fitness", "crossfit", "yoga"]):
                            cat = "gym"
                        elif any(w in lower for w in ["cafe", "coffee", "restaurant", "bistro", "mall", "market"]):
                            cat = "lifestyle"
                        elif any(w in lower for w in ["beach", "trail", "mountain", "park", "surf", "nature"]):
                            cat = "outdoors"
                        elif any(w in lower for w in ["amazon", "office", "headquarters", "hq", "campus", "work"]):
                            cat = "work"

                        # Guess commute mode
                        mode = "driving"
                        if cat in ["lifestyle", "gym"] and ("gardens" in lower or "kloof" in lower):
                            mode = "walking"
                        elif "mtb" in lower or "trail" in lower:
                            mode = "bicycling"

                        key = main_t.lower()
                        if key not in seen:
                            seen.add(key)
                            results.append({
                                "description": desc,
                                "main_text": main_t,
                                "secondary_text": sec_t,
                                "category": cat,
                                "suggested_mode": mode,
                                "default_label": main_t,
                                "default_mins": 15 if mode == "walking" else 20
                            })
        except Exception as e:
            pass

    # 2. Match against Curated Cape Town Database (offline / zero-latency / fallback)
    for p in CAPE_TOWN_PRESET_PLACES:
        full_text = f"{p['main_text']} {p['secondary_text']} {p['default_label']}".lower()
        key = p['main_text'].lower()
        if key in seen:
            continue
            
        # Match words or substring
        q_words = clean_q.split()
        if all(w in full_text for w in q_words) or clean_q in full_text:
            seen.add(key)
            results.append({
                "description": f"{p['main_text']}, {p['secondary_text']}",
                "main_text": p["main_text"],
                "secondary_text": p["secondary_text"],
                "category": p["category"],
                "suggested_mode": p["suggested_mode"],
                "default_label": p["default_label"],
                "default_mins": p["default_mins"]
            })
            if len(results) >= limit:
                break

    return results[:limit]

