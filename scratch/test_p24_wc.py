import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))

from scraper.engine import SniperEngine
from scraper.portal_parser import parse_p24_card, extract_lease_term

async def test():
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true"
    
    engine = SniperEngine()
    # Test Western Cape URL
    url = "https://www.property24.com/to-rent/western-cape/9"
    print(f"Scraping {url} with stealth and jitter...")
    res = await engine.scrape_url(url, search_area="Western Cape", max_pages=1)
    print(f"Result count: {len(res.listings) if res and res.listings else 0}")
    if res and res.listings:
        for i, l in enumerate(res.listings[:5]):
            print(f"[{i+1}] {l.title} | R{l.price} | {l.address} | Type: {l.rental_type} | Lease: {l.lease_period}")

if __name__ == "__main__":
    asyncio.run(test())
