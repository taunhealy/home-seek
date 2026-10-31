with open('api/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """if __name__ == "__main__":
    import uvicorn
    # Local Node usually runs on 8000 to match the frontend expectations
    uvicorn.run(app, host="0.0.0.0", port=8000)


@app.get("/api/acoustics/hotspots")
async def get_acoustic_hotspots():
    \"\"\"Returns calibrated Cape Town noise hotspots, transit corridors, and sanctuary zones.\"\"\"
    from services.acoustic_registry import NOISE_HOTSPOTS, SANCTUARY_ZONES
    return {
        "status": "success",
        "hotspots": NOISE_HOTSPOTS,
        "sanctuary_zones": SANCTUARY_ZONES
    }"""

replacement = """@app.get("/api/acoustics/hotspots")
async def get_acoustic_hotspots():
    \"\"\"Returns calibrated Cape Town noise hotspots, transit corridors, and sanctuary zones.\"\"\"
    from services.acoustic_registry import NOISE_HOTSPOTS, SANCTUARY_ZONES
    return {
        "status": "success",
        "hotspots": NOISE_HOTSPOTS,
        "sanctuary_zones": SANCTUARY_ZONES
    }

@app.post("/api/acoustics/evaluate")
async def evaluate_property_acoustics(payload: dict):
    \"\"\"Computes acoustic audit and sound shadow attenuation for given coordinates and building attributes.\"\"\"
    from services.acoustic_registry import compute_property_acoustic_audit
    lat = float(payload.get("lat", -33.9323))
    lng = float(payload.get("lng", 18.4108))
    floor_level = payload.get("floor_level", "")
    text_desc = payload.get("description", "")
    title = payload.get("title", "")
    address = payload.get("address", "")
    audit = compute_property_acoustic_audit(lat, lng, floor_level, text_desc, title, address)
    return {"status": "success", "acoustic_audit": audit}

if __name__ == "__main__":
    import uvicorn
    # Local Node usually runs on 8000 to match the frontend expectations
    uvicorn.run(app, host="0.0.0.0", port=8000)"""

text = text.replace('\r\n', '\n')
target = target.replace('\r\n', '\n')
replacement = replacement.replace('\r\n', '\n')

if target in text:
    new_text = text.replace(target, replacement)
    with open('api/main.py', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("SUCCESS: Endpoint positioned before __main__")
else:
    print("Target not found. End of file preview:")
    print(repr(text[-300:]))

