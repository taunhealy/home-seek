import re

file_path = r'c:\Ryoko\Projects\home-seek\api\main.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

endpoint_code = '''
@app.get("/api/places/autocomplete")
async def autocomplete_places_endpoint(q: str = "", limit: int = 8):
    """
    Provides real-time Google Maps / Places autocomplete suggestions for destinations and anchors.
    Uses Google Places Autocomplete API when GOOGLE_PLACES_API_KEY is available,
    with instant fallback to curated Cape Town places of interest.
    """
    try:
        from services.places_service import search_places
        results = await search_places(q, limit=limit)
        return {
            "status": "success",
            "query": q,
            "suggestions": results
        }
    except Exception as e:
        print_safe(f"[PLACES AUTOCOMPLETE ERROR] {e}")
        return {"status": "success", "query": q, "suggestions": []}
'''

if '/api/places/autocomplete' not in content:
    # insert before @app.post("/api/reports/update-locations")
    content = content.replace('@app.post("/api/reports/update-locations")', endpoint_code + '\n@app.post("/api/reports/update-locations")')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected /api/places/autocomplete into main.py!")

