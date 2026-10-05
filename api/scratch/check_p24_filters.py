import asyncio
import json
from playwright.async_api import async_playwright

async def check_filters():
    url = "https://www.property24.com/to-rent/tokai/cape-town/western-cape/9044"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        
        # Check all form inputs, filters, dropdowns, and URLs
        data = await page.evaluate("""() => {
            const allElements = document.querySelectorAll('input, select, .dropdown, [data-filter], a');
            const results = [];
            allElements.forEach(el => {
                const text = el.innerText || el.textContent || '';
                const name = el.getAttribute('name') || '';
                const id = el.id || '';
                const href = el.getAttribute('href') || '';
                const str = (text + ' ' + name + ' ' + id + ' ' + href).toLowerCase();
                if (str.includes('landlord') || str.includes('private') || str.includes('agent')) {
                    results.push({ tag: el.tagName, id, name, text: text.trim().slice(0, 80), href });
                }
            });
            return results;
        }""")
        
        print("Matches found in search interface:")
        for item in data[:15]:
            print(item)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check_filters())
