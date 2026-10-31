with open('api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    from services.p24_client import p24_client
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
            return []

    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    tiles = re.split(pattern, html)
    listings = []
    seen = set()

    for i in range(1, len(tiles), 2):"""

replacement = """    from services.p24_client import p24_client
    base_clean = base_url.split('?')[0]
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.property24.com/'
    }

    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    listings = []
    seen = set()

    # Multi-page scan (Pages 1 to 3) to uncover deep inventory and hidden gems
    for page_num in range(1, 4):
        if page_num == 1:
            page_url = base_clean
        else:
            page_url = f"{base_clean}/p{page_num}"
        if params:
            page_url += '?' + '&'.join(params)

        cached = p24_client.get_cached(page_url, max_age_seconds=1800)
        if cached and "Server unavailable" not in cached:
            html = cached
        else:
            try:
                req = urllib.request.Request(page_url, headers=headers)
                html = urllib.request.urlopen(req, timeout=12).read().decode('utf-8', errors='ignore')
                if "Server unavailable" in html:
                    break
                p24_client.set_cache(page_url, html)
            except Exception as e:
                print(f"[SCOUT SCRAPER] Error fetching {page_url}: {e}")
                break

        tiles = re.split(pattern, html)
        if len(tiles) <= 1:
            break

        for i in range(1, len(tiles), 2):"""

text_norm = text.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

assert target_norm in text_norm, "Target not found in ai_scout.py"
text_norm = text_norm.replace(target_norm, replacement_norm, 1)

with open('api/services/ai_scout.py', 'w', encoding='utf-8') as f:
    f.write(text_norm)

print("SUCCESS: Updated scrape_portal_listings with multi-page scanning!")

