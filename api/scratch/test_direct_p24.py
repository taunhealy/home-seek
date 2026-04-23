import asyncio
import os
from scraper.engine import SniperEngine
from models.listing import ExtractionResult

async def test_direct_url():
    # Set environment variables for local testing
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true"
    
    engine = SniperEngine()
    url = "https://www.property24.com/to-rent/muizenberg/cape-town/western-cape/9025/117026249"
    
    print(f"Testing direct URL: {url}")
    result = await engine.scrape_url(url)
    
    if result:
        print(f"Success! Found {len(result.listings)} listings.")
        for i, l in enumerate(result.listings):
            print(f"Listing {i+1}: {l.title} - {l.price}")
    else:
        print("Failed to extract any data.")

if __name__ == "__main__":
    asyncio.run(test_direct_url())
