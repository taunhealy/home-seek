
import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd()))

from scraper.engine import SniperEngine

async def debug_ru():
    engine = SniperEngine()
    os.environ["LOCAL_SNIPER"] = "true"
    os.environ["HEADLESS"] = "true"
    
    url = "https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/sea-point/"
    print(f"Scraping {url}...")
    
    # Use a custom engine instance with a task_id to trigger internal screenshots or just do it here
    result = await engine.scrape_url(url)
    
    # Capture final state for debugging
    if engine.p_context:
        pages = engine.p_context.pages
        if pages:
            p = pages[-1]
            await p.screenshot(path="ru_debug.png")
            print("Saved debug screenshot to ru_debug.png")
            
            # Inspect elements
            info = await p.evaluate("""() => {
                const ads = document.querySelectorAll('.ad_box');
                if (ads.length === 0) return "No .ad_box found";
                return {
                    count: ads.length,
                    first_text: ads[0].innerText.slice(0, 100),
                    first_html: ads[0].innerHTML.slice(0, 200)
                };
            }""")
            print(f"Inspection Info: {info}")

if __name__ == "__main__":
    asyncio.run(debug_ru())
