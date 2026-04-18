import asyncio
import os
import json
import base64
from datetime import datetime
from playwright.async_api import async_playwright
from scraper.engine import SniperEngine

async def run_diagnostic():
    print(f"--- 🩺 Home-Seek Deep Diagnostic Start ({datetime.now().strftime('%H:%M:%S')}) ---")
    
    engine = SniperEngine()
    proxy_url = os.environ.get("HTTP_PROXY")
    if proxy_url:
        print(f"🌍 Detected Proxy ENV: {proxy_url[:20]}... (Formatting...)" )
        proxy_url = engine.format_proxy_url(proxy_url)
        print(f"🌍 Corrected Proxy: {proxy_url[:20]}...")
    else:
        print("🏠 No Proxy detected. Running direct.")

    async with async_playwright() as p:
        # 1. Connectivity Test (IP Check)
        print("📡 Step 1: Connectivity Audit (ipinfo.io)...")
        launch_args = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-setuid-sandbox"]
        }
        
        browser = await p.chromium.launch(**launch_args)
        
        context_args = {
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
        }
        
        if proxy_url:
            import urllib.parse
            parsed = urllib.parse.urlparse(proxy_url)
            context_args["proxy"] = {
                "server": f"{parsed.hostname}:{parsed.port}",
                "username": parsed.username,
                "password": parsed.password
            }

        context = await browser.new_context(**context_args)
        page = await context.new_page()
        
        report = {"timestamp": datetime.now().isoformat()}
        
        try:
            await page.goto("https://ipinfo.io/json", timeout=15000)
            ip_data = await page.evaluate("() => JSON.parse(document.body.innerText)")
            print(f"✅ Connectivity: Success! IP={ip_data.get('ip')} ({ip_data.get('city')}, {ip_data.get('country')})")
            report["ip_audit"] = ip_data
        except Exception as e:
            print(f"❌ Connectivity: FAILED! {e}")
            report["ip_audit"] = {"error": str(e)}

        # 2. Facebook Auth Audit
        print("\n🔐 Step 2: Facebook Session Audit...")
        cookie_path = "cookies.json" if os.path.exists("cookies.json") else ("api/cookies.json" if os.path.exists("api/cookies.json") else None)
        
        if cookie_path:
            with open(cookie_path, "r") as f:
                cookies = json.load(f)
                
                # Sanitize cookies for Playwright
                for cookie in cookies:
                    if cookie.get("sameSite") not in ["Strict", "Lax", "None"]:
                        cookie["sameSite"] = "Lax"
                    if "facebook.com" in cookie.get("domain", ""):
                        if not cookie["domain"].startswith("."):
                            cookie["domain"] = "." + cookie["domain"]

                await context.add_cookies(cookies)
                c_user = next((c['value'] for c in cookies if c['name'] == 'c_user'), 'MISSING')
                print(f"🍪 Cookies: Injected {len(cookies)} cookies (c_user: {c_user})")
        else:
            print("⚠️ Cookies: No cookies.json found!")

        # 3. Facebook Target Audit
        target_url = "https://www.facebook.com/groups/127792434687339/" # Example Group
        print(f"🎯 Step 3: Facebook Reachability ({target_url})...")
        
        try:
            await page.goto(target_url, wait_until="commit", timeout=30000)
            await asyncio.sleep(5) # Wait for JS
            
            final_url = page.url
            title = await page.title()
            content_len = len(await page.content())
            
            print(f"📡 Final URL: {final_url}")
            print(f"📄 Page Title: {title}")
            print(f"📦 Payload Size: {content_len // 1024} KB")
            
            report["fb_audit"] = {
                "final_url": final_url,
                "title": title,
                "size_kb": content_len // 1024
            }
            
            # Security Flags
            flags = {
                "Login Wall": "facebook.com/login" in final_url,
                "Checkpoint": "facebook.com/checkpoint" in final_url,
                "Banned": "restricted" in title.lower() or "temporarily blocked" in title.lower(),
                "Content Found": content_len > 50000
            }
            
            for f, val in flags.items():
                print(f"{'🚩' if val and f != 'Content Found' else '✅'} {f}: {val}")
            report["fb_audit"]["flags"] = flags
            
            # 📸 Crime Scene Photo
            shot_path = "diag_fb_report.png"
            await page.screenshot(path=shot_path)
            print(f"📸 Screenshot saved to {shot_path}")
            
        except Exception as e:
            print(f"❌ Facebook Reachability: FAILED! {e}")
            report["fb_audit"] = {"error": str(e)}

        await browser.close()
        
        # Save JSON Report
        with open("diag_report.json", "w") as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Full report saved to diag_report.json")
        print(f"--- 🩺 Diagnostic Complete ---")

if __name__ == "__main__":
    asyncio.run(run_diagnostic())
