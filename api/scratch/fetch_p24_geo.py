import urllib.request
import re
import json

urls = [
    ("Rank 1", "117768485", "https://www.property24.com/to-rent/green-point/cape-town/western-cape/11017/117768485"),
    ("Rank 2", "117720366", "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/9163/117203667"),
    ("Rank 3", "115749863", "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/9163/115749863"),
    ("Rank 4", "117408746", "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117408746"),
    ("Rank 5", "117762862", "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021/117762862"),
    ("Rank 7", "117661239", "https://www.property24.com/to-rent/green-point/cape-town/western-cape/11017/117661239"),
    ("Rank 10", "117763397", "https://www.property24.com/to-rent/tamboerskloof/cape-town/western-cape/9163/117763397")
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

for r, lid, u in urls:
    try:
        req = urllib.request.Request(u, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            # Look for street address or breadcrumbs or geo meta
            geo_lat = re.search(r'itemprop="latitude"\s+content="([^"]+)"', html)
            geo_lon = re.search(r'itemprop="longitude"\s+content="([^"]+)"', html)
            addr_m = re.search(r'<div class="p24_address"[^>]*>(.*?)</div>', html, re.DOTALL)
            title_m = re.search(r'<title>(.*?)</title>', html)
            
            lat = geo_lat.group(1) if geo_lat else None
            lon = geo_lon.group(1) if geo_lon else None
            addr = re.sub(r'<[^>]+>', '', addr_m.group(1)).strip() if addr_m else None
            
            print(f"{r} [{lid}]: {title_m.group(1) if title_m else ''}")
            print(f"   Address: {addr}")
            print(f"   Geo: {lat}, {lon}")
    except Exception as e:
        print(f"{r} [{lid}] Error: {e}")

