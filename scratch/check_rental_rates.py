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
            const el = document.querySelector('#RentalRates, [name="RentalRates"], [data-field="RentalRates"]');
            const parent = el ? el.closest('div') : null;
            const options = el ? Array.from(el.querySelectorAll('option, li, div')).map(o => ({
                text: o.innerText?.trim(),
                value: o.value || o.getAttribute('data-value'),
                html: o.outerHTML.slice(0, 100)
            })) : [];
            return {
                found: !!el,
                outer: el ? el.outerHTML.slice(0, 500) : null,
                parentOuter: parent ? parent.outerHTML.slice(0, 500) : null,
                options
            };
        }""")
        print("RentalRates Element:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_rental_rates())
