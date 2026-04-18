import asyncio
from playwright.async_api import async_playwright
import json
import os
from datetime import datetime

async def debug_facebook_session():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] DEBUG: Starting Session Diagnostic...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        
        # Load cookies
        cookie_path = "cookies.json" if os.path.exists("cookies.json") else ("api/cookies.json" if os.path.exists("api/cookies.json") else None)
        if cookie_path:
            with open(cookie_path, "r") as f:
                cookies = json.load(f)
                for cookie in cookies:
                    if "facebook.com" in cookie.get("domain", ""):
                        if not cookie["domain"].startswith("."):
                            cookie["domain"] = "." + cookie["domain"]
                        if cookie.get("sameSite") == "no_restriction":
                            cookie["sameSite"] = "None"
                    if cookie.get("sameSite") not in ["Strict", "Lax", "None"]:
                        cookie["sameSite"] = "Lax"
                await context.add_cookies(cookies)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Injected {len(cookies)} cookies with aggressive masking...")
        else:
            print("No cookies.json found!")
            return

        page = await context.new_page()
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Navigating to Facebook Group...")
        
        try:
            # Navigate to the group
            await page.goto("https://www.facebook.com/groups/127792434687339/", wait_until="domcontentloaded", timeout=45000)
            await asyncio.sleep(5) # Wait for redirects
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Current URL: {page.url}")
            
            # Check for Login Wall
            if "facebook.com/login" in page.url or "facebook.com/checkpoint" in page.url:
                print("LOGIN WALL DETECTED: Facebook rejected the session.")
            else:
                # Check for c_user
                all_cookies = await context.cookies()
                c_user = next((c for c in all_cookies if c['name'] == 'c_user'), None)
                if c_user:
                    print(f"SESSION ACTIVE: Logged in as UID {c_user['value']}")
                    # Take a screenshot to prove it
                    await page.screenshot(path="fb_session_debug.png")
                    print("Screenshot saved as fb_session_debug.png")
                else:
                    print("GHOST SESSION: No c_user found, but not at login wall.")
                    await page.screenshot(path="fb_session_debug.png")
                    
        except Exception as e:
            print(f"Error during debug: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_facebook_session())
