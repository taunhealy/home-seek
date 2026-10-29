import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_filters():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        filters = await page.evaluate("""() => {
            const form = document.querySelector('form');
            const inputs = Array.from(document.querySelectorAll('input, select')).map(el => ({
                tag: el.tagName,
                name: el.name || el.id,
                type: el.type,
                value: el.value
            })).filter(x => x.name);
            
            // Check dropdown options for property types or lease terms
            const dropdowns = Array.from(document.querySelectorAll('.p24_advancedDropdown, .p24_customValueDropdown, select')).map(d => ({
                text: d.innerText?.slice(0, 100),
                name: d.getAttribute('data-field') || d.name || d.id
            }));

            // Check if there are any short term links or keywords
            const shortTermLinks = Array.from(document.querySelectorAll('a')).filter(a => 
                (a.innerText && /short|month|term|holiday/i.test(a.innerText)) || 
                (a.href && /short|month|term|holiday/i.test(a.href))
            ).map(a => ({ text: a.innerText, href: a.href }));

            return { inputs: inputs.slice(0, 20), dropdowns: dropdowns.slice(0, 15), shortTermLinks };
        }""")
        print("Filters:", filters)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_filters())
