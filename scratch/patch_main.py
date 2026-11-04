with open('api/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '@app.post("/deploy-sniper")'
new_code = '''class LiveSearchRequest(BaseModel):
    suburbs: List[str]
    min_price: Optional[int] = 0
    max_price: Optional[int] = 999999
    bedrooms: Optional[str] = "1+"
    anchor_lat: Optional[float] = None
    anchor_lng: Optional[float] = None

@app.post("/api/search/live-scrape")
async def live_scrape_search(req: LiveSearchRequest):
    """Live scraper that searches Property24 on-demand for target suburbs and price filters."""
    from services.live_search import scrape_p24_live
    try:
        results = scrape_p24_live(
            suburbs=req.suburbs,
            min_price=req.min_price or 0,
            max_price=req.max_price or 999999,
            beds=req.bedrooms or "1+",
            anchor_lat=req.anchor_lat,
            anchor_lng=req.anchor_lng
        )
        return {
            "status": "success",
            "count": len(results),
            "listings": results
        }
    except Exception as err:
        return {
            "status": "error",
            "message": str(err),
            "count": 0,
            "listings": []
        }

@app.post("/deploy-sniper")'''

if target in content:
    content = content.replace(target, new_code, 1)
    with open('api/main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Endpoint added to api/main.py!")
else:
    print("Target not found!")

