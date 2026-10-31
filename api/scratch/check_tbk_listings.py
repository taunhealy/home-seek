import urllib.request
import re

url = 'https://www.property24.com/to-rent/tamboerskloof/cape-town/western-cape/9163?ToPrice=18000'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}
req = urllib.request.Request(url, headers=headers)
try:
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    tiles = re.split(pattern, html)
    print(f"Found {len(tiles)//2} listings in Tamboerskloof <= R18k:")
    for i in range(1, len(tiles), 2):
        lid = tiles[i]
        b = tiles[i+1][:3000]
        p_m = re.search(r'class="p24_price"[^>]*content="(\d+)"', b)
        price = p_m.group(1) if p_m else '?'
        t_m = re.search(r'class="p24_title[^"]*"[^>]*>(.*?)</span>', b, re.S)
        title = re.sub(r'<[^>]+>', '', t_m.group(1)).strip() if t_m else ''
        loc_m = re.search(r'class="p24_location[^"]*"[^>]*>(.*?)</span>', b, re.S)
        loc = re.sub(r'<[^>]+>', '', loc_m.group(1)).strip() if loc_m else ''
        size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+\s*m²)</span>', b, re.S)
        sz = size_m.group(1) if size_m else ''
        beds_m = re.search(r'title="Bedrooms"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
        beds = beds_m.group(1) if beds_m else ''
        
        # excerpt / address
        exc_m = re.search(r'class="p24_excerpt"[^>]*title="([^"]+)"', b)
        exc = exc_m.group(1)[:80] if exc_m else ''
        print(f"  #{lid}: R{price} | {title} | {sz} | {beds} beds | {loc} | {exc}")
except Exception as e:
    print('Error:', e)

