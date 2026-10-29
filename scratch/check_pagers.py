import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from playwright.async_api import async_playwright

async def inspect_pagers():
    async with async_playwright() as p:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()
        
        url = "https://www.property24.com/apartments-to-rent/western-cape/9"
        await page.goto(url, wait_until="domcontentloaded")
        
        pagers = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('.p24_pager')).map(p => ({
                parentClass: p.parentElement.className,
                links: Array.from(p.querySelectorAll('a')).map(a => ({
                    text: a.innerText.trim(),
                    href: a.getAttribute('href')
                }))
            }));
        }""")
        print("Pagers:", pagers)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_pagers())
