from bs4 import BeautifulSoup
import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}
url = "https://www.property24.com/to-rent/george/western-cape/321?sp=pr=10000%26pt=18000%26bd=1"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
tiles = soup.find_all('div', class_=lambda c: c and 'Tile' in c)
for t in tiles[:3]:
    p = t.find('div', class_='p24_price') or t.find('span', class_='p24_price')
    print("Price HTML:", p)
    if p:
        print("Price text:", repr(p.get_text()))
        match = re.search(r'R\s*([\d\s\xa0,]+)', p.get_text())
        if match:
            raw = match.group(1).replace(' ', '').replace('\xa0', '').replace(',', '')
            print("Extracted price:", raw)

