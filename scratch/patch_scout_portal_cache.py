with open('c:/Ryoko/Projects/home-seek/api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    })
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[SCOUT SCRAPER] Error fetching {url}: {e}")
        return []'''

replacement = '''    from services.p24_client import p24_client
    # 1. Check local cache (30-minute freshness for live portal search results)
    cached = p24_client.get_cached(url, max_age_seconds=1800)
    if cached and "Server unavailable" not in cached:
        html = cached
    else:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.property24.com/'
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            html = urllib.request.urlopen(req, timeout=12).read().decode('utf-8', errors='ignore')
            if "Server unavailable" in html:
                print(f"[SCOUT SCRAPER] Property24 rate-limited (Server unavailable) on {url}. Falling back gracefully.")
                return []
            p24_client.set_cache(url, html)
        except Exception as e:
            print(f"[SCOUT SCRAPER] Error fetching {url}: {e}")
            return []'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('c:/Ryoko/Projects/home-seek/api/services/ai_scout.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Successfully patched scrape_portal_listings cache & rate limit detection!')
else:
    print('Target not found in ai_scout.py')

