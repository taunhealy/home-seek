import urllib.request
import re

url = 'https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/113106529'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')

# Extract all prop24 photos
photos = re.findall(r'https://images\.prop24\.com/\d+/[^\s"\'<>]+', html)
# Clean and dedupe by photo ID
photo_ids = {}
for p in photos:
    m = re.search(r'https://images\.prop24\.com/(\d+)', p)
    if m:
        pid = m.group(1)
        if pid not in photo_ids:
            # High-res or crop
            photo_ids[pid] = f"https://images.prop24.com/{pid}/Crop600x400"

print(f"Total unique photos found on listing detail page: {len(photo_ids)}")
for pid, purl in list(photo_ids.items())[:8]:
    print(f"  {pid}: {purl}")

