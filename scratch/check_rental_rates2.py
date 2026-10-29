import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_rental_rates():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        info = await page.evaluate("""() => {
            const label = document.querySelector('label[for="RentalRates"]');
            return {
                labelHTML: label ? label.outerHTML : null,
                parentHTML: label ? label.parentElement.outerHTML : null
            };
        }""")
        print("Label parent HTML:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_rental_rates())
