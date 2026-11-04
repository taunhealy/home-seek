import urllib.request
from bs4 import BeautifulSoup
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}
url = "https://www.property24.com/to-rent/rondebosch/cape-town/western-cape/10059"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
tiles = soup.find_all('div', class_='p24_tileContainer')
print(f"Total p24_tileContainer: {len(tiles)}")
for i, t in enumerate(tiles[:10]):
    # Price
    price_div = t.find('div', class_='p24_price')
    price_str = price_div.find(text=True, recursive=False).strip() if price_div else ""
    # Title / Desc
    title_span = t.find('span', class_='p24_title')
    title_str = title_span.get_text(strip=True) if title_span else ""
    # Location / Address
    loc_span = t.find('span', class_='p24_location')
    loc_str = loc_span.get_text(strip=True) if loc_span else ""
    # Link
    link = t.find('a', href=True)
    href = ('https://www.property24.com' + link['href']) if link and link.get('href', '').startswith('/') else ""
    # Img
    img = t.find('img')
    img_url = img.get('lazy-src') or img.get('src') if img else ""
    # Features
    beds = t.find('span', title='Bedrooms')
    baths = t.find('span', title='Bathrooms')
    parkings = t.find('span', title='Parking Spaces')
    sqm = t.find('span', title='Floor Size')
    
    print(f"[{i+1}] {price_str} | {title_str} | {loc_str} | Beds:{beds.get_text(strip=True) if beds else '-'} Baths:{baths.get_text(strip=True) if baths else '-'} Pkg:{parkings.get_text(strip=True) if parkings else '-'} Sqm:{sqm.get_text(strip=True) if sqm else '-'}")
    print(f"    Link: {href}")
    print(f"    Img: {img_url}")

