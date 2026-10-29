import urllib.request, re

url = 'https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117405564'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36'}
req = urllib.request.Request(url, headers=headers)
html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

# Find all image URLs and their captions
img_matches = re.findall(r'<img[^>]+src="(https://images\.prop24\.com/[^"]+)"[^>]*alt="([^"]*)"', html)
print(f"Found {len(img_matches)} images with alt:")
for idx, (src, alt) in enumerate(img_matches):
    print(f"[{idx+1}] {alt} -> {src}")

# Also check for js_carousel or json data
json_blob = re.search(r'var\s+propertyDetails\s*=\s*({.*?});', html, re.S)
if json_blob:
    print("Found propertyDetails blob")

