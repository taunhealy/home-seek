import urllib.request
from bs4 import BeautifulSoup
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

# Test searching Rondebosch on P24
url = "https://www.property24.com/to-rent/rondebosch/cape-town/western-cape/10059?sp=pr%3d12000%26pt%3d18000"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')
    tiles = soup.find_all('div', class_='p24_regularTile')
    print(f"Found {len(tiles)} listings in Rondebosch!")
    for t in tiles[:5]:
        p = t.find('div', class_='p24_price')
        title = t.find('span', class_='p24_title')
        loc = t.find('span', class_='p24_location')
        size = t.find('span', title='Floor Size')
        beds = t.find('span', title='Bedrooms')
        baths = t.find('span', title='Bathrooms')
        parking = t.find('span', title='Parking Spaces')
        img = t.find('img', class_='lazy-image') or t.find('img')
        link = t.find('a', href=True)
        img_src = img.get('lazy-src') or img.get('src') if img else ''
        href = ('https://www.property24.com' + link['href']) if link and link.get('href', '').startswith('/') else (link['href'] if link else '')
        print({
            'price': p.get_text(strip=True) if p else '',
            'title': title.get_text(strip=True) if title else '',
            'location': loc.get_text(strip=True) if loc else '',
            'size': size.get_text(strip=True) if size else '',
            'beds': beds.get_text(strip=True) if beds else '',
            'baths': baths.get_text(strip=True) if baths else '',
            'parking': parking.get_text(strip=True) if parking else '',
            'image': img_src,
            'url': href
        })
except Exception as e:
    print("Error:", e)

