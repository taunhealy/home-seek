with open('c:/Ryoko/Projects/home-seek/api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''def enrich_candidate_listing(item: Dict[str, Any]) -> Dict[str, Any]:
    """Inspects listing detail page to extract exact parking spaces, security, and sqm if missing."""
    url = item.get("url")
    if not url:
        return item
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.property24.com/"}
        )
        html = urllib.request.urlopen(req, timeout=4).read().decode("utf-8", errors="ignore")'''

replacement = '''def enrich_candidate_listing(item: Dict[str, Any]) -> Dict[str, Any]:
    """Inspects listing detail page to extract exact parking spaces, security, and sqm if missing."""
    # Fast-path: if parking & size already parsed from listing tile, do not query detail page
    if item.get("parking") is not None and item.get("sqm"):
        return item
    url = item.get("url")
    if not url:
        return item
    try:
        from services.p24_client import p24_client
        # Check polite cache first to prevent redundant requests
        html = p24_client.get_cached(url)
        if not html:
            # If not in local cache, do not block or flood P24 synchronously during scout
            return item'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('c:/Ryoko/Projects/home-seek/api/services/ai_scout.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Successfully patched ai_scout.py enrich_candidate_listing!')
else:
    print('Target not found in ai_scout.py')

