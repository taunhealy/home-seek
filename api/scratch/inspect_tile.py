import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import urllib.request, re
from scraper.portal_resolver import resolve_p24_url

url = resolve_p24_url('Tamboerskloof')
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36'})
html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

# Inspect raw html snippet around data-listing-number
idx = html.find('data-listing-number="117767952"')
if idx != -1:
    print(html[idx:idx+1500])
else:
    print("Listing not found, searching for first data-listing-number:")
    m = re.search(r'data-listing-number="(\d+)"', html)
    if m:
        p = m.start()
        print(html[p:p+1500])

