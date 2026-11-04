import urllib.request
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}
url = "https://www.property24.com/to-rent/rondebosch/cape-town/western-cape/10059"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
tiles = soup.find_all('div', class_=lambda c: c and 'Tile' in c)
print(f"Total tile-like divs: {len(tiles)}")
if tiles:
    t = tiles[0]
    print("Tile classes:", t.get('class'))
    print("Tile price element:", t.find_all(class_=lambda c: c and 'price' in c.lower()))
    print("Tile text snippet:\n", t.get_text(strip=True)[:250])

