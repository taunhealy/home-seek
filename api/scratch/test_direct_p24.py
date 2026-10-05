import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from scraper.engine import SniperEngine

async def test_p24_fast_track():
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true"
    
    engine = SniperEngine()
    url = "https://www.property24.com/to-rent/fish-hoek/western-cape/475?sp=s%3d1"
    
    print(f"\n[TEST] Running SniperEngine on Fish Hoek: {url}")
    result = await engine.scrape_url(url, search_area="Fish Hoek")
    
    if result and result.listings:
        print(f"\n[SUCCESS] Extracted {len(result.listings)} listings with 0 Gemini tokens!")
        for i, l in enumerate(result.listings[:5]):
            print(f"\nListing #{i+1}:")
            print(f"  Title:        {l.title}")
            print(f"  Price:        R {l.price:,}")
            print(f"  Area:         {l.address}")
            print(f"  Rental Type:  {l.rental_type} (Lease: {l.lease_period})")
            print(f"  Landlord:     {l.is_direct_landlord}")
            print(f"  Platform:     {l.platform}")
            print(f"  Link:         {l.source_url}")
    else:
        print("[FAIL] No listings extracted.")

if __name__ == "__main__":
    asyncio.run(test_p24_fast_track())
