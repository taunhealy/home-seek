import sys, urllib.request, re
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from scraper.portal_resolver import resolve_p24_url
base = resolve_p24_url('Gardens').split('?')[0]

# Test 1: sp=tp%3d18000
url1 = f'{base}?sp=tp%3d18000'
req1 = urllib.request.Request(url1, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html1 = urllib.request.urlopen(req1, timeout=10).read().decode('utf-8', errors='ignore')
prices1 = [int(p) for p in re.findall(r'class="p24_price"[^>]*content="(\d+)"', html1)]
print('With sp=tp%3d18000:', len(prices1), prices1[:8], 'Max:', max(prices1) if prices1 else None)

# Test 2: ?ToPrice=18000
url2 = f'{base}?ToPrice=18000'
req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html2 = urllib.request.urlopen(req2, timeout=10).read().decode('utf-8', errors='ignore')
prices2 = [int(p) for p in re.findall(r'class="p24_price"[^>]*content="(\d+)"', html2)]
print('With ?ToPrice=18000:', len(prices2), prices2[:8], 'Max:', max(prices2) if prices2 else None)

