import urllib.request, re

url = 'https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/113106529'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36'})
html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

park = re.search(r'title="Parking Spaces"[^>]*>.*?<span>(\d+)</span>', html, re.S)
print('Parking spaces:', park.group(1) if park else 'None found in icons')

avail = re.search(r'class="p24_propertyOverviewRow"[^>]*>.*?Occupation Date.*?<div[^>]*>(.*?)</div>', html, re.S)
print('Occupation:', re.sub(r'<[^>]+>', '', avail.group(1)).strip() if avail else 'N/A')

