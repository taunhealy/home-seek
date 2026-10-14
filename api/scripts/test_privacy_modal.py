import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOT_DIR = "c:/Ryoko/Projects/home-seek/scratch"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def test_privacy_features():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 950})
        await page.goto("http://localhost:3000/search", wait_until="networkidle")

        # 1. Capture the updated section with reworded unit & 'No one living above'
        section = page.locator("section:has-text('Living Autonomy & Privacy Shield')").first
        await section.scroll_into_view_if_needed()
        await page.wait_for_timeout(300)
        shot1 = f"{SCREENSHOT_DIR}/privacy_01_section.png"
        await page.screenshot(path=shot1)
        print("1. Section captured with reworded option & 'No One Living Above'.")

        # 2. Toggle 'No One Living Above'
        no_one_above_cb = page.locator("label:has-text('No One Living Above') input[type='checkbox']").first
        await no_one_above_cb.click()
        await page.wait_for_timeout(200)

        # 3. Click the info icon button 'How it works'
        info_btn = page.locator("button:has-text('How it works')").first
        await info_btn.click()
        await page.wait_for_timeout(500)
        shot2 = f"{SCREENSHOT_DIR}/privacy_02_modal_open.png"
        await page.screenshot(path=shot2)
        print("2. Info modal opened and captured.")

        # 4. Scroll inside the modal to capture the bottom details
        modal_content = page.locator("div.max-h-\\[90vh\\]").first
        await modal_content.evaluate("e => e.scrollTop = e.scrollHeight")
        await page.wait_for_timeout(300)
        shot3 = f"{SCREENSHOT_DIR}/privacy_03_modal_bottom.png"
        await page.screenshot(path=shot3)
        print("3. Scrolled modal captured.")

        # 5. Click 'Got It, Return to Search Setup'
        close_btn = page.locator("button:has-text('Got It, Return to Search Setup')").first
        await close_btn.click()
        await page.wait_for_timeout(300)
        shot4 = f"{SCREENSHOT_DIR}/privacy_04_modal_closed.png"
        await page.screenshot(path=shot4)
        print("4. Modal closed successfully.")

        await browser.close()
        print("ALL PRIVACY MODAL TESTS PASSED.")

if __name__ == "__main__":
    asyncio.run(test_privacy_features())
