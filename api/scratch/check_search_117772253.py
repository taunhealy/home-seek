import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?ToPrice=18000&FromPrice=12000&sp=bd1&PropertyCategory=ApartmentOrFlat"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.property24.com/'
}
req = urllib.request.Request(url, headers=headers)
html = urllib.request.urlopen(req, timeout=12).read().decode('utf-8', errors='ignore')

print("Search URL fetched, html length:", len(html))
print("Does search result contain 117772253?", "117772253" in html)

matches = re.findall(r'117772253', html)
print("Occurrences of 117772253 in search results:", len(matches))

