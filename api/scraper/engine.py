import asyncio
import random
from playwright.async_api import async_playwright
try:
    from playwright_stealth import stealth as playwright_stealth_func
except:
    playwright_stealth_func = None
import os
import json
import re
from datetime import datetime
from typing import Optional, List
from intelligence.extractor import GeminiExtractor
from models.listing import ExtractionResult
from services.database import get_db, record_hash

def print_flush(*args, **kwargs):
    import sys
    try:
        msg = " ".join(map(str, args))
        # [STABILITY] Purge non-ASCII for Windows terminal stability
        safe_msg = msg.encode('ascii', 'ignore').decode('ascii')
        print(safe_msg, **kwargs, flush=True)
        sys.stdout.flush()
    except:
        print(*args, **kwargs, flush=True)

try:
    from crawl4ai import AsyncWebCrawler
    CRAWL_AVAILABLE = True
except ImportError:
    CRAWL_AVAILABLE = False

class SniperEngine:
    def __init__(self):
        self.extractor = GeminiExtractor()
        self.browserless_url = os.getenv("BROWSERLESS_URL")
        # [IDENTITY] Balanced mix of Mobile and High-Trust Desktop
        custom_ua = os.environ.get("USER_AGENT")
        self.identities = [
            {
                "ua": custom_ua or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", 
                "viewport": {"width": 1920, "height": 1080}, 
                "name": "Desktop-PC"
            },
            {
                "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1", 
                "viewport": {"width": 393, "height": 852}, 
                "name": "Mobile-iOS"
            }
        ]
        
        # [SINGLETON] Persistence State
        self.p_manager = None
        self.p_browser = None
        self.p_context = None
        self.p_lock = asyncio.Lock()
        self.heartbeat_task = None
        self.anchor_page = None # [SINGLETON] Keeps the window alive

    async def start(self):
        """Initializes the Singleton Browser for high-trust residential operation."""
        if str(os.environ.get("LOCAL_SNIPER", "")).lower() != "true":
            return
            
        async with self.p_lock:
            if self.p_context: return
            
            print_flush("[SINGLETON] Launching Persistent Stealth Engine...")
            self.p_manager = await async_playwright().start()
            
            user_data_path = os.path.join(os.getcwd(), "local_session")
            desktop_id = self.identities[0]
            
            # [STABILITY] Visible minimized browser is highest trust
            is_headless = str(os.environ.get("HEADLESS", "false")).lower() == "true"
            
            self.p_context = await self.p_manager.chromium.launch_persistent_context(
                user_data_dir=user_data_path,
                headless=is_headless,
                user_agent=desktop_id["ua"],
                viewport=desktop_id["viewport"],
                args=["--no-sandbox", "--disable-setuid-sandbox"]
            )
            
            # Apply Stealth
            if playwright_stealth_func:
                try:
                    if callable(playwright_stealth_func): playwright_stealth_func(self.p_context)
                    else: playwright_stealth_func.stealth(self.p_context)
                except: pass
                
            # Load initial cookies from vault
            try:
                with open("cookies.json", "r") as f:
                    cookies = json.load(f)
                    await self.p_context.add_cookies(cookies)
                    print_flush("[SINGLETON] Prime cookies injected into persistent context.")
            except: pass

            # Start Heartbeat & Anchor
            self.anchor_page = await self.p_context.new_page()
            await self.anchor_page.goto("https://www.facebook.com", wait_until="domcontentloaded")
            
            self.heartbeat_task = asyncio.create_task(self._session_heartbeat())
            print_flush("[SINGLETON] Persistent Engine READY. Anchor Page locked. Heartbeat active.")

    async def stop(self):
        """Gracefully shuts down the persistent browser."""
        async with self.p_lock:
            if self.heartbeat_task: self.heartbeat_task.cancel()
            if self.p_context: await self.p_context.close()
            if self.p_manager: await self.p_manager.stop()
            self.p_context = None
            self.p_manager = None
            print_flush("[SINGLETON] Persistent Engine SHUTDOWN complete.")

    async def _session_heartbeat(self):
        """Maintains the session by occasionally interacting with Facebook."""
        while True:
            try:
                await asyncio.sleep(random.randint(900, 1500)) # 15-25 mins
                if self.p_context and self.anchor_page:
                    print_flush("[HEARTBEAT] Simulating human attendance on Anchor Page...")
                    # Ensure we are on a living page (FB feed)
                    if "facebook.com" not in self.anchor_page.url:
                        await self.anchor_page.goto("https://www.facebook.com", wait_until="domcontentloaded")
                    
                    await self.human_scroll(self.anchor_page, distance=random.randint(400, 800))
                    await self.human_delay(2, 5)
                    await self.human_hover(self.anchor_page)
            except Exception as e:
                print_flush(f"[HEARTBEAT] Warning: {e}")
            except asyncio.CancelledError:
                break

    def format_proxy_url(self, proxy_url: str, session_id: Optional[str] = None) -> str:
        if not proxy_url or "localhost" in proxy_url or "127.0.0.1" in proxy_url: return proxy_url
        try:
            import urllib.parse
            parsed = urllib.parse.urlparse(proxy_url)
            
            # [ALIGNED] Simple append-only session logic for Decodo/Standard Proxies
            username = parsed.username
            if session_id and username and "session-" not in username:
                username = f"{username}-session-{session_id}"

            new_netloc = f"{username}:{parsed.password}@{parsed.hostname}:{parsed.port}"
            return parsed._replace(netloc=new_netloc).geturl()
        except Exception as e:
            print_flush(f"[SYSTEM] Proxy Warning: {e}")
            return proxy_url

    async def human_delay(self, min_s: float = 0.5, max_s: float = 1.2):
        import random
        await asyncio.sleep(random.uniform(min_s, max_s))

    async def human_scroll(self, page, distance: int = 2500):
        """Natural scroll with acceleration/deceleration, jitter, and forced visibility."""
        import random
        try:
            total_scrolled = 0
            # Center mouse for focus
            await page.mouse.move(random.randint(400, 800), random.randint(300, 600))
            
            while total_scrolled < distance:
                # Randomize scroll chunks (smaller looks more like a wheel/thumb)
                chunk = random.randint(250, 550)
                
                # Hybrid Scroll: Mouse Wheel + Atomic JS Pulse for visibility
                await page.mouse.wheel(0, chunk)
                await page.evaluate(f"window.scrollBy(0, {chunk})")
                
                total_scrolled += chunk
                
                # Natural delay between chunks
                await asyncio.sleep(random.uniform(0.3, 0.8))
                
                # Occasional mouse jitter (looks like reading)
                if random.random() > 0.7:
                    await self.human_mouse_jitter(page)
                    
                # Occasional pause to 'read' (longer delay)
                if random.random() > 0.9:
                    await asyncio.sleep(random.uniform(1.0, 2.0))
        except: pass

    async def human_mouse_jitter(self, page):
        """Simulates human hand micro-movements."""
        import random
        try:
            viewport = page.viewport_size or {'width': 1280, 'height': 800}
            target_x = random.randint(200, viewport['width'] - 200)
            target_y = random.randint(200, viewport['height'] - 200)
            await page.mouse.move(target_x, target_y, steps=random.randint(15, 30))
            for _ in range(random.randint(1, 3)):
                drift_x = target_x + random.randint(-40, 40)
                drift_y = target_y + random.randint(-40, 40)
                await page.mouse.move(drift_x, drift_y, steps=random.randint(5, 15))
                await asyncio.sleep(random.uniform(0.1, 0.3))
        except: pass

    async def human_hover(self, page):
        """Simulates idle engagement by hovering over random elements."""
        import random
        try:
            elements = await page.query_selector_all('[role="article"], article, a, button')
            if elements:
                # Target top area where user usually hovers while reading
                target = random.choice(elements[:8])
                box = await target.bounding_box()
                if box:
                    # Move to element center with some randomization
                    target_x = box['x'] + (box['width'] / 2) + random.randint(-20, 20)
                    target_y = box['y'] + (box['height'] / 2) + random.randint(-10, 10)
                    await page.mouse.move(target_x, target_y, steps=random.randint(10, 20))
                    await asyncio.sleep(random.uniform(0.8, 2.0))
        except: pass

    async def scrape_url(self, url: str, use_cookies: bool = True, task_id: Optional[str] = None, search_area: Optional[str] = None, model_name: Optional[str] = None, min_bedrooms: Optional[List[int]] = None, max_price: Optional[int] = None, is_pulse: bool = False) -> ExtractionResult:
        """The 'Sniper' extraction stage - Obsidian-Stable v1.0.9."""
        from services.database import update_task
        print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] --- SCAN START (Pulse: {is_pulse}) ---")
        
        # 🟢 HYBRID MODE
        is_portal = "property24.com" in url or "rentuncle.co.za" in url
        if CRAWL_AVAILABLE and not is_portal and ("/blog/" in url or "/news/" in url):
            if task_id: await update_task(task_id, "Extraction", "[DATA] Deploying Crawl4AI Sniper...")
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=url, bypass_cache=True, magic=True)
                if result.success:
                    return await self.extractor.extract(result.markdown, ExtractionResult, model_name=model_name)
        
        if task_id: await update_task(task_id, "Initializing", "[AUTO] Initializing browser...")

        browser = None
        context = None
        try:
            is_local = str(os.environ.get("LOCAL_SNIPER", "")).lower() == "true"
            
            if is_local:
                # [SINGLETON] Use the persistent high-trust context
                if not self.p_context:
                    await self.start()
                context = self.p_context
            else:
                # [CLOUD] Standard ephemeral launch
                async with async_playwright() as p:
                    sticky_sid = task_id[:8] if task_id else "home-seek-101"
                    proxy_url = self.format_proxy_url(os.environ.get("HTTP_PROXY"), session_id=sticky_sid)
                    
                    launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"]}
                    
                    if self.browserless_url:
                        browser = await p.chromium.connect_over_cdp(self.browserless_url)
                    else:
                        browser = await p.chromium.launch(**launch_args)
                    
                    desktop_id = self.identities[0]
                    context_args = {"user_agent": desktop_id["ua"], "viewport": desktop_id["viewport"]}
                    
                    if proxy_url:
                        import urllib.parse
                        parsed = urllib.parse.urlparse(proxy_url)
                        context_args["proxy"] = {"server": f"{parsed.hostname}:{parsed.port}", "username": parsed.username, "password": parsed.password}
                    
                    context = await browser.new_context(**context_args)
                    if playwright_stealth_func:
                        try:
                            if callable(playwright_stealth_func): playwright_stealth_func(context)
                            else: playwright_stealth_func.stealth(context)
                        except: pass
                    
                    if use_cookies:
                        from services.database import get_global_cookies
                        cookies = await get_global_cookies()
                        if cookies: await context.add_cookies(cookies)

            # Start of extraction
            page = await context.new_page()
            if is_portal:
                sep = "&" if "?" in url else "?"
                if min_bedrooms: url += f"{sep}bedrooms={min_bedrooms}"; sep="&"
                if max_price: url += f"{sep}maxPrice={max_price}"

            # [SPEED] Accelerated Direct Search for FB Groups
            if "facebook.com/groups" in url and search_area:
                import urllib.parse
                url_base = url.rstrip('/')
                url = f"{url_base}/search/?q={urllib.parse.quote(search_area)}"
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Teleporting to Direct Search: {search_area}")

            # [NAV] Fast-Track Navigation (v17.3)
            try:
                # 'domcontentloaded' is much faster than 'networkidle' on proxies
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                
                # [VITAL] Wait for Search Hydration (FB specific)
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Waiting for Search Results to hydrate...")
                try:
                    # Look for common FB Feed markers
                    await page.wait_for_selector('[role="feed"], div[class*="feed"], div[aria-label*="Search"]', timeout=15000)
                    print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Results detected. Commencing harvest.")
                except:
                    print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Warning: Results feed not detected, continuing with broad sweep.")
            except Exception as e:
                print_flush(f"[SYSTEM] Primary Navigation Timeout (continuing anyway): {str(e)[:40]}")

            # [MISSION] JANITOR: Close Login/Join Popups (v87.0: THE GHOST PROTECTOR)
            # We surgically remove annoying overlays WITHOUT touching engagement buttons.
            print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [JANITOR] Scanning for interstitials...")
            try:
                # 1. Standard Clicks (Strict Selectors ONLY - No broad 'div i' allowed)
                closers = ['[aria-label="Close"]', '[aria-label="Sluiten"]', '[aria-label="Dismiss"]']
                decapitated_count = 0
                for selector in closers:
                    if await page.is_visible(selector, timeout=1500):
                        # Final Safety Check: Ensure we aren't clicking an engagement element
                        is_engagement = await page.evaluate("""(sel) => {
                            const el = document.querySelector(sel);
                            const text = el?.innerText?.toLowerCase() || '';
                            return text.includes('like') || text.includes('share') || text.includes('comment');
                        }""", selector)
                        
                        if not is_engagement:
                            await page.click(selector)
                            await self.human_delay(0.5, 1.0)
                            decapitated_count += 1
                
                if decapitated_count > 0:
                     print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [JANITOR] Success: {decapitated_count} popups standard-clicked.")
                
                # 2. Escape Key (The Hammer)
                await page.keyboard.press("Escape")
                await self.human_delay(0.5, 1.0)
                
                # 3. DOM Eradication (The Nuke)
                await page.evaluate("""() => {
                    const badStrings = ['Log In', 'Sign Up', 'See more from', 'Sluiten', 'Aanmelden'];
                    const dialogs = document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]');
                    dialogs.forEach(d => {
                         if (badStrings.some(s => d.innerText.includes(s))) {
                             d.remove(); 
                             console.log('[JANITOR] Removed Modal');
                         }
                    });
                    document.body.style.overflow = 'auto'; // Re-enable scrolling
                    document.documentElement.style.overflow = 'auto';
                }""")
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [JANITOR] Decapitation loop complete.")
            except: pass

            # Proactive Forensics: Landing Screenshot
            try:
                shot_buf = await page.screenshot(type="jpeg", quality=40)
                import base64
                s_data = base64.b64encode(shot_buf).decode("utf-8")
                if task_id:
                    db = get_db()
                    db.collection("tasks").document(task_id).update({
                        "landing_screenshot": f"data:image/jpeg;base64,{s_data}"
                    })
            except: pass

            await self.human_delay(1, 2)

            # --- DEEP SEARCH (FB) - MOVED TO DIRECT URL INJECTION ---
            # Legacy code removed for speed.

            # Interaction Lifecycle (Mimicry v3: Behavioral Cycling)
            behavioral_patterns = ["Distracted", "Deep", "Quick"]
            current_pattern = random.choice(behavioral_patterns)
            print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Behavior Mode: {current_pattern} (mimicry v3)")
            
            # [DEEP HARVEST] Increased cycle count for massive discovery depth
            # [FLASH SCAN] pulses only need the top shelf (v1.2)
            if is_pulse:
                scroll_count = 3
            else:
                scroll_count = 8 if "facebook.com" in url else 5
            cumulative_buffer = ""
            
            # [VITAL] Link-Aware Harvesting (v47.0)
            # Instead of innerText (which kills URLs), we use a custom script to detect "Cards"
            harvest_script = """() => {
                const listings = [];
                // 1. Detect Cards based on Platform
                const selectors = [
                    '.p24_regularTile', '.p24_promotedTile', '.p24_featuredTile', // Property24
                    'div[role="article"]', 'div[data-testid="fbfeed_story"]', // Facebook Core
                    'div[role="feed"] > div', 'div[class*="feed"] > div', 
                    'article', 'div[class*="listing"]' 
                ];
                
                let foundItems = [];
                for (const s of selectors) {
                    const items = document.querySelectorAll(s);
                    if (items.length > 0) { foundItems = Array.from(items); break; }
                }

                if (foundItems.length > 0) {
                    return foundItems.map(f => {
                        // 🛰️ DEEP LINK EXTRACTION: Target platform-specific permalinks
                        let link = window.location.href;
                        
                        // 1. Hunt for direct post links (Facebook specific: Search Results & Feed)
                        // [v90.0] TARGET: The timestamp/permalink link - only reliable source for post IDs
                        const fbPostSelectors = ['a[href*="/posts/"]', 'a[href*="/permalink/"]', 'a[href*="/groups/"]'];
                        for (const sel of fbPostSelectors) {
                            const l = f.querySelector(sel);
                            let candidate = l?.getAttribute('href') || "";
                            
                            // 🎯 [v90.0] Deep Fidelity Filter: Ensure it's a DIRECT POST (has many digits at the end)
                            const hasPostId = /\\/posts\\/\\d+/.test(candidate) || /\\/permalink\\/\\d+/.test(candidate) || /\\/user\\/\\d+\\/.+/.test(candidate);
                            
                            if (candidate && hasPostId) {
                                link = candidate;
                                // Strip trackers (v78.0: The Scrubber)
                                link = link.split('?')[0].split('&')[0];
                                break;
                            }
                        }
                        
                        // 2. Property24 / Generic fallback
                        // [v94.0] 9-DIGIT LOCKDOWN: P24 property IDs are always 9 digits. Suburb IDs (like /432) are short.
                        // We MUST find a link with at least 8-9 digits at the end or it's a ghost.
                        if (link === window.location.href || link.includes('/search/?q=') || !/\\/\\d{8,}/.test(link)) {
                            let allLinks = Array.from(f.querySelectorAll('a[href*="/to-rent/"]'));
                            // Filter for actual listing links (usually long)
                            let bestLink = allLinks.find(a => /\\/\\d{8,}/.test(a.href));
                            let candidate = bestLink?.getAttribute('href') || "";
                            
                            if (candidate && /\\/\\d{8,}/.test(candidate)) {
                                link = candidate;
                            } else {
                                link = "GHOST_LINK"; 
                            }
                        }
                        
                        // 🧙‍♂️ HEAL RELATIVE LINKS
                        if (link.startsWith('/')) {
                            const base = window.location.hostname.includes('property24') 
                                ? 'https://www.property24.com' 
                                : window.location.origin;
                            link = base + link;
                        }
                        
                        const text = f.innerText.replace(/\\s+/g, ' ').trim();
                        if (text.length < 50) return ""; 
                        return `### START_SNIPER_LISTING [DIRECT_LINK: ${link}] ###\\n${text}\\n`;
                    }).join('\\n');
                }
                
                // Fallback to plain text if no cards found
                return document.body.innerText;
            }"""

            for i in range(scroll_count): 
                # Vary patterns based on cycle
                if current_pattern == "Distracted":
                    await self.human_scroll(page, distance=random.randint(1000, 1800))
                elif current_pattern == "Deep":
                    await self.human_scroll(page, distance=random.randint(2500, 4000))
                    await self.human_delay(1, 2)
                else: # Quick
                    await self.human_scroll(page, distance=random.randint(3500, 5200))
                
                # [VITAL] Enhanced Harvest: Capture deep-links for listings (v47.0)
                cycle_text = await page.evaluate(harvest_script)
                cumulative_buffer += f"\n--- CYCLE {i+1} SNAPSHOT ---\n{cycle_text}"
                curr_size = len(cumulative_buffer)
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Cycle {i+1}: Total Buffer {curr_size} chars.")
                
                limit = 8000 if is_pulse else 15000
                if curr_size > limit: break
                await self.human_delay(1, 2)
                
            # Check for Login Wall
            if "facebook.com/login" in page.url or "facebook.com/checkpoint" in page.url:
                if task_id: await update_task(task_id, "Error", "[SESSION] SESSION EXPIRED: Facebook rejected cookies.")
                return ExtractionResult(listings=[], confidence_score=0, raw_summary="Session Expired")

            # --- [ATOMIC FINGERPRINT SHIELD] (v83.0) ---
            import hashlib
            from services.database import get_known_listings
            
            # 1. Split buffer into individual atomic snippets
            # Using DOTALL to ensure we capture multi-line property cards (v83.1)
            snippets = re.split(r"(### START_SNIPER_LISTING.*?###)", cumulative_buffer, flags=re.DOTALL)
            
            # Re-merge to keep delimiters with their content
            merged_snippets = []
            for j in range(1, len(snippets), 2):
                if j+1 < len(snippets):
                    merged_snippets.append(snippets[j] + snippets[j+1])
            
            print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MEMORY] Analyzing {len(merged_snippets)} atomic snippets...")
                
            # 2. Extract Keys (Links + Content Hashes)
            snippet_map = [] # List of {text, link, hash}
            for s in merged_snippets:
                link_match = re.search(r"\[DIRECT_LINK:\s*(.*?)\]", s)
                link = link_match.group(1).strip() if link_match else ""
                # Content hash as fallback for transient URLs
                c_hash = hashlib.sha256(s.encode('utf-8')).hexdigest()
                snippet_map.append({"text": s, "link": link, "hash": c_hash})
            
            # 3. Batch Verification
            known_keys = await get_known_listings(
                [sm['link'] for sm in snippet_map if sm['link']],
                [sm['hash'] for sm in snippet_map]
            )
            
            # 4. Purification (Surgically Filter the Payload)
            # 4. Purification (Surgically Filter the Payload)
            # [v96.0] Hybrid Memory: Track cached items for retrospective matching
            is_manual = task_id is not None
            
            unknown_snippets = []
            cached_hashes = []
            for sm in snippet_map:
                if sm['link'] == "GHOST_LINK": continue
                
                is_known = sm['link'] in known_keys or sm['hash'] in known_keys
                
                if not is_known:
                    unknown_snippets.append(sm)
                else:
                    cached_hashes.append(sm['hash'])
            
            if not unknown_snippets:
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MEMORY] [ZERO-BURN] All {len(merged_snippets)} items cached. Triggering recall loop.")
                return ExtractionResult(listings=[], confidence_score=100, raw_summary="All items cached", cached_hashes=cached_hashes)

            # 5. Rebuild purified body text
            body_text = "\n".join([us['text'] for us in unknown_snippets])
            print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MEMORY] Surgical Filter: {len(unknown_snippets)}/{len(merged_snippets)} items are NEW. Sending to Gemini...")

            # Capture Crime Scene for forensics if we suspect failure
            screenshot_data = None
            try:
                shot_buf = await page.screenshot(type="jpeg", quality=60)
                import base64
                screenshot_data = base64.b64encode(shot_buf).decode("utf-8")
                if task_id:
                    db = get_db()
                    db.collection("tasks").document(task_id).update({
                        "last_screenshot": f"data:image/jpeg;base64,{screenshot_data}"
                    })
            except: pass

            print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] AI Brain: Analyzing dataset with Gemini ({len(body_text)} chars)...")
            snippet = body_text[:150].replace('\n', ' ')
            print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [DEBUG] Data Snippet: {snippet}...")
                
            try:
                result = await self.extractor.extract(body_text, ExtractionResult, model_name=model_name, search_query=search_area)
                if result:
                    result.cached_hashes = cached_hashes
            except Exception as ai_err:
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [CRITICAL] Gemini AI Error: {str(ai_err)}")
                result = None
            
            if result and result.listings:
                print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Success! Found {len(result.listings)} potential matches.")
            else:
                if not result:
                    print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] AI Failure: Extraction returned Null.")
                else:
                    print_flush(f"[{datetime.now().strftime('%H:%M:%S')}] [MISSION] Complete. 0 matches found (AI checked the data and saw nothing relevant).")
                
            # Persistence
            user_found = await page.evaluate("() => document.cookie.includes('c_user')")
            if user_found:
                try:
                    cur_cookies = await context.cookies()
                    from services.database import save_global_cookies
                    await save_global_cookies(cur_cookies)
                except: pass
            
            return result
        except Exception as e:
            print_flush(f"[CRASH] Sniper Crash: {str(e)}")
            
            # [CAMERA] Emergency Forensics: Failure Screenshot
            try:
                if 'page' in locals() and page:
                    shot_buf = await page.screenshot(type="jpeg", quality=40)
                    import base64
                    s_data = base64.b64encode(shot_buf).decode("utf-8")
                    if task_id:
                        db = get_db()
                        db.collection("tasks").document(task_id).update({
                            "crash_screenshot": f"data:image/jpeg;base64,{s_data}"
                        })
            except: pass

            if task_id: await update_task(task_id, "Error", f"Crash: {str(e)[:50]}")
            return ExtractionResult(listings=[], confidence_score=0, raw_summary=f"Crash: {str(e)}")
        finally:
            if 'page' in locals() and page:
                try: await page.close()
                except: pass

            # [SINGLETON] We NEVER close the browser or context in local mode
            is_local = str(os.environ.get("LOCAL_SNIPER", "")).lower() == "true"
            if not is_local:
                if browser:
                    try: await browser.close()
                    except: pass
                elif 'context' in locals() and context:
                    try: await context.close()
                    except: pass

    async def discover_portal_url(self, portal_url: str, suburb: str, task_id: str = None, original_query: Optional[str] = None) -> str:
        from services.database import update_task
        async with async_playwright() as p:
            proxy_url = os.environ.get("HTTP_PROXY")
            launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]}
            if proxy_url: launch_args["proxy"] = {"server": proxy_url}
            browser = await p.chromium.launch(**launch_args)
            context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            page = await context.new_page()
            try:
                if task_id: await update_task(task_id, "Brain", f"[AI-INJECT] Injected-API: Scouting {suburb}...")
                await page.goto(portal_url, wait_until="commit", timeout=15000) 
                item = await page.evaluate(f"""async () => {{
                    const fullTerm = "{suburb}";
                    const terms = [fullTerm];
                    if (fullTerm.includes(" ")) terms.push(...fullTerm.split(" ").filter(t => t.length >= 4));
                    const endpoints = ['/queries/searchautocomplete?term=', '/Search/AutoCompleteItems?q=', '/Search/AutoCompleteItems?term='];
                    for (const term of terms) {{
                        for (const endpoint of endpoints) {{
                            try {{
                                const resp = await fetch(endpoint + encodeURIComponent(term), {{ headers: {{ 'X-Requested-With': 'XMLHttpRequest' }} }});
                                const matches = await resp.json();
                                if (matches && matches.length > 0) return {{ item: matches[0], term: term }};
                            }} catch (e) {{ continue; }}
                        }}
                    }}
                    return null;
                }}""")
                discovered_url = portal_url
                if item:
                    matched_item = item.get("item")
                    relative_url = matched_item.get("Url") or matched_item.get("url")
                    suburb_name_slug = (matched_item.get("Name") or suburb).lower().replace(" ", "-")
                    suburb_id = matched_item.get("Id") or matched_item.get("id") or matched_item.get("value")
                    if relative_url: discovered_url = f"https://www.property24.com{relative_url}"
                    elif suburb_id: discovered_url = f"https://www.property24.com/to-rent/{suburb_name_slug}/{suburb_id}"
                if "property24.com" in discovered_url and original_query:
                    if any(x in original_query.lower() for x in ["pet", "dog", "cat"]):
                        separator = "&" if "?" in discovered_url else "?"
                        discovered_url += f"{separator}sp=ptf%3dTrue"
                return discovered_url
            except Exception as e:
                print_flush(f"[SYSTEM] Discovery Failed: {e}")
                return portal_url
            finally:
                await browser.close()

async def test_engine():
    engine = SniperEngine()

if __name__ == "__main__":
    asyncio.run(test_engine())
