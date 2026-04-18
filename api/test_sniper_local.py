import asyncio
from playwright.async_api import async_playwright
import json
import os

async def run_local_simulation():
    async with async_playwright() as p:
        print("--- 🔥 STARTING LOCAL SNIPER SIMULATION ---")
        
        # 1. Proxy Setup
        proxy_url = "http://sp7ghmyebz:5de_P61s5gdkvKtUNj@gate.decodo.com:10001"
        
        # 2. Launch Browser (Separated Auth Logic)
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox", 
                "--disable-setuid-sandbox", 
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process"
            ],
            proxy={
                "server": "gate.decodo.com:10001",
                "username": "sp7ghmyebz",
                "password": "5de_P61s5gdkvKtUNj"
            }
        )
        
        # 3. Create Context (Safari Stealth Mode)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=2,
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        )
        
        # 4. Inject Cookies (Using Absolute Path + Sanitizer)
        cookie_path = os.path.join(os.getcwd(), 'cookies.json')
        try:
            with open(cookie_path, 'r') as f:
                cookies = json.load(f)
                # Cleanup SameSite for Playwright
                for cookie in cookies:
                    if cookie.get("sameSite") == "no_restriction":
                        cookie["sameSite"] = "None"
                    if cookie.get("sameSite") not in ["Strict", "Lax", "None"]:
                        cookie["sameSite"] = "Lax"
                
                await context.add_cookies(cookies)
                print(f"🍪 Injected {len(cookies)} sanitized session cookies.")
        except Exception as ce:
            print(f"⚠️ Cookie Injection Failed: {ce}")

        page = await context.new_page()
        page.on("console", lambda msg: print(f"[CONSOLE] {msg.text}"))
        
        url = "https://www.facebook.com/groups/127792434687339/"
        print(f"📡 Navigating to {url}...")
        
        try:
            # Commit Architecture
            await page.goto(url, wait_until="commit", timeout=60000)
            print("✅ Commit reached.")
            
            # Security Snapshot
            await asyncio.sleep(5) # Give it a second to settle
            if "login" in page.url or "checkpoint" in page.url:
                print(f"🚩 SECURITY REDIRECTION: {page.url}")
            else:
                print(f"✅ SESSION ACTIVE: {page.url}")
            
            # Hydration Guard
            print("🕰️ Waiting for Hydration (looking for listings)...")
            try:
                await page.wait_for_selector('[role="article"], article', timeout=45000)
                print("✨ DATA HYDRATED: Listings detected!")
            except:
                print("❌ HYDRATION FAILED: No listings found within 45s.")
            
            # Pulse Check
            content = await page.content()
            data_kb = len(content)//1024
            print(f"💓 PULSE: Captured {data_kb} KB of HTML data.")
            
            # Forensic Preview
            if "Gordon's Bay" in content:
                print("🎯 VERIFIED: 'Gordon's Bay' text found in the browser stream!")
            else:
                print("🔍 MISSING: 'Gordon's Bay' not found in content snippet.")
                print("--- START OF HTML ---")
                print(content[:500])

        except Exception as e:
            print(f"🚨 SIMULATION FAILED: {e}")
        
        await browser.close()
        print("--- 🏁 SIMULATION COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(run_local_simulation())
