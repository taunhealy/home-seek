import urllib.request
import re

url_detail = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117408746"
req = urllib.request.Request(url_detail, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Find size in detail page
size_matches = re.findall(r'.{0,30}(?:floor size|size|m²|sqm).{0,30}', html, re.I)
print("Size occurrences in detail page:")
for s in size_matches[:5]:
    print("  ", s.strip())

# Check search tile for 117408746
url_search = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?PropertyCategory=ApartmentOrFlat&ToPrice=18000"
req_s = urllib.request.Request(url_search, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html_s = urllib.request.urlopen(req_s, timeout=10).read().decode("utf-8", errors="ignore")

tiles = re.split(r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"', html_s)
for i in range(1, len(tiles), 2):
    if tiles[i] == "117408746":
        b = tiles[i+1][:3500]
        size_tile = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', b, re.S)
        print("\nSearch tile for 117408746:")
        print("  Size in tile:", size_tile.group(1) if size_tile else "None")
        print("  Snippet:", b[:400])
        break

