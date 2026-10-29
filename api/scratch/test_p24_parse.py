import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import urllib.request, re, html as html_lib
from scraper.portal_resolver import resolve_p24_url

url = resolve_p24_url('Tamboerskloof')
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36'})
html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

tiles = re.split(r'data-listing-number="(\d+)"', html)
for i in range(1, len(tiles), 2):
    lid = tiles[i]
    b = tiles[i+1][:3500]
    p_m = re.search(r'class="p24_price"[^>]*>(.*?)<', b) or re.search(r'R\s*[\d\s]+', b)
    title_m = re.search(r'class="p24_title"[^>]*>(.*?)<', b)
    addr_m = re.search(r'class="p24_location"[^>]*>(.*?)<', b) or re.search(r'class="p24_address"[^>]*>(.*?)<', b)
    size_m = re.search(r'class="p24_size"[^>]*>(.*?)<', b)
    link_m = re.search(r'href="(/to-rent/[^"]+' + lid + r')"', b)
    if title_m:
        print(f"ID: {lid} | Price: {p_m.group(1).strip() if p_m and hasattr(p_m, 'group') and p_m.group(1) else (p_m.group(0).strip() if p_m else '')} | Title: {title_m.group(1).strip()} | Addr: {addr_m.group(1).strip() if addr_m else ''} | Link: https://www.property24.com{link_m.group(1) if link_m else ''}")

