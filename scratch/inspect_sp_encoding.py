import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_sp_encoding():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(1)
        
        # Look for search JS functions
        js_snippets = await page.evaluate("""() => {
            const keys = Object.keys(window).filter(k => k.toLowerCase().includes('search') || k.toLowerCase().includes('filter') || k.toLowerCase().includes('p24'));
            return keys;
        }""")
        print("Window keys:", js_snippets)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_sp_encoding())
