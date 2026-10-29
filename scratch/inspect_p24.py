import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_page():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        info = await page.evaluate("""() => {
            const allLinks = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('/to-rent/'));
            const tiles = document.querySelectorAll('.p24_content, .p24_regularTile, .p24_tileContainer, .js_resultTile, [data-listing-number]');
            const classCounts = {};
            document.querySelectorAll('div').forEach(d => {
                if (d.className && typeof d.className === 'string') {
                    d.className.split(' ').forEach(c => {
                        if (c.startsWith('p24_') || c.includes('Tile') || c.includes('result')) {
                            classCounts[c] = (classCounts[c] || 0) + 1;
                        }
                    });
                }
            });
            return {
                title: document.title,
                listingLinksCount: allLinks.length,
                sampleLinks: allLinks.slice(0, 5),
                tileCount: tiles.length,
                classCounts: classCounts
            };
        }""")
        print("Page Info:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_page())
