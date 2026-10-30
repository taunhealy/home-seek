import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?PropertyCategory=ApartmentOrFlat&ToPrice=18000"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
tiles = re.split(pattern, html)

for i in range(1, min(7, len(tiles)), 2):
    lid = tiles[i]
    b = tiles[i+1][:4000]
    
    # check for agency name or logo in tile
    agency_m = re.search(r'class="p24_branding"[^>]*title="([^"]+)"', b) or \
               re.search(r'<img[^>]+alt="([^"]+)"[^>]+class="[^"]*p24_brandingImage', b) or \
               re.search(r'class="[^"]*p24_brandingImage[^"]*"[^>]*alt="([^"]+)"', b) or \
               re.search(r'title="Managed by ([^"]+)"', b) or \
               re.search(r'data-branding-name="([^"]+)"', b)
               
    print(f"Listing {lid}: agency_m ->", agency_m.group(1) if agency_m else "None")
    # print all img alts or titles in b
    alts = re.findall(r'alt="([^"]+)"', b)
    titles = re.findall(r'title="([^"]+)"', b)
    print(f"  Alts: {alts}")
    print(f"  Titles: {titles[:4]}")

