import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright
import json

async def print_filter_model():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        raw_script = await page.evaluate("""() => {
            const s = Array.from(document.querySelectorAll('script')).find(s => s.innerText.includes('saveAlertCriteriaModel'));
            return s ? s.innerText : '';
        }""")
        
        try:
            data = json.loads(raw_script.strip())
            print("Keys:", list(data.keys()))
            for k in data.keys():
                if "rental" in k.lower() or "rate" in k.lower() or "term" in k.lower() or "criteria" in k.lower():
                    print(f"\n[{k}]:", json.dumps(data[k], indent=2))
        except Exception as e:
            print("Error parsing json:", e)
            print("Snippet:", raw_script[:500])
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(print_filter_model())
