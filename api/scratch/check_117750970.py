import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117750970"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

title_m = re.search(r"<title>(.*?)</title>", html)
title = title_m.group(1) if title_m else ""

addr_m = re.search(r'class="p24_address"[^>]*>(.*?)</div>', html, re.S) or re.search(r'class="p24_maptitle"[^>]*>(.*?)</span>', html, re.S)
addr = re.sub(r"<[^>]+>", "", addr_m.group(1)).strip() if addr_m else ""

desc_m = re.search(r'class="p24_description"[^>]*>(.*?)</div>', html, re.S) or re.search(r'name="description"\s+content="([^"]+)"', html)
desc = desc_m.group(1) if desc_m else ""

print("Listing 117750970:")
print("Title:", title)
print("Address:", addr)
print("Description excerpt:", desc[:300])

from services.ai_scout import analyze_acoustic_risk
audit = analyze_acoustic_risk(addr, desc)
print("\nAcoustic Audit Result:", audit)

