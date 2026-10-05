import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page()
        await page.goto('https://www.property24.com/to-rent/tokai/cape-town/western-cape/9044', wait_until='domcontentloaded')
        cards = await page.evaluate('''() => {
            const tiles = document.querySelectorAll('.p24_regularTile, .p24_promotedTile, .p24_featuredTile');
            return Array.from(tiles).slice(0, 5).map(t => {
                const priceStr = t.querySelector('.p24_price')?.innerText?.trim() || '';
                const titleStr = t.querySelector('.p24_title')?.innerText?.trim() || '';
                const locationStr = t.querySelector('.p24_location')?.innerText?.trim() || '';
                const addressStr = t.querySelector('.p24_address')?.innerText?.trim() || '';
                const excerptStr = t.querySelector('.p24_excerpt')?.innerText?.trim() || '';
                const link = t.querySelector('a[href*="/to-rent/"]')?.getAttribute('href') || '';
                const isLandlord = t.querySelector('img[src*="listed_by_owner"]') !== null || link.includes('plt=3') || t.innerText.includes('Landlord');
                const fullText = t.innerText;
                return { priceStr, titleStr, locationStr, addressStr, excerptStr, link, isLandlord, fullText };
            });
        }''')
        print(json.dumps(cards, indent=2))
        await b.close()

if __name__ == '__main__':
    asyncio.run(main())
