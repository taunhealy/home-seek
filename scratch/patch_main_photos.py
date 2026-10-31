import re

path = 'c:/Ryoko/Projects/home-seek/api/main.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target_pattern = r'@app\.get\("/api/listing-photos"\)\s+async def get_listing_photos.*?return \{"status": "error", "photos": \[\]\}'

replacement = '''_listing_photos_cache: Dict[str, List[str]] = {}

@app.get("/api/listing-photos")
async def get_listing_photos(url: str):
    """Fetches high-res interior/exterior photos for a listing, filtering out agent headshots and logos."""
    if not url:
        return {"status": "error", "photos": []}

    # Check in-memory cache
    if url in _listing_photos_cache and _listing_photos_cache[url]:
        return {"status": "success", "photos": _listing_photos_cache[url]}

    clean_url = url
    if clean_url.startswith("/"):
        clean_url = f"https://www.property24.com{clean_url}"

    try:
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
            return {"status": "error", "photos": []}

        # 1. Target genuine property gallery containers and lightbox elements
        lightbox_ids = re.findall(r'data-(?:lightbox-src|image-url)="https://images\\.prop24\\.com/(\\d+)', html)
        listing_img_ids = re.findall(r'alt="Listing number:[^"]*"[^>]*(?:lazy-src|src)="https://images\\.prop24\\.com/(\\d+)', html)
        gal_href_ids = re.findall(r'rel="photo\\[pp_gal\\]"[^>]*href="https://images\\.prop24\\.com/(\\d+)', html)

        candidate_ids = []
        seen = set()
        for pid in lightbox_ids + listing_img_ids + gal_href_ids:
            if pid not in seen:
                seen.add(pid)
                candidate_ids.append(pid)

        # Fallback if specific gallery attributes are missing
        if not candidate_ids:
            all_ids = re.findall(r'https://images\\.prop24\\.com/(\\d+)/[^\\s"\'<>]+', html)
            for pid in all_ids:
                if pid not in seen:
                    seen.add(pid)
                    candidate_ids.append(pid)

        # 2. Strict blacklisting of agent headshots, profile avatars, and agency logos
        agent_pids = set(re.findall(r'(?:agentPhoto|RealEstateAgent|agent-profile|agent-image|js_agentPhoto)[^>]*https://images\\.prop24\\.com/(\\d+)', html))
        agent_pids.update(re.findall(r'https://images\\.prop24\\.com/(\\d+)/[^\\s"\'<>]*(?:UpperCrop|Fit450|Fit200|Fit150|Crop200x200)', html))

        clean_photos = [f"https://images.prop24.com/{pid}/Crop600x400" for pid in candidate_ids if pid not in agent_pids]
        if clean_photos:
            _listing_photos_cache[url] = clean_photos[:24]
        return {"status": "success", "photos": clean_photos[:24]}
    except Exception as e:
        print_safe(f"[LISTING PHOTOS ERROR] {e}")
        return {"status": "error", "photos": []}'''

new_content, count = re.subn(target_pattern, lambda m: replacement, content, flags=re.DOTALL)
print('Replaced occurrences:', count)
if count > 0:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Successfully updated main.py')
else:
    print('Failed to match pattern')
