import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_more_filters():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        # Click on More Filters button or inspect filter HTML
        modal_html = await page.evaluate("""() => {
            const filterModal = document.querySelector('.p24_filterModal, #FilterModal, [id*="Filter"], [class*="filter"]');
            const allLabels = Array.from(document.querySelectorAll('label, .p24_labeledField, .p24_checkboxGroup')).map(el => el.innerText.trim());
            return {
                filterLabels: allLabels.filter(t => t.length > 0 && t.length < 50)
            };
        }""")
        print("Filter Labels found:", modal_html["filterLabels"])
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_more_filters())
