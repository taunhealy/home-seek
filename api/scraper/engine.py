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
        
        # 1. Digital Injected Scout (Zero-Detection)
        async with async_playwright() as p:
            # Harden browser for Docker
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # 🎙️ Bridge the browser console to our terminal
            page.on("console", lambda msg: print(f"  [Browser] {msg.text}"))
            
            try:
                if task_id:
                    update_task(task_id, "Brain", f"💉 Injected-API: Scouting {suburb}...")
                
                # Navigate to the portal with networkidle to ensure cookies/sessions are hot
                await page.goto(portal_url, wait_until="networkidle", timeout=30000) 
                
                # 💉 Internal Injection Probes
                item = await page.evaluate(f"""async () => {{
                    const endpoints = [
                        '/queries/searchautocomplete?term={suburb}',
                        '/Search/AutoCompleteItems?term={suburb}'
                    ];
                    for (const url of endpoints) {{
                        try {{
                            console.log('  -> Probing tunnel: ' + url);
                            const response = await fetch(url, {{
                                headers: {{ 'X-Requested-With': 'XMLHttpRequest' }}
                            }});
                            const text = await response.text();
                            console.log('  -> Response received: ' + text.substring(0, 100));
                            
                            const matches = JSON.parse(text);
                            if (matches && matches.length > 0) {{
                                console.log('  -> MATCH FOUND: ' + matches[0].name || matches[0].value);
                                return matches[0];
                            }}
                        }} catch (e) {{ 
                            console.log('  -> Tunnel error: ' + e.message);
                            continue; 
                        }}
                    }}
                    return null;
                }}""")
                
                if item:
                    # Parse the found object for any usable ID or URL
                    relative_url = item.get("Url") or item.get("url")
                    suburb_id = item.get("Id") or item.get("id") or item.get("value")
                    
                    if relative_url:
                        final_url = f"https://www.property24.com{relative_url}"
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] 💉 Injected-API Success (URL): {final_url}")
                        if task_id:
                             update_task(task_id, "Brain", f"✅ Injected-API Found: {suburb}")
                        return final_url
                    elif suburb_id:
                        final_url = f"https://www.property24.com/to-rent/{suburb.lower()}/{suburb_id}"
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] 💉 Injected-API Success (ID): {final_url}")
                        return final_url
                
                # 🎭 Ghost-Human Manual Scout
                if "property24.com" in portal_url:
                    search_input = page.locator("#token-input-AutoCompleteItems, input[placeholder*='suburb' i]").first
                    await search_input.wait_for(state="visible", timeout=15000)
                    
                    # Human-like typing with random biological delays
                    import random
                    await search_input.click()
                    await page.wait_for_timeout(random.randint(500, 1000))
                    
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⌨️🖐️ Ghost-Human: Typing {suburb}...")
                    for char in suburb:
                        await page.keyboard.press(char)
                        await page.wait_for_timeout(random.randint(50, 150))
                    
                    # Wait for autocomplete dropdown
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧐 waiting for dropdown...")
                    await page.wait_for_selector(".ui-autocomplete", timeout=10000)
                    await page.wait_for_timeout(random.randint(300, 700))
                    
                    # Keyboard navigation (Stealthier than clicking)
                    await page.keyboard.press("ArrowDown")
                    await page.wait_for_timeout(random.randint(200, 400))
                    await page.keyboard.press("Enter")
                    
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚀 Search submitted. Waiting for URL change...")
                    await page.wait_for_url(lambda u: "/to-rent/" in u and len(u.split("/")) > 4, timeout=15000)
                    
                    final_url = page.url
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Ghost-Human Success: {final_url}")
                    return final_url
                
                return portal_url
            except Exception as e:
                print(f"Injected Discovery Error: {str(e)}")
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
