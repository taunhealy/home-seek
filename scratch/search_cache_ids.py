import json

with open('api/scraper/p24_areas_cache.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for suburb in ['rondebosch', 'tamboerskloof', 'george', 'woodstock', 'gardens', 'newlands', 'tokai']:
    print(f"=== {suburb} ===")
    matches = [x for x in data if suburb in str(x.get('name', '')).lower() or suburb in str(x.get('slug', '')).lower()]
    for m in matches[:3]:
        print(" ", m)

