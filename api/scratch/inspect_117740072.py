import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117740072"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

title_m = re.search(r"<title>(.*?)</title>", html)
title = title_m.group(1) if title_m else ""

price_m = re.search(r'class="p24_price"[^>]*content="(\d+)"', html) or re.search(r'class="p24_price"[^>]*>(.*?)</span>', html, re.S)
price = price_m.group(1) if price_m else ""

addr_m = re.search(r'class="p24_address"[^>]*>(.*?)</div>', html, re.S) or re.search(r'class="p24_maptitle"[^>]*>(.*?)</span>', html, re.S)
addr = re.sub(r"<[^>]+>", "", addr_m.group(1)).strip() if addr_m else ""

photos = re.findall(r"https://images\.prop24\.com/(\d+)/[^\s\"\'<>]+", html)
unique_photos = list(dict.fromkeys(photos))

print(f"Listing 117740072:")
print(f"Title: {title}")
print(f"Price: {price}")
print(f"Address: {addr}")
print(f"Total Unique Photos: {len(unique_photos)}")
for pid in unique_photos[:5]:
    print(f"  Photo ID: {pid} -> https://images.prop24.com/{pid}/Crop600x400")

