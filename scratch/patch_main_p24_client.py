import re

path = 'c:/Ryoko/Projects/home-seek/api/main.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    try:
        import httpx
        import re

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.property24.com/",
            "Sec-Ch-Ua": '"Chromium";v="129", "Not=A?Brand";v="24"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin"
        }

        html = ""
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=8.0) as client:
                resp = await client.get(clean_url)
                if resp.status_code == 200:
                    html = resp.text
        except Exception as http_err:
            print_safe(f"[LISTING PHOTOS HTTPX ERROR] {clean_url}: {http_err}")

        # Fallback to urllib if httpx failed
        if not html:
            import urllib.request
            req = urllib.request.Request(clean_url, headers=headers)
            try:
                html = urllib.request.urlopen(req, timeout=6).read().decode('utf-8', errors='ignore')
            except Exception:
                pass

        if not html:
            return {"status": "error", "photos": []}'''

replacement = '''    try:
        import re
        from services.p24_client import p24_client

        # Polite rate-limited fetch with disk/RAM caching & circuit breaking
        html = await p24_client.fetch_html(clean_url, cache_ttl_seconds=86400 * 7)
        if not html:
            return {"status": "success", "photos": []}'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Successfully patched main.py with p24_client!')
else:
    print('Target block not found in main.py')

