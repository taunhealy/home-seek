
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        print("Navigating to RentUncle...")
        await page.goto('https://www.rentuncle.co.za/flats-for-rent/wc/cape-town/sea-point/', wait_until="domcontentloaded")
        
        # Get all div classes
        classes = await page.evaluate("""() => {
            const divs = Array.from(document.querySelectorAll('div'));
            return divs.map(d => d.className).filter(c => c && c.length > 0);
        }""")
        
        print("\nFound classes:")
        unique_classes = sorted(list(set(classes)))
        for c in unique_classes:
            if 'box' in c or 'card' in c or 'listing' in c:
                print(f"  - {c}")
                
        # Check parent of thumb_box
        if await page.locator('.thumb_box').count() > 0:
            # List many links
            print("\nListing first 200 links:")
            all_links = await page.evaluate("""() => {
                const as = Array.from(document.querySelectorAll('a'));
                return as.map(a => ({
                    href: a.getAttribute('href'),
                    text: a.innerText.trim().slice(0, 30)
                })).filter(l => l.href);
            }""")
            for l in all_links[:200]:
                if l['href'] and 'javascript' not in l['href']:
                    print(f"  Href: {l['href']}, Text: {repr(l['text'])}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
