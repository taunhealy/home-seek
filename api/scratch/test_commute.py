import sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.commute_service import CommuteService, CAPE_TOWN_COORDINATES
import asyncio

# add gardens & kloof street
CAPE_TOWN_COORDINATES.update({
    "gardens": (-33.9333, 18.4111),
    "kloof street": (-33.9315, 18.4105),
    "tamboerskloof": (-33.9280, 18.4050),
    "oranjezicht": (-33.9390, 18.4180),
    "table mountain": (-33.9450, 18.4080),
    "kloof nek": (-33.9440, 18.3970),
    "deer park": (-33.9420, 18.4280)
})

async def test():
    service = CommuteService()
    anchors = [
        {'label': 'Work HQ (Amazon River Club)', 'target_place': 'Amazon River Club, Observatory', 'mode': 'driving'},
        {'label': 'Kloof Street Cafes & Dining', 'target_place': 'Kloof Street', 'mode': 'walking'},
        {'label': 'Table Mountain MTB Trailhead', 'target_place': 'Deer Park, Table Mountain', 'mode': 'bicycling'},
        {'label': 'Cape Town CBD', 'target_place': 'Cape Town CBD', 'mode': 'driving'},
        {'label': 'Camps Bay Beach', 'target_place': 'Camps Bay', 'mode': 'driving'},
    ]
    for a in anchors:
        res = await service.calculate_commute(
            origin_address='10 Union Street, Gardens',
            destination=a['target_place'],
            anchor_label=a['label'],
            mode=a.get('mode', 'driving')
        )
        print(f"{res.anchor_label} ({a['target_place']}): {res.duration_text} ({res.distance_text}) | Maps: {res.maps_route_url}")

asyncio.run(test())
