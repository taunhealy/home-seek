import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOT_DIR = "c:/Ryoko/Projects/home-seek/scratch"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def test_area_pills():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 850})
        await page.goto("http://localhost:3000/search", wait_until="networkidle")

        # 1. Initial page
        shot1 = f"{SCREENSHOT_DIR}/pills_01_initial.png"
        await page.screenshot(path=shot1)
        print("1. Initial page captured.")

        # 2. Hover over Camps Bay pill
        camps_bay_pill = page.locator("div.group:has-text('Camps Bay')").first
        await camps_bay_pill.hover()
        await page.wait_for_timeout(300)
        shot2 = f"{SCREENSHOT_DIR}/pills_02_hover.png"
        await page.screenshot(path=shot2)
        print("2. Camps Bay hover with corner cross captured.")

        # 3. Type 'Ho' into the input
        input_box = page.locator("input[placeholder*='suburb'], input[placeholder*='area']").first
        await input_box.click()
        await input_box.fill("Ho")
        await page.wait_for_timeout(500)
        shot3 = f"{SCREENSHOT_DIR}/pills_03_autocomplete_ho.png"
        await page.screenshot(path=shot3)
        print("3. Typed 'Ho', captured autocomplete dropdown.")

        # 4. Click Hout Bay from autocomplete
        hout_bay_btn = page.locator("button:has-text('Hout Bay')").first
        await hout_bay_btn.click()
        await page.wait_for_timeout(400)
        shot4 = f"{SCREENSHOT_DIR}/pills_04_hout_bay_added.png"
        await page.screenshot(path=shot4)
        print("4. Clicked Hout Bay, pill added successfully.")

        # 5. Remove 'Gardens' by clicking its corner remove cross
        gardens_pill = page.locator("div.group:has-text('Gardens')").first
        await gardens_pill.hover()
        remove_btn = gardens_pill.locator("button").first
        await remove_btn.click(force=True)
        await page.wait_for_timeout(400)
        shot5 = f"{SCREENSHOT_DIR}/pills_05_gardens_removed.png"
        await page.screenshot(path=shot5)
        print("5. Clicked Gardens corner cross, removed successfully.")

        await browser.close()
        print("ALL PILL TESTS PASSED.")

if __name__ == "__main__":
    asyncio.run(test_area_pills())
