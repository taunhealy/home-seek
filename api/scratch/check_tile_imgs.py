import urllib.request
import re

url = 'https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?PropertyCategory=ApartmentOrFlat&ToPrice=18000'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')

tiles = re.split(r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"', html)
if len(tiles) > 2:
    sample_tile = tiles[2][:4500]
    imgs = re.findall(r'https://images\.prop24\.com/[^\s"\'<>]+', sample_tile)
    print("Found images in tile:", len(imgs))
    for im in set(imgs):
        print("  Image:", im)

