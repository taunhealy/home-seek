import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright
from scraper.portal_parser import parse_p24_card

async def debug_tiles():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        raw_tiles = await page.evaluate("""() => {
            const tiles = Array.from(document.querySelectorAll('.p24_tileContainer, .p24_regularTile, .p24_proTile, .js_resultTile'));
            return tiles.map((t, idx) => {
                const listingNum = t.getAttribute('data-listing-number') || t.closest('[data-listing-number]')?.getAttribute('data-listing-number');
                const linkEl = t.querySelector('a[href*="/to-rent/"]');
                let link = linkEl?.getAttribute('href') || '';
                if (link && link.startsWith('/')) link = 'https://www.property24.com' + link;

                const priceEl = t.querySelector('.p24_price');
                let priceStr = '';
                if (priceEl) {
                    const clone = priceEl.cloneNode(true);
                    while (clone.firstElementChild) {
                        clone.firstElementChild.remove();
                    }
                    priceStr = clone.textContent?.trim() || '';
                }

                const titleStr = t.querySelector('.p24_title')?.innerText?.trim()
                                 || t.querySelector('.p24_description')?.innerText?.trim()
                                 || t.querySelector('meta[itemprop="name"]')?.getAttribute('content')
                                 || t.querySelector('[title*="rent"], [title*="Rent"]')?.getAttribute('title')
                                 || t.getAttribute('title')
                                 || t.querySelector('.p24_proTile')?.getAttribute('title')
                                 || '';

                return {
                    idx,
                    className: t.className,
                    listingNum,
                    link,
                    priceStr,
                    titleStr,
                    fullTextSnippet: t.innerText ? t.innerText.slice(0, 100).replace(/\\n/g, ' ') : ''
                };
            });
        }""")
        
        print(f"Total raw tiles captured: {len(raw_tiles)}")
        for t in raw_tiles[:10]:
            print(f"Tile {t['idx']}: class={t['className'][:30]} num={t['listingNum']} price={t['priceStr']} title={t['titleStr'][:40]} link={t['link']}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_tiles())
