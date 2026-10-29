import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_rental_term_filter():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        info = await page.evaluate("""() => {
            const results = [];
            // Find all elements mentioning Monthly, Weekly, Daily or Rental Term
            document.querySelectorAll('*').forEach(el => {
                if (el.children.length === 0 && (el.innerText === 'Monthly' || el.innerText === 'Weekly' || el.innerText === 'Daily' || el.innerText === 'Rental Term')) {
                    const parent = el.closest('div, li, label, select');
                    const input = parent ? parent.querySelector('input, option') : null;
                    results.push({
                        text: el.innerText,
                        parentHTML: parent ? parent.outerHTML.slice(0, 200) : '',
                        inputVal: input ? (input.value || input.getAttribute('data-value')) : null,
                        inputName: input ? input.name : null,
                        inputId: input ? input.id : null
                    });
                }
            });
            return results;
        }""")
        print("Rental Term Info:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_rental_term_filter())
