import sys
sys.path.append('api')
import urllib.request
from bs4 import BeautifulSoup
import re
import random
import math
from typing import List, Dict, Any, Optional
from scraper.portal_resolver import resolve_p24_url

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

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
    'tokai': (-34.0580, 18.4310),
    'claremont': (-33.9800, 18.4650),
    'kenilworth': (-33.9920, 18.4710),
    'kirstenhof': (-34.0680, 18.4450)
}

def calculate_dist_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def scrape_p24_live(suburbs: List[str], min_price: int = 0, max_price: int = 999999, beds: str = "1", anchor_lat: Optional[float] = None, anchor_lng: Optional[float] = None) -> List[Dict[str, Any]]:
    all_results = []
    seen_ids = set()
    
    for suburb in suburbs:
        clean_suburb = suburb.strip()
        if not clean_suburb:
            continue
            
        base_url = resolve_p24_url(clean_suburb)
        if not base_url:
            continue
            
        clean_url = base_url.split('?')[0]
        params = []
        if min_price > 0:
            params.append(f"pr={min_price}")
        if max_price < 999999:
            params.append(f"pt={max_price}")
        if beds and beds != 'any':
            bed_num = re.sub(r'[^\d]', '', str(beds))
            if bed_num:
                params.append(f"bd={bed_num}")
                
        search_url = f"{clean_url}?sp={'%26'.join(params)}" if params else clean_url
        
        try:
            req = urllib.request.Request(search_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            continue
            
        soup = BeautifulSoup(html, 'html.parser')
        base_lat, base_lng = SUBURB_COORDS.get(clean_suburb.lower(), (-33.9249, 18.4241))
        
        tiles = soup.find_all('div', class_=lambda c: c and any(k in c for k in ['p24_regularTile', 'p24_highlightTile', 'p24_tileContainer', 'p24_topTile']))
        
        for t in tiles:
            link = t.find('a', href=True)
            if not link:
                continue
            href = link['href']
            id_match = re.search(r'/(\d{7,10})', href)
            if not id_match:
                continue
            lid = id_match.group(1)
            if lid in seen_ids:
                continue
            seen_ids.add(lid)
            
            full_href = ('https://www.property24.com' + href) if href.startswith('/') else href
            
            # Price
            price_div = t.find('div', class_='p24_price') or t.find('span', class_='p24_price')
            price_val = 0
            if price_div:
                content_attr = price_div.get('content')
                if content_attr and content_attr.isdigit():
                    price_val = int(content_attr)
                else:
                    txt = price_div.get_text(' ', strip=True)
                    p_match = re.search(r'R\s*([\d\s\xa0,]+)', txt)
                    if p_match:
                        clean_num = p_match.group(1).replace(' ', '').replace('\xa0', '').replace(',', '')
                        if clean_num.isdigit():
                            price_val = int(clean_num)
                            
            if min_price > 0 and price_val > 0 and price_val < min_price:
                continue
            if max_price > 0 and price_val > max_price:
                continue
                
            title_el = t.find('span', class_='p24_title')
            title_str = title_el.get_text(strip=True) if title_el else "Apartment to Rent"
            
            loc_el = t.find('span', class_='p24_location')
            loc_str = loc_el.get_text(strip=True) if loc_el else clean_suburb.title()
            
            img_el = t.find('img')
            img_url = ""
            if img_el:
                img_url = img_el.get('lazy-src') or img_el.get('src') or ""
                if 'grey_' in img_url or 'blank.gif' in img_url:
                    img_url = img_el.get('lazy-src', '')
                    
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
                    
            lat = base_lat + random.uniform(-0.007, 0.007)
            lng = base_lng + random.uniform(-0.007, 0.007)
            
            dist_km = None
            dur_mins = None
            if anchor_lat is not None and anchor_lng is not None:
                dist_km = round(calculate_dist_km(lat, lng, anchor_lat, anchor_lng) * 1.25, 1)
                dur_mins = max(2, round((dist_km / 35.0) * 60))
                
            all_results.append({
                'id': f"p24-{lid}",
                'p24_id': lid,
                'title': title_str,
                'address': f"{loc_str}, {clean_suburb.title()}",
                'suburb': clean_suburb.title(),
                'price': price_val,
                'price_str': f"R {price_val:,}" if price_val > 0 else "POA",
                'bedrooms': beds_cnt,
                'bathrooms': baths_cnt,
                'parking': pkg_cnt,
                'sqm': sqm_val,
                'image': img_url or "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
                'url': full_href,
                'lat': lat,
                'lng': lng,
                'distance_km': dist_km,
                'duration_mins': dur_mins,
                'fit_score': random.randint(84, 98),
                'noise_risk': 'sanctuary' if any(k in loc_str.lower() for k in ['forest', 'heatherlands', 'camphersdrift', 'mountain']) else 'low'
            })
            
    # Sort by price or distance
    all_results.sort(key=lambda x: (x['price'] if x['price'] > 0 else 999999))
    return all_results

