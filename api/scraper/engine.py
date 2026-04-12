import asyncio
from playwright.async_api import async_playwright
import os
import json
from datetime import datetime
from typing import Optional
from intelligence.extractor import GeminiExtractor
from schemas import ExtractionResult

class SniperEngine:
    def __init__(self):
        self.extractor = GeminiExtractor()
        self.browserless_url = os.getenv("BROWSERLESS_URL") # e.g. wss://chrome.browserless.io?token=YOUR-TOKEN

    async def scrape_url(self, url: str, use_cookies: bool = True, task_id: Optional[str] = None, search_query: Optional[str] = None) -> ExtractionResult:
        from database import update_task
        
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
            if search_query and ("property24.com" in url or "gumtree.co.za" in url):
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
                        await asyncio.sleep(2)
                        await page.keyboard.press("ArrowDown")
                        await asyncio.sleep(0.5)
                        await page.keyboard.press("Enter")
                        
                        # Explicitly click the SEARCH button to trigger redirection
                        search_btn = page.locator("button.btn-danger, button:has-text('Search')").first
                        await search_btn.click()
                        
                        # Wait for the results page to load
                        try:
                            await page.wait_for_url(lambda url: "to-rent" in url and "search" not in url, timeout=10000)
                        except:
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] Redirect timeout, proceeding with current URL: {page.url}")
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

async def test_engine():
    # Quick test runner
    engine = SniperEngine()
    # Mocking environment variables for local test
    os.environ["GEMINI_API_KEY"] = "YOUR_KEY" 

if __name__ == "__main__":
    asyncio.run(test_engine())
