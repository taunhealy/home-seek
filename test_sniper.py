import asyncio
import os
from dotenv import load_dotenv
import sys

# Add api directory to path so we can import modules
sys.path.append(os.path.join(os.getcwd(), 'api'))

from scraper.engine import SniperEngine

async def test_live_sniper():
    load_dotenv()
    
    print("[START] Starting Live Sniper Test...")
    print(f"Connection: {os.getenv('BROWSERLESS_URL')}")
    
    engine = SniperEngine()
    
    # You can change this to a real listing URL to test it!
    test_url = "https://www.property24.com/to-rent/claremont/cape-town/western-cape/9143"
    
    try:
        print(f"[PROCESS] Scraping {test_url} via Browserless...")
        result = await engine.scrape_url(test_url)
        
        print(f"[SUCCESS] Found {len(result.listings)} listings!")
        
        for i, listing in enumerate(result.listings[:3]):
            print(f"\n--- Result {i+1} ---")
            print(f"Title: {listing.title}")
            print(f"Price: R {listing.price:,}")
            print(f"Area: {listing.address}")
            print(f"Source: {listing.platform}")
            
    except Exception as e:
        print(f"[ERROR] Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_live_sniper())
