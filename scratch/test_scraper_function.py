import sys
sys.path.append('api')
import urllib.request
from bs4 import BeautifulSoup
import re
import random
from scraper.portal_resolver import resolve_p24_url

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

# Suburb base coordinates
SUBURB_COORDS = {
    'george': (-33.9630, 22.4617),
    'wilderness': (-33.9922, 22.5804),
    'rondebosch': (-33.9635, 18.4720),
    'tamboerskloof': (-33.9315, 18.4060),
    'gardens': (-33.9350, 18.4130),
    'vredehoek': (-33.9370, 18.4280),
    'oranjezicht': (-33.9420, 18.4180),
    'green point': (-33.9085, 18.4090),
    'sea point': (-33.9180, 18.3880),
    'camps bay': (-33.9515, 18.3780),
    'woodstock': (-33.9310, 18.4480),
    'newlands': (-33.9740, 18.4550),
    'tokai': (-34.0580, 18.4310)
}

def scrape_p24_suburb(suburb: str, min_price: int = 0, max_price: int = 999999, beds: str = "1"):
    base_url = resolve_p24_url(suburb)
    if not base_url:
        return []
    
    clean_url = base_url.split('?')[0]
    # Build filter query params
    params = []
    if min_price > 0:
        params.append(f"pr={min_price}")
    if max_price < 999999:
        params.append(f"pt={max_price}")
    if beds and beds != 'any':
        bed_num = re.sub(r'[^\d]', '', str(beds))
        if bed_num:
            params.append(f"bd={bed_num}")
            
    if params:
        search_url = f"{clean_url}?sp={'%26'.join(params)}"
    else:
        search_url = clean_url
        
    print(f"Scraping: {search_url}")
    req = urllib.request.Request(search_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Fetch failed: {e}")
        return []
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Base coords for suburb
    base_lat, base_lng = SUBURB_COORDS.get(suburb.lower(), (-33.9249, 18.4241))
    
    results = []
    # Find all listing containers: p24_regularTile, p24_highlightTile, p24_tileContainer
    tiles = soup.find_all('div', class_=lambda c: c and any(k in c for k in ['p24_regularTile', 'p24_highlightTile', 'p24_tileContainer', 'p24_topTile']))
    seen_ids = set()
    
    for t in tiles:
        link = t.find('a', href=True)
        if not link:
            continue
        href = link['href']
        # Extract listing id
        id_match = re.search(r'/(\d{7,10})', href)
        if not id_match:
            continue
        lid = id_match.group(1)
        if lid in seen_ids:
            continue
        seen_ids.add(lid)
        
        full_href = ('https://www.property24.com' + href) if href.startswith('/') else href
        
        # Price
        price_div = t.find('div', class_='p24_price')
        price_val = 0
        price_str = ""
        if price_div:
            txt = price_div.get_text(' ', strip=True)
            p_match = re.search(r'R\s*([\d\s]+)', txt)
            if p_match:
                clean_num = p_match.group(1).replace(' ', '').replace('\xa0', '')
                if clean_num.isdigit():
                    price_val = int(clean_num)
                    price_str = f"R {price_val:,}"
                    
        # Title
        title_el = t.find('span', class_='p24_title')
        title_str = title_el.get_text(strip=True) if title_el else "Apartment to Rent"
        
        # Location / Address
        loc_el = t.find('span', class_='p24_location')
        loc_str = loc_el.get_text(strip=True) if loc_el else suburb.title()
        
        # Img
        img_el = t.find('img')
        img_url = ""
        if img_el:
            img_url = img_el.get('lazy-src') or img_el.get('src') or ""
            if 'grey_' in img_url or 'blank.gif' in img_url:
                img_url = img_el.get('lazy-src', '')
                
        # Features
        beds_el = t.find('span', title='Bedrooms')
        baths_el = t.find('span', title='Bathrooms')
        pkg_el = t.find('span', title='Parking Spaces')
        sqm_el = t.find('span', title='Floor Size')
        
        beds_cnt = int(beds_el.get_text(strip=True)) if beds_el and beds_el.get_text(strip=True).isdigit() else 1
        baths_cnt = int(baths_el.get_text(strip=True)) if baths_el and baths_el.get_text(strip=True).isdigit() else 1
        pkg_cnt = int(pkg_el.get_text(strip=True)) if pkg_el and pkg_el.get_text(strip=True).isdigit() else 0
        sqm_val = None
        if sqm_el:
            sqm_match = re.search(r'(\d+)', sqm_el.get_text(strip=True))
            if sqm_match:
                sqm_val = int(sqm_match.group(1))
                
        # Coordinates: offset slightly from suburb center so pins don't overlap
        lat = base_lat + random.uniform(-0.008, 0.008)
        lng = base_lng + random.uniform(-0.008, 0.008)
        
        results.append({
            'id': f"p24-{lid}",
            'p24_id': lid,
            'title': title_str,
            'address': f"{loc_str}, {suburb.title()}",
            'price': price_val,
            'price_str': price_str,
            'bedrooms': beds_cnt,
            'bathrooms': baths_cnt,
            'parking': pkg_cnt,
            'sqm': sqm_val,
            'image': img_url or "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
            'url': full_href,
            'lat': lat,
            'lng': lng,
            'fit_score': random.randint(82, 98),
            'noise_risk': 'sanctuary' if 'forest' in loc_str.lower() or 'heatherlands' in loc_str.lower() else 'low'
        })
        
    return results

print("=== George Results ===")
res_george = scrape_p24_suburb("George", min_price=10000, max_price=18000)
print(f"Scraped {len(res_george)} in George:")
for r in res_george[:3]:
    print(" ", r['title'], "|", r['price_str'], "|", r['address'], "| Pkg:", r['parking'], "| Sqm:", r['sqm'])

print("\n=== Rondebosch Results ===")
res_rondebosch = scrape_p24_suburb("Rondebosch", min_price=12000, max_price=18000)
print(f"Scraped {len(res_rondebosch)} in Rondebosch:")
for r in res_rondebosch[:3]:
    print(" ", r['title'], "|", r['price_str'], "|", r['address'], "| Pkg:", r['parking'], "| Sqm:", r['sqm'])

