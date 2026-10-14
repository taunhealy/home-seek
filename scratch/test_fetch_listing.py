import asyncio
import re
import json
from playwright.async_api import async_playwright

URL = "https://www.property24.com/to-rent/hout-bay-central/hout-bay/western-cape/16694/111058260?vn=True"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()
        print(f"Navigating to {URL}...")
        try:
            resp = await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
            print(f"Status: {resp.status if resp else 'No resp'}")
            await page.wait_for_timeout(3000)
            
            title = await page.title()
            print(f"Page Title: {title}")
            
            # Extract basic fields
            content = await page.content()
            print(f"Content length: {len(content)} bytes")
            
            # Save snippet or extract structured details
            with open("scratch/hout_bay_page.html", "w", encoding="utf-8") as f:
                f.write(content)
            print("Saved HTML to scratch/hout_bay_page.html")
            
        except Exception as e:
            print(f"Fetch error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
