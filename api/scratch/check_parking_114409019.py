import urllib.request
import re

url_detail = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url_detail, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Check parking on detail page
park_icon = re.findall(r'title="Parking Spaces"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S)
garage_icon = re.findall(r'title="Garages"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S)
parking_text = re.findall(r'.{0,40}parking.{0,40}', html, re.I)

print("Detail page parking icons:", park_icon)
print("Detail page garage icons:", garage_icon)
print("Mentions of parking in text:")
for p in parking_text[:5]:
    print("  ", p.strip())

# Check search tile for 114409019
url_search = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?PropertyCategory=ApartmentOrFlat&ToPrice=18000"
req_s = urllib.request.Request(url_search, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html_s = urllib.request.urlopen(req_s, timeout=10).read().decode("utf-8", errors="ignore")

tiles = re.split(r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"', html_s)
for i in range(1, len(tiles), 2):
    if tiles[i] == "114409019":
        b = tiles[i+1][:3500]
        park_tile = re.search(r'title="Parking Spaces"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
        garage_tile = re.search(r'title="Garages"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
        print("\nSearch tile for 114409019:")
        print("  Parking Spaces icon:", park_tile.group(1) if park_tile else "None")
        print("  Garages icon:", garage_tile.group(1) if garage_tile else "None")
        print("  Snippet:", b[:400])
        break
