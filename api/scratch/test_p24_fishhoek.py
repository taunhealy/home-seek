import asyncio
import os
import sys

# Ensure api directory is on sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from playwright.async_api import async_playwright
import random

async def run_p24_fish_hoek_test():
    url = "https://www.property24.com/to-rent/fish-hoek/western-cape/475"
    print(f"[TEST] Testing Property24 Fish Hoek: {url}")

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    viewport = {"width": 1920, "height": 1080}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=user_agent, viewport=viewport)
        page = await context.new_page()

        try:
            print("[NAV] Navigating to page...")
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            print(f"[NAV] HTTP Status: {resp.status if resp else 'None'}")
            
            # Brief human pause
            await asyncio.sleep(random.uniform(1.5, 2.5))

            # Check title
            title = await page.title()
            print(f"[PAGE] Page Title: {title}")

            # Check for bot detection / Cloudflare / blocking
            body_text = await page.inner_text("body")
            if "captcha" in body_text.lower() or "blocked" in body_text.lower() or "security check" in body_text.lower():
                print("[ALERT] Security checkpoint or bot block detected!")
            else:
                print("[STATUS] No immediate bot block encountered.")

            # Run harvest script
            harvest_script = """() => {
                const items = document.querySelectorAll('.p24_regularTile, .p24_promotedTile, .p24_featuredTile');
                const results = [];
                items.forEach(el => {
                    const priceEl = el.querySelector('.p24_price');
                    const titleEl = el.querySelector('.p24_title');
                    const excerptEl = el.querySelector('.p24_excerpt');
                    const linkEl = el.querySelector('a[href*="/to-rent/"]');
                    
                    const price = priceEl ? priceEl.innerText.trim() : '';
                    const title = titleEl ? titleEl.innerText.trim() : '';
                    const excerpt = excerptEl ? excerptEl.innerText.trim() : '';
                    const link = linkEl ? ('https://www.property24.com' + linkEl.getAttribute('href')) : '';
                    const fullText = el.innerText.trim();

                    if (price || title) {
                        results.push({
                            title,
                            price,
                            excerpt,
                            link,
                            fullText
                        });
                    }
                });
                return results;
            }"""

            cards = await page.evaluate(harvest_script)
            print(f"[HARVEST] Successfully harvested {len(cards)} listing cards on Property24 Fish Hoek.")

            # Filter for short-term indicators
            short_term_keywords = [
                "short term", "short-term", "month to month", "month-to-month", 
                "monthly", "winter rental", "winter let", "temporary", "flexible",
                "6 month", "6-month", "3 month", "3-month", "day", "daily", "holiday"
            ]

            print("\n--- Listing Samples & Term Analysis ---")
            short_term_matches = []
            for i, card in enumerate(cards[:10]):
                text_lower = (card['title'] + " " + card['excerpt'] + " " + card['fullText']).lower()
                matched_kw = [kw for kw in short_term_keywords if kw in text_lower]
                is_st = len(matched_kw) > 0
                if is_st:
                    short_term_matches.append((card, matched_kw))

                print(f"\nListing #{i+1}:")
                print(f"  Title: {card['title']}")
                print(f"  Price: {card['price']}")
                print(f"  Link:  {card['link']}")
                print(f"  Short-term cues: {matched_kw if matched_kw else 'Standard (likely long-term 12m)'}")

            print(f"\n[SUMMARY] Total listings inspected: {len(cards)}")
            print(f"[SUMMARY] Listings explicitly matching short-term cues: {len(short_term_matches)}")

        except Exception as e:
            print(f"[ERROR] Exception during test: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_p24_fish_hoek_test())
