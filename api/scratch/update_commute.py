import re

file_path = r'c:\Ryoko\Projects\home-seek\api\services\commute_service.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Expand CAPE_TOWN_COORDINATES
old_coords_block = '''    # City Bowl & Atlantic Seaboard
    "cape town cbd": (-33.9249, 18.4241),
    "foreshore": (-33.9188, 18.4310),
    "v&a waterfront": (-33.9036, 18.4205),
    "waterfront": (-33.9036, 18.4205),
    "sea point": (-33.9175, 18.3887),
    "green point": (-33.9080, 18.4080),
    "camps bay": (-33.9515, 18.3780),
    "clifton": (-33.9380, 18.3780),
    "hout bay": (-34.0487, 18.3562),
    "hout bay beachfront": (-34.0440, 18.3580),
    "llandudno": (-34.0080, 18.3410),'''

new_coords_block = '''    # City Bowl & Atlantic Seaboard
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
    "llandudno": (-34.0080, 18.3410),'''

if old_coords_block in content:
    content = content.replace(old_coords_block, new_coords_block)

# 2. Update mode handling in fallback
old_mode_block = '''        # Average driving speed in mixed suburban/traffic is ~42 km/h
        if mode == "walking":
            est_mins = int(round(road_km * 12.0)) # ~5 km/h
            dur_text = f"{est_mins} mins walk"
        else:
            est_mins = int(round((road_km / 42.0) * 60.0))
            dur_text = f"{est_mins} mins drive"'''

new_mode_block = '''        # Realistic speed heuristics across Cape Town terrain
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
            dur_text = f"{est_mins} mins drive"'''

if old_mode_block in content:
    content = content.replace(old_mode_block, new_mode_block)

# 3. Add calculate_listing_proximities and instance export at bottom
export_block = '''

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
'''

if 'commute_service = CommuteService()' not in content:
    content = content.rstrip() + export_block

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated commute_service.py!")

