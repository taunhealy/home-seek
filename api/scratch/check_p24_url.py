import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page()
        for url in [
            'https://www.property24.com/to-rent/south-peninsula/western-cape/474?sp=s%3d1',
            'https://www.property24.com/to-rent/fish-hoek/western-cape/475?sp=s%3d1',
            'https://www.property24.com/to-rent/constantia/cape-town/western-cape/9144?sp=s%3d1'
        ]:
            await page.goto(url, wait_until='domcontentloaded')
            title = await page.title()
            tiles = await page.query_selector_all('.p24_regularTile, .p24_promotedTile, .p24_featuredTile, .p24_tile')
            print(f"URL: {url} -> Title: {title} | Tiles: {len(tiles)}")
        await b.close()

if __name__ == '__main__':
    asyncio.run(run())
