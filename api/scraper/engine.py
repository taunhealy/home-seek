import asyncio
from playwright.async_api import async_playwright
import os
import json
from datetime import datetime
from typing import Optional
from intelligence.extractor import GeminiExtractor
from schemas import ExtractionResult
# from database import update_task # Moving to local scopes to avoid circular imports

try:
    from crawl4ai import AsyncWebCrawler
    CRAWL_AVAILABLE = True
except ImportError:
    CRAWL_AVAILABLE = False

class SniperEngine:
    def __init__(self):
        self.extractor = GeminiExtractor()
        self.browserless_url = os.getenv("BROWSERLESS_URL") # e.g. wss://chrome.browserless.io?token=YOUR-TOKEN

    async def scrape_url(self, url: str, use_cookies: bool = True, task_id: Optional[str] = None, search_query: Optional[str] = None) -> ExtractionResult:
        """The 'Sniper' extraction stage - now enhanced with Hybrid (Crawl4AI) support."""
        from database import update_task
        
        # 🟢 HYBRID MODE: If we have Crawl4AI and it's a deep-link, use the specialized Sniper
        is_deep_link = "/to-rent/" in url and len(url.split("/")) > 4
        if CRAWL_AVAILABLE and is_deep_link:
            if task_id:
                update_task(task_id, "Extraction", "🕷️ Deploying Crawl4AI Sniper for precision extraction...")
            
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(
                    url=url,
                    bypass_cache=True,
                    magic=True, # Handles bot-bypass and JS rendering
                    wait_for="css:.p24_results, .p24_listings, #search-results"
                )
                
                if result.success:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Crawl4AI Success! (Size: {len(result.markdown)} chars)")
                    # Hand over the clean markdown to Gemini for structured extraction
                    final_result = await self.extractor.extract(result.markdown, ExtractionResult)
                    return final_result
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Crawl4AI Fallback: Error {result.error_message}")
        
        # 🟡 FALLBACK: Standard Playwright Sniper (still includes our Docker stability flags)
        if task_id:
            update_task(task_id, "Initializing", "🛠️ Initializing secure browser context...")

        async with async_playwright() as p:
            # Use Browserless if available, otherwise fallback to local chromium
            if self.browserless_url:
                # Add stealth and headful flags if using browserless
                connection_url = self.browserless_url
                if "&stealth" not in connection_url:
                    connection_url += "&stealth&--disable-features=IsolateOrigins,site-per-process"
                
                if task_id:
                    update_task(task_id, "Connecting", "🌐 Connecting to remote extraction cluster...")
                browser = await p.chromium.connect_over_cdp(connection_url)
            else:
                browser = await p.chromium.launch(headless=True)
            
            # Create a more realistic browser context
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={'width': 1920, 'height': 1080},
                extra_http_headers={"Accept-Language": "en-US,en;q=0.9"}
            )

            # Load cookies if they exist
            if use_cookies and os.path.exists("cookies.json"):
                if task_id:
                    update_task(task_id, "Auth", "🍪 Injecting session credentials...")
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Injecting session cookies...")
                with open("cookies.json", "r") as f:
                    cookies = json.load(f)
                    # Sanitize sameSite values for Playwright compatibility
                    for cookie in cookies:
                        if cookie.get("sameSite") not in ["Strict", "Lax", "None"]:
                            cookie["sameSite"] = "Lax"
                    await context.add_cookies(cookies)

            page = await context.new_page()
            
            if task_id:
                update_task(task_id, "Navigating", f"📡 Navigating to {url}...")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Navigating to {url}...")
            await page.goto(url, wait_until="networkidle", timeout=60000)

            # --- DYNAMIC PORTAL SEARCH ---
            is_results_page = "/to-rent/" in url and len(url.split("/")) > 4
            
            if not is_results_page and search_query and ("property24.com" in url or "gumtree.co.za" in url):
                if task_id:
                    update_task(task_id, "Searching", f"⌨️ Inputting search term: '{search_query}'...")
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Portal detected. Typing search: {search_query}")
                
                try:
                    if "property24.com" in url:
                        # Handle potential cookie banner
                        try:
                            cookie_close = page.locator(".p24_cookieNotice .close, button:has-text('Close')").first
                            if await cookie_close.is_visible(timeout=2000):
                                await cookie_close.click()
                        except: pass

                        # Targets the specific Property24 AutoComplete search bar
                        search_input = page.locator("#token-input-AutoCompleteItems, input[placeholder*='suburb' i]").first
                        await search_input.wait_for(state="visible", timeout=10000)
                        
                        # Clear and Type
                        await search_input.click()
                        await page.keyboard.press("Control+A")
                        await page.keyboard.press("Backspace")
                        await search_input.fill(search_query)
                        
                        # Wait for suggestions dropdown and select the first one
                        try:
                            # Wait for the autocomplete dropdown to appear
                            await page.wait_for_selector(".ui-autocomplete", timeout=5000)
                            # Click the first suggestion item specifically
                            await page.click(".ui-autocomplete li.ui-menu-item:first-child, .ui-autocomplete li:first-child")
                            await asyncio.sleep(1)
                        except:
                            # Fallback if dropdown doesn't appear
                            await page.keyboard.press("ArrowDown")
                            await page.keyboard.press("Enter")
                        
                        # Explicitly click the SEARCH button
                        search_btn = page.locator("button.btn-danger, button:has-text('Search'), .p24_searchButton").first
                        await search_btn.click()
                        
                        # Wait for the results page to load (look for suburb in URL)
                        try:
                            await page.wait_for_url(lambda u: "/to-rent/" in u and len(u.split("/")) > 4, timeout=10000)
                        except:
                            # If we didn't redirect, take a screenshot to see why (SAFETY FIRST)
                            try:
                                if not page.is_closed():
                                    os.makedirs("debug", exist_ok=True)
                                    await page.screenshot(path=f"debug/failed_search_{task_id}.png")
                                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Redirect failed. Screenshot saved.")
                            except: pass
                    elif "gumtree.co.za" in url:
                        # Gumtree search bar
                        search_input = page.locator("input[placeholder*='looking for' i], #search-query").first
                        await search_input.wait_for(state="visible", timeout=10000)
                        await search_input.fill(search_query)
                        await page.keyboard.press("Enter")
                    
                    # Wait for results page with a longer timeout
                    await page.wait_for_load_state("networkidle", timeout=30000)
                    await asyncio.sleep(2) # Extra buffer for redirection
                    if task_id:
                        update_task(task_id, "Scanning", "🎯 Arrived at results page. Scanning...")
                except Exception as e:
                    print(f"Portal Search Interaction Failed: {str(e)}")
                    # Fallback to current page context if search interaction fails
            
            # Universal Scroll (Property24, FB, Gumtree all use lazy-loaded images/content)
            if task_id:
                update_task(task_id, "Scanning", "🖱️ Deep scanning page for matches...")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Scrolling to ensure content is fully loaded...")
            for i in range(4): # Scroll 4 times to uncover deep content
                await page.evaluate("i => window.scrollTo(0, document.body.scrollHeight * 0.25 * (i+1))", i)
                await asyncio.sleep(1.5)
            
            if task_id:
                update_task(task_id, "Parsing", "🧠 Intelligence Engine processing raw data...")
            
            # Focus on the main content area to avoid sidebar/header noise
            body_text = await page.evaluate("""() => {
                // Try several common listing container classes for Property24/Gumtree
                const main = document.querySelector('.p24_results, .p24_listings, #search-results, .results, [class*="results"]') || document.body;
                return main.innerText;
            }""")
            current_url = page.url
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Final Search URL: {current_url}")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Extraction starting (Body size: {len(body_text)} chars)...")
            
            await browser.close()
            
            result = await self.extractor.extract(body_text, ExtractionResult)
            return result

    async def discover_portal_url(self, portal_url: str, suburb: str, task_id: str = None) -> str:
        """Instantaneously discovers the deep results URL for a specific suburb via internal APIs."""
        from database import update_task
        import httpx
        
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.property24.com/to-rent",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }

        if task_id:
            update_task(task_id, "Brain", f"⚡️ Hyper-API: Scouting {suburb}...")
            
        # 1. Property24 Hyper-API Scout (Dual-Tunnel)
        if "property24.com" in portal_url:
            endpoints = [
                "https://www.property24.com/queries/searchautocomplete",
                "https://www.property24.com/Search/AutoCompleteItems"
            ]
            
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                # 🍪 STEP 1: Handshake (Visit home page to pick up session cookies)
                try:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🤝 🍪 Hyper-API: Initial Session Handshake with {portal_url}...")
                    await client.get(portal_url, headers=headers)
                except Exception as e:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🤝 🍪 Hyper-API: Handshake warning: {str(e)}")

                # 🚀 STEP 2: Multi-Tunnel Probe
                for endpoint in endpoints:
                    try:
                        import time
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Proofing endpoint: {endpoint}...")
                        params = {"term": suburb, "_": int(time.time() * 1000)}
                        response = await client.get(endpoint, params=params, headers=headers)
                        
                        # DEBUG LOGGING
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Status: {response.status_code}")
                        if response.status_code != 200:
                            cookie_count = len(client.cookies)
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Detail: Status {response.status_code}, Cookies: {cookie_count}")
                            if "outdatedBrowser" in response.text:
                                print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Block: Still flagged as outdated browser.")
                        
                        if response.status_code == 200:
                            matches = response.json()
                            if matches and len(matches) > 0:
                                item = matches[0]
                                relative_url = item.get("Url") 
                                suburb_id = item.get("Id") or item.get("id") or item.get("value")
                                
                                if relative_url:
                                    final_url = f"https://www.property24.com{relative_url}"
                                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Success: {final_url}")
                                    if task_id:
                                        update_task(task_id, "Brain", f"✅ Hyper-API Found: {suburb}")
                                    return final_url
                                elif suburb_id:
                                    final_url = f"https://www.property24.com/to-rent/{suburb.lower()}/{suburb_id}"
                                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Success (ID): {final_url}")
                                    return final_url
                    except Exception as e:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API Endpoint Error: {str(e)}")
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡️ Hyper-API No Match on any tunnel. Falling back to browser...")

        # 2. Browser Fallback (Legacy Scout)
        async with async_playwright() as p:
            # Harden browser for Docker
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(viewport={'width': 1280, 'height': 800})
            page = await context.new_page()
            
            try:
                await page.goto(portal_url, wait_until="networkidle", timeout=30000)
                
                if "property24.com" in portal_url:
                    search_input = page.locator("#token-input-AutoCompleteItems, input[placeholder*='suburb' i]").first
                    await search_input.wait_for(state="visible", timeout=10000)
                    await search_input.fill(suburb)
                    await page.wait_for_selector(".ui-autocomplete", timeout=5000)
                    await page.click(".ui-autocomplete li.ui-menu-item:first-child, .ui-autocomplete li:first-child")
                    await page.click("button.btn-danger, button:has-text('Search'), .p24_searchButton")
                    await page.wait_for_url(lambda u: "/to-rent/" in u and len(u.split("/")) > 4, timeout=10000)
                    return page.url
                return portal_url
            except Exception as e:
                print(f"Discovery Fallback Error: {str(e)}")
                return portal_url
            finally:
                await browser.close()

async def test_engine():
    # Quick test runner
    engine = SniperEngine()
    # Mocking environment variables for local test
    os.environ["GEMINI_API_KEY"] = "YOUR_KEY" 

if __name__ == "__main__":
    asyncio.run(test_engine())
