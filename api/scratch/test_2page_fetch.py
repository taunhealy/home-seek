import urllib.request
import re

base_clean = 'https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145'
params = 'ToPrice=18000'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

tiles_total = []
for p in range(1, 3):
    u = f"{base_clean}/p{p}?{params}" if p > 1 else f"{base_clean}?{params}"
    req = urllib.request.Request(u, headers=headers)
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    found = re.findall(pattern, html)
    print(f"Page {p} ({u}): found {len(found)} tiles")
    tiles_total.extend(found)

print(f"Total tiles found: {len(tiles_total)}")
print("Is 117772253 in tiles_total?", "117772253" in tiles_total)

