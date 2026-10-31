import sys, asyncio
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.places_service import search_places

async def test():
    for q in ['kloof', 'virgin', 'amazon', 'table mountain', 'beach']:
        res = await search_places(q, limit=3)
        print(f'Query: "{q}" -> {len(res)} results')
        for r in res:
            print(f"  -> {r['main_text']} | {r['secondary_text']} | {r['suggested_mode']} | label: {r['default_label']}")

asyncio.run(test())

