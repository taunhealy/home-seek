import json

with open('api/scraper/p24_areas_cache.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Type:", type(data))
if isinstance(data, dict):
    print("Keys sample:", list(data.keys())[:10])
    first_key = list(data.keys())[0]
    print(f"Sample value for '{first_key}':", data[first_key])
elif isinstance(data, list):
    print("Length:", len(data))
    print("Sample items:", data[:5])

