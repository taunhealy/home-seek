with open('api/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

endpoint_code = """
@app.get("/api/acoustics/hotspots")
async def get_acoustic_hotspots():
    \"\"\"Returns calibrated Cape Town noise hotspots, transit corridors, and sanctuary zones.\"\"\"
    from services.acoustic_registry import NOISE_HOTSPOTS, SANCTUARY_ZONES
    return {
        "status": "success",
        "hotspots": NOISE_HOTSPOTS,
        "sanctuary_zones": SANCTUARY_ZONES
    }
"""

if "/api/acoustics/hotspots" not in text:
    text += "\n" + endpoint_code
    with open('api/main.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESS: Added /api/acoustics/hotspots endpoint to api/main.py")
else:
    print("/api/acoustics/hotspots already present")

