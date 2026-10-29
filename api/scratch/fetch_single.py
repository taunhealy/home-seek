import urllib.request
import re
import html as html_lib

url = 'https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117405564'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}
req = urllib.request.Request(url, headers=headers)
raw = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

title = re.search(r'<title>(.*?)</title>', raw, re.S)
print('Title:', html_lib.unescape(title.group(1).strip()) if title else '')

price = re.search(r'class="p24_price"[^>]*>(.*?)</div>', raw, re.S)
if price:
    print('Price:', html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', price.group(1))).strip()))

desc = re.search(r'class="js_readMoreText[^"]*"[^>]*>(.*?)</div>', raw, re.S)
if desc:
    print('FULL DESC:', html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', desc.group(1))).strip()))

for m in re.finditer(r'class="p24_propertyOverviewRow"[^>]*>(.*?)</div>\s*</div>\s*</div>', raw, re.S):
    row_txt = html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(1))).strip())
    print('Row:', row_txt)
