import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def test_select_monthly():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        
        # Click the dropdown button for RentalRates
        await page.click('#RentalRates button.dropdown-toggle')
        await asyncio.sleep(0.5)
        
        # Click Monthly
        await page.evaluate("""() => {
            const labels = Array.from(document.querySelectorAll('#RentalRates label'));
            const monthlyLabel = labels.find(l => l.innerText.includes('Monthly'));
            if (monthlyLabel) {
                const cb = monthlyLabel.querySelector('input');
                if (cb) cb.checked = true;
                monthlyLabel.click();
            }
        }""")
        await asyncio.sleep(0.5)
        
        # Click search or submit
        await page.evaluate("""() => {
            const form = document.querySelector('#SearchForm, form');
            if (form) form.submit();
        }""")
        
        await page.wait_for_load_state("domcontentloaded")
        print("Navigated URL:", page.url)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_select_monthly())
