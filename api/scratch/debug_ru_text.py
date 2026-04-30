
import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd()))

from scraper.engine import SniperEngine

async def debug_ru_text():
    engine = SniperEngine()
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true"
    
    url = "https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/sea-point/"
    print(f"Scraping {url}...")
    
    if not engine.p_context: await engine.start()
    page = await engine.p_context.new_page()
    await page.goto(url, wait_until="domcontentloaded")
    
    text = await page.evaluate("document.body.innerText")
    print(f"\nBODY TEXT LENGTH: {len(text)}")
    print(f"PREVIEW: {text[:1000]}")
    
    # Check for specific RentUncle listing text
    if "Sea Point" in text:
        print("SUCCESS: Found 'Sea Point' in page text.")
    else:
        print("FAILURE: 'Sea Point' not found in page text. Maybe blocked or wrong URL.")

if __name__ == "__main__":
    asyncio.run(debug_ru_text())
