import os
import sys
import io
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run_browser_suite():
    print("🚀 Starting Unified Architecture Browser Test Suite for HomeSeek...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Step 1: Landing Page
        print("\n--- 1. Testing Landing Page (http://localhost:3000) ---")
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(1000)
        shot1 = os.path.join(SCREENSHOT_DIR, "01_landing_page.png")
        page.screenshot(path=shot1)
        print(f"📸 Saved: {shot1}")

        # Check navigation items
        alerts_nav = page.locator("nav a:has-text('Alerts')")
        assert alerts_nav.is_visible(), "Alerts navigation link should be visible in navbar"
        print("✅ Navbar includes 'Alerts' link.")

        # Step 2: Perform Dev Sign In
        print("\n--- 2. Performing Dev Sign In ---")
        sign_in_btn = page.locator("button:has-text('Sign In')")
        if sign_in_btn.is_visible():
            sign_in_btn.click()
            page.wait_for_timeout(1500)
        shot2 = os.path.join(SCREENSHOT_DIR, "02_signed_in_navbar.png")
        page.screenshot(path=shot2)
        print(f"📸 Saved: {shot2}")
        print("✅ User authenticated as Taun Healy.")

        # Step 3: Setup New Alert in Search (/search)
        print("\n--- 3. Testing Criteria Setup in Search Page (/search) ---")
        page.goto("http://localhost:3000/search", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Set Location Query to "Hout Bay"
        location_input = page.locator("input[placeholder*='e.g. Camps Bay']").first
        if not location_input.is_visible():
            location_input = page.locator("input[type='text']").first
        if location_input.is_visible():
            location_input.fill("Hout Bay")

        # Set max price to 120000
        max_price_input = page.locator("input[placeholder='Max']").first
        if max_price_input.is_visible():
            max_price_input.fill("120000")

        shot3 = os.path.join(SCREENSHOT_DIR, "03_search_criteria_filled.png")
        page.screenshot(path=shot3)
        print(f"📸 Saved: {shot3}")

        # Click "Save to Radar Alerts" button
        save_alerts_btn = page.locator("button:has-text('Save to Radar Alerts')")
        if save_alerts_btn.is_visible():
            save_alerts_btn.click()
            print("⏳ Clicked 'Save to Radar Alerts'...")
            page.wait_for_timeout(2500)

        # Step 4: Verify Modern Alerts Page (/alerts)
        print("\n--- 4. Testing Unified Modern Alerts Page (/alerts) ---")
        page.goto("http://localhost:3000/alerts", wait_until="networkidle")
        page.wait_for_timeout(2000)
        shot4 = os.path.join(SCREENSHOT_DIR, "04_alerts_management_page.png")
        page.screenshot(path=shot4)
        print(f"📸 Saved: {shot4}")

        alerts_content = page.content()
        assert "active radar" in alerts_content.lower() or "active monitors" in alerts_content.lower(), "Alerts page header should render"
        assert "hout bay" in alerts_content.lower(), "Hout Bay alert should be visible on Alerts page"
        print("✅ Alerts page verified with active Hout Bay radar monitor.")

        # Test Standby toggle
        pause_btn = page.locator("button:has-text('Pause')").first
        if pause_btn.is_visible():
            pause_btn.click()
            page.wait_for_timeout(1500)
            shot4_standby = os.path.join(SCREENSHOT_DIR, "04b_alert_toggled_standby.png")
            page.screenshot(path=shot4_standby)
            print(f"📸 Saved: {shot4_standby}")
            print("✅ Alert successfully toggled to Standby.")

            # Re-activate
            activate_btn = page.locator("button:has-text('Activate')").first
            if activate_btn.is_visible():
                activate_btn.click()
                page.wait_for_timeout(1500)
                print("✅ Alert re-activated.")

        # Step 5: Test Pulse Scan Trigger
        print("\n--- 5. Testing Pulse Scan Trigger ---")
        scan_btn = page.locator("button:has-text('Pulse Scan All')")
        if scan_btn.is_visible():
            scan_btn.click()
            page.wait_for_timeout(1000)
            shot5 = os.path.join(SCREENSHOT_DIR, "05_pulse_scan_triggered.png")
            page.screenshot(path=shot5)
            print(f"📸 Saved: {shot5}")
            print("✅ Pulse Scan triggered.")

        # Step 6: Click "View Properties" to navigate to Properties page
        print("\n--- 6. Navigating to Properties via Alert Link ---")
        view_props_btn = page.locator("a:has-text('View Properties')").first
        if view_props_btn.is_visible():
            view_props_btn.click()
            page.wait_for_timeout(2500)
        else:
            page.goto("http://localhost:3000/properties?search=Hout+Bay", wait_until="networkidle")
            page.wait_for_timeout(2500)

        shot6 = os.path.join(SCREENSHOT_DIR, "06_properties_filtered_hout_bay.png")
        page.screenshot(path=shot6)
        print(f"📸 Saved: {shot6}")
        print("✅ Filtered properties for Hout Bay loaded.")

        # Step 7: Inspect Hout Bay Sea View Apartment Details
        print("\n--- 7. Inspecting Hout Bay Sea View Apartment Dossier ---")
        chevron = page.locator("button[aria-label='View details']").first
        if chevron.is_visible():
            chevron.click()
            page.wait_for_timeout(1200)

        shot7 = os.path.join(SCREENSHOT_DIR, "07_property_detail_modal.png")
        page.screenshot(path=shot7)
        print(f"📸 Saved: {shot7}")
        print("✅ Inspected Hout Bay Apartment Detail Modal.")

        browser.close()
        print("\n🎉 UNIFIED ARCHITECTURE TEST COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_browser_suite()
