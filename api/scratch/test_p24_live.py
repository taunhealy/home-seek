import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import urllib.request
import re
import json
from scraper.portal_resolver import resolve_p24_url

url = resolve_p24_url('Tamboerskloof')
print('Resolved URL:', url)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}
try:
    req = urllib.request.Request(url, headers=headers)
    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    print('HTML length:', len(html))
    tiles = re.split(r'data-listing-number="(\d+)"', html)
    print('Tiles matched:', len(tiles) // 2)
    for i in range(1, min(len(tiles), 9), 2):
        lid = tiles[i]
        block = tiles[i+1][:3000]
        p = re.search(r'class="p24_price"[^>]*>(.*?)</div>', block, re.S)
        t = re.search(r'class="p24_title[^"\']*"[^>]*>(.*?)</span>', block, re.S)
        print(lid, '| Price:', re.sub(r'<[^>]+>', '', p.group(1)).strip() if p else 'N/A', '| Title:', re.sub(r'<[^>]+>', '', t.group(1)).strip() if t else 'N/A')
except Exception as e:
    print('Direct fetch error:', e)
