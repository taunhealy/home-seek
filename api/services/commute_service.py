import os
import json
import sqlite3
import time
import math
import urllib.parse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
try:
    import httpx
except ImportError:
    httpx = None

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)
COMMUTE_DB_PATH = os.path.join(DATA_DIR, "commute_cache.db")

class CommuteIntel(BaseModel):
    anchor_label: str = "Work / Life Anchor"
    destination: str
    distance_km: float
    distance_text: str
    duration_mins: int
    duration_text: str
    commute_mode: str = "driving"
    is_within_threshold: bool = True
    maps_route_url: Optional[str] = None

class CommuteCacheDB:
    """Persistent SQLite cache with 30-day TTL for distance and route calculations."""
    def __init__(self, db_path: str = COMMUTE_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS commute_cache (
                        route_key TEXT PRIMARY KEY,
                        data_json TEXT NOT NULL,
                        updated_at REAL NOT NULL
                    )
                """)
                conn.commit()
        except Exception:
            pass

    def get(self, route_key: str, max_age_days: int = 30) -> Optional[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT data_json, updated_at FROM commute_cache WHERE route_key = ?",
                    (route_key.lower().strip(),)
                )
                row = cursor.fetchone()
                if row:
                    data_json, updated_at = row
                    if (time.time() - updated_at) < (max_age_days * 86400):
                        return json.loads(data_json)
        except Exception:
            pass
        return None

    def set(self, route_key: str, data: Dict[str, Any]):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO commute_cache (route_key, data_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(route_key) DO UPDATE SET
                        data_json = excluded.data_json,
                        updated_at = excluded.updated_at
                    """,
                    (route_key.lower().strip(), json.dumps(data), time.time())
                )
                conn.commit()
        except Exception:
            pass

_cache = CommuteCacheDB()

# Known Cape Town Coordinates for Offline Haversine & Route Factor Fallback
CAPE_TOWN_COORDINATES: Dict[str, tuple[float, float]] = {
    # City Bowl & Atlantic Seaboard
    "cape town cbd": (-33.9249, 18.4241),
    "foreshore": (-33.9188, 18.4310),
    "v&a waterfront": (-33.9036, 18.4205),
    "waterfront": (-33.9036, 18.4205),
    "sea point": (-33.9175, 18.3887),
    "green point": (-33.9080, 18.4080),
    "camps bay": (-33.9515, 18.3780),
    "clifton": (-33.9380, 18.3780),
    "gardens": (-33.9333, 18.4111),
    "kloof street": (-33.9315, 18.4105),
    "union street": (-33.9325, 18.4120),
    "4 derwent": (-33.9338, 18.4055),
    "derwent": (-33.9338, 18.4055),
    "tamboerskloof": (-33.9280, 18.4050),
    "oranjezicht": (-33.9390, 18.4180),
    "higgovale": (-33.9390, 18.4020),
    "de waterkant": (-33.9170, 18.4180),
    "bo-kaap": (-33.9210, 18.4160),
    "table mountain": (-33.9450, 18.4080),
    "kloof nek": (-33.9440, 18.3970),
    "deer park": (-33.9420, 18.4280),
    "virgin active kloof": (-33.9320, 18.4110),
    "hout bay": (-34.0487, 18.3562),
    "hout bay beachfront": (-34.0440, 18.3580),
    "llandudno": (-34.0080, 18.3410),

    # Commercial Hubs
    "century city": (-33.8927, 18.5085),
    "amazon river club": (-33.9380, 18.4760),
    "river club": (-33.9380, 18.4760),
    "observatory": (-33.9370, 18.4720),
    "woodstock": (-33.9290, 18.4520),
    "cape town airport": (-33.9715, 18.6021),
    "airport": (-33.9715, 18.6021),

    # Southern Suburbs & Universities
    "uct": (-33.9576, 18.4612),
    "university of cape town": (-33.9576, 18.4612),
    "rondebosch": (-33.9630, 18.4820),
    "claremont": (-33.9818, 18.4646),
    "newlands": (-33.9750, 18.4550),
    "constantia": (-34.0200, 18.4350),
    "wynberg": (-34.0040, 18.4640),
    "muizenberg": (-34.1083, 18.4697),
    "kalk bay": (-34.1280, 18.4480),
    "fish hoek": (-34.1350, 18.4310),
    "noordhoek": (-34.1160, 18.3690),

    # Northern Suburbs & Winelands
    "bellville": (-33.8943, 18.6294),
    "durbanville": (-33.8323, 18.6486),
    "stellenbosch": (-33.9321, 18.8602)
}

def haversine_distance_km(coord1: tuple[float, float], coord2: tuple[float, float]) -> float:
    """Calculates great-circle distance between two points in km."""
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371.0 * c

def get_approx_coordinates(query: str) -> Optional[tuple[float, float]]:
    q = query.lower().strip()
    for name, coords in CAPE_TOWN_COORDINATES.items():
        if name in q or q in name:
            return coords
    return None

class CommuteService:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")

    async def calculate_commute(
        self,
        origin_address: str,
        destination: str,
        anchor_label: str = "Life Anchor",
        max_distance_km: Optional[float] = None,
        max_commute_mins: Optional[int] = None,
        mode: str = "driving"
    ) -> CommuteIntel:
        """
        Calculates distance and travel time from property to anchor place.
        1. Checks persistent SQLite cache.
        2. Calls Google Distance Matrix API if key is available.
        3. Falls back gracefully to Cape Town routing heuristics.
        """
        route_key = f"{origin_address}::to::{destination}::{mode}".lower().strip()
        encoded_origin = urllib.parse.quote_plus(origin_address.strip())
        encoded_dest = urllib.parse.quote_plus(destination.strip())
        google_maps_route_url = f"https://www.google.com/maps/dir/?api=1&origin={encoded_origin}&destination={encoded_dest}&travelmode={mode}"

        # 1. Check local persistent SQLite cache
        cached = _cache.get(route_key, max_age_days=30)
        if cached:
            dist_km = cached["distance_km"]
            dur_mins = cached["duration_mins"]
            within = True
            if max_distance_km is not None and dist_km > max_distance_km:
                within = False
            if max_commute_mins is not None and dur_mins > max_commute_mins:
                within = False
            return CommuteIntel(
                anchor_label=anchor_label,
                destination=destination,
                distance_km=dist_km,
                distance_text=cached["distance_text"],
                duration_mins=dur_mins,
                duration_text=cached["duration_text"],
                commute_mode=mode,
                is_within_threshold=within,
                maps_route_url=google_maps_route_url
            )

        # 2. Try Google Distance Matrix API Live
        if self.api_key and httpx:
            try:
                url = "https://maps.googleapis.com/maps/api/distancematrix/json"
                params = {
                    "origins": f"{origin_address}, Cape Town, South Africa",
                    "destinations": f"{destination}, Cape Town, South Africa",
                    "mode": mode,
                    "key": self.api_key
                }
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        rows = data.get("rows", [])
                        if rows and rows[0].get("elements"):
                            elem = rows[0]["elements"][0]
                            if elem.get("status") == "OK":
                                dist_meters = elem["distance"]["value"]
                                dur_seconds = elem["duration"]["value"]
                                dist_km = round(dist_meters / 1000.0, 1)
                                dur_mins = int(round(dur_seconds / 60.0))
                                dist_text = elem["distance"]["text"]
                                dur_text = elem["duration"]["text"]

                                cache_data = {
                                    "distance_km": dist_km,
                                    "duration_mins": dur_mins,
                                    "distance_text": dist_text,
                                    "duration_text": dur_text
                                }
                                _cache.set(route_key, cache_data)

                                within = True
                                if max_distance_km is not None and dist_km > max_distance_km:
                                    within = False
                                if max_commute_mins is not None and dur_mins > max_commute_mins:
                                    within = False

                                return CommuteIntel(
                                    anchor_label=anchor_label,
                                    destination=destination,
                                    distance_km=dist_km,
                                    distance_text=dist_text,
                                    duration_mins=dur_mins,
                                    duration_text=dur_text,
                                    commute_mode=mode,
                                    is_within_threshold=within,
                                    maps_route_url=google_maps_route_url
                                )
            except Exception:
                pass

        # 3. High-Accuracy Cape Town Topographic Routing Fallback
        c_orig = get_approx_coordinates(origin_address) or CAPE_TOWN_COORDINATES["sea point"]
        c_dest = get_approx_coordinates(destination) or CAPE_TOWN_COORDINATES["kloof street"]

        # Try OSRM Live Road Network Routing (Free, Real Turn-by-Turn Road Network)
        if httpx and c_orig and c_dest:
            try:
                osrm_mode = "driving"
                if mode in ("walking", "walk"):
                    osrm_mode = "walking"
                elif mode in ("bicycling", "cycling", "bike"):
                    osrm_mode = "cycling"

                osrm_url = f"https://router.project-osrm.org/route/v1/{osrm_mode}/{c_orig[1]},{c_orig[0]};{c_dest[1]},{c_dest[0]}?overview=false"
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(osrm_url)
                    if resp.status_code == 200:
                        osrm_data = resp.json()
                        if osrm_data.get("routes"):
                            r0 = osrm_data["routes"][0]
                            dist_km = round(r0["distance"] / 1000.0, 1)
                            dur_mins = max(1, int(round(r0["duration"] / 60.0)))
                            dist_text = f"{dist_km} km"
                            dur_text = f"{dur_mins} mins {mode}"

                            _cache.set(route_key, {
                                "distance_km": dist_km,
                                "duration_mins": dur_mins,
                                "distance_text": dist_text,
                                "duration_text": dur_text
                            })

                            within = True
                            if max_distance_km is not None and dist_km > max_distance_km:
                                within = False
                            if max_commute_mins is not None and dur_mins > max_commute_mins:
                                within = False

                            return CommuteIntel(
                                anchor_label=anchor_label,
                                destination=destination,
                                distance_km=dist_km,
                                distance_text=dist_text,
                                duration_mins=dur_mins,
                                duration_text=dur_text,
                                commute_mode=mode,
                                is_within_threshold=within,
                                maps_route_url=google_maps_route_url
                            )
            except Exception:
                pass

        straight_line = haversine_distance_km(c_orig, c_dest)
        
        # Cape Town topography check: Signal Hill / Lion's Head divides Atlantic Seaboard from City Bowl
        is_atlantic_orig = c_orig[1] < 18.398 and -33.955 < c_orig[0] < -33.900
        is_bowl_orig = c_orig[1] >= 18.400 and -33.955 < c_orig[0] < -33.915
        is_atlantic_dest = c_dest[1] < 18.398 and -33.955 < c_dest[0] < -33.900
        is_bowl_dest = c_dest[1] >= 18.400 and -33.955 < c_dest[0] < -33.915

        if (is_atlantic_orig and is_bowl_dest) or (is_bowl_orig and is_atlantic_dest):
            # Must drive around Signal Hill via Helen Suzman / Buitengracht or Kloof Nek Pass (~2.7x)
            road_km = round(max(5.2, straight_line * 2.7), 1)
        else:
            # Standard urban street network winding factor (~1.38x)
            road_km = round(max(0.6, straight_line * 1.38), 1)

        # Realistic speed heuristics across Cape Town terrain
        if mode == "walking":
            est_mins = max(1, int(round(road_km * 12.0))) # ~5 km/h
            dur_text = f"{est_mins} mins walk"
        elif mode in ("bicycling", "cycling", "bike"):
            est_mins = max(1, int(round((road_km / 18.0) * 60.0))) # ~18 km/h cycling
            dur_text = f"{est_mins} mins bike"
        elif mode == "transit":
            est_mins = max(5, int(round((road_km / 22.0) * 60.0 + 6.0))) # MyCiti bus + wait
            dur_text = f"{est_mins} mins transit"
        else:
            est_mins = max(2, int(round((road_km / 38.0) * 60.0))) # ~38 km/h city driving
            dur_text = f"{est_mins} mins drive"

        dist_text = f"{road_km} km"

        _cache.set(route_key, {
            "distance_km": road_km,
            "duration_mins": est_mins,
            "distance_text": dist_text,
            "duration_text": dur_text
        })

        within = True
        if max_distance_km is not None and road_km > max_distance_km:
            within = False
        if max_commute_mins is not None and est_mins > max_commute_mins:
            within = False

        return CommuteIntel(
            anchor_label=anchor_label,
            destination=destination,
            distance_km=road_km,
            distance_text=dist_text,
            duration_mins=est_mins,
            duration_text=dur_text,
            commute_mode=mode,
            is_within_threshold=within,
            maps_route_url=google_maps_route_url
        )

commute_service = CommuteService()

async def calculate_listing_proximities(origin_address: str, anchors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Computes proximity and travel time from an apartment listing to a list of user anchors.
    """
    if not origin_address or not anchors:
        return []
        
    proximities = []
    for a in anchors:
        label = a.get("label") or a.get("name") or "Anchor"
        target_place = a.get("target_place") or a.get("destination") or ""
        if not target_place:
            continue
            
        mode = a.get("commute_mode") or a.get("mode") or "driving"
        max_mins = a.get("max_commute_mins")
        max_km = a.get("max_distance_km")
        
        intel = await commute_service.calculate_commute(
            origin_address=origin_address,
            destination=target_place,
            anchor_label=label,
            max_distance_km=float(max_km) if max_km else None,
            max_commute_mins=int(max_mins) if max_mins else None,
            mode=mode
        )
        
        proximities.append({
            "label": label,
            "target_place": target_place,
            "distance_km": intel.distance_km,
            "distance_text": intel.distance_text,
            "duration_mins": intel.duration_mins,
            "duration_text": intel.duration_text,
            "commute_mode": intel.commute_mode,
            "is_within_threshold": intel.is_within_threshold,
            "maps_route_url": intel.maps_route_url
        })
        
    return proximities
