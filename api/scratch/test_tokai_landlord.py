import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright

async def inspect_tokai():
    url = "https://www.property24.com/to-rent/tokai/cape-town/western-cape/9044/116755560?plId=2623951&plt=3&plsIds=2630765"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        
        # Check lease period
        overview_text = await page.evaluate('''() => {
            const rows = Array.from(document.querySelectorAll('.p24_propertyOverviewRow, tr, div'));
            const lease = rows.find(r => r.innerText && r.innerText.includes('Lease Period'));
            const isLandlord = document.body.innerText.includes('WhatsApp Landlord') || document.body.innerText.includes('Contact Landlord');
            return {
                lease_text: lease ? lease.innerText.trim() : 'Not found',
                is_landlord: isLandlord
            };
        }''')
        print("Inspection Results:", overview_text)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_tokai())
