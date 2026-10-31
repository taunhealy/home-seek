import sys
import json
import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117772253"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.property24.com/'
}

req = urllib.request.Request(url, headers=headers)
html = urllib.request.urlopen(req, timeout=12).read().decode('utf-8', errors='ignore')

cache_file = "c:/Ryoko/Projects/home-seek/api/data/p24_cache.json"
try:
    with open(cache_file, "r", encoding="utf-8") as f:
        cache = json.load(f)
except Exception:
    cache = {}

cache[url] = {
    "timestamp": 1793440000.0,
    "html": html
}
cache["https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117772253?vn=True"] = {
    "timestamp": 1793440000.0,
    "html": html
}

with open(cache_file, "w", encoding="utf-8") as f:
    json.dump(cache, f)

print(f"SUCCESS: Cached 117772253 in {cache_file} ({len(html)} bytes)")

