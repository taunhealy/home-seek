import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import urllib.request, re, html as html_lib

def fetch_p24_listings(area: str, max_price: int = None, min_price: int = None, bedrooms: str = None, property_type: str = None):
    from scraper.portal_resolver import resolve_p24_url
    base_url = resolve_p24_url(area)
    if not base_url:
        return []
    
    url = base_url.split('?')[0]
    params = []
    if max_price:
        params.append(f"ToPrice={max_price}")
    if min_price:
        params.append(f"FromPrice={min_price}")
    if property_type and property_type.lower() in ['apartment', 'flat', 'apartmentorflat']:
        params.append("PropertyCategory=ApartmentOrFlat")
    elif property_type and property_type.lower() in ['house']:
        params.append("PropertyCategory=House")
    elif property_type and property_type.lower() in ['townhouse']:
        params.append("PropertyCategory=Townhouse")
        
    if params:
        url += '?' + '&'.join(params)
    
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    })
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []
        
    # Split on the regular tile wrapper with data-listing-number
    pattern = r'<div[^>]*class="[^"]*p24_regularTile[^"]*"[^>]*data-listing-number="(\d+)"'
    tiles = re.split(pattern, html)
    listings = []
    seen = set()
    for i in range(1, len(tiles), 2):
        lid = tiles[i]
        if lid in seen:
            continue
        seen.add(lid)
        b = tiles[i+1][:3500]
        
        # Extract fields
        p_m = re.search(r'class="p24_price"[^>]*content="(\d+)"', b)
        price = int(p_m.group(1)) if p_m else None
        if not price:
            p_text = re.search(r'class="p24_price"[^>]*>(.*?)</span>', b, re.S)
            if p_text:
                nums = re.sub(r'[^\d]', '', p_text.group(1))
                price = int(nums) if nums else None
                
        title_m = re.search(r'class="p24_title[^"]*"[^>]*>(.*?)</span>', b, re.S)
        title = html_lib.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip() if title_m else ""
        
        loc_m = re.search(r'class="p24_location[^"]*"[^>]*>(.*?)</span>', b, re.S)
        loc = html_lib.unescape(re.sub(r'<[^>]+>', '', loc_m.group(1))).strip() if loc_m else area
        
        addr_m = re.search(r'class="p24_address[^"]*"[^>]*>(.*?)</span>', b, re.S)
        addr = html_lib.unescape(re.sub(r'<[^>]+>', '', addr_m.group(1))).strip() if addr_m else ""
        
        exc_m = re.search(r'class="p24_excerpt"[^>]*title="([^"]+)"', b) or re.search(r'class="p24_excerpt"[^>]*>(.*?)</span>', b, re.S)
        desc = html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', exc_m.group(1)))).strip() if exc_m else ""
        
        img_m = re.search(r'src="(https://images\.prop24\.com/[^"]+)"', b)
        img = img_m.group(1) if img_m else ""
        
        size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', b, re.S)
        sqm = int(size_m.group(1)) if size_m else None
        
        beds_m = re.search(r'title="Bedrooms"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
        beds = float(beds_m.group(1)) if beds_m else None
        
        baths_m = re.search(r'title="Bathrooms"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
        baths = float(baths_m.group(1)) if baths_m else None
        
        park_m = re.search(r'title="Parking Spaces"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', b, re.S)
        park = int(park_m.group(1)) if park_m else None
        
        avail_m = re.search(r'class="p24_badgeSupplemental">([^<]+)</span>', b)
        avail = avail_m.group(1).strip() if avail_m else None
        
        link = f"https://www.property24.com/to-rent/{area.lower().replace(' ', '-')}/cape-town/western-cape/9163/{lid}"
        link_m = re.search(r'href="(/to-rent/[^"]+/' + lid + r')"', b)
        if link_m:
            link = f"https://www.property24.com{link_m.group(1)}"
            
        listings.append({
            "id": f"p24-{lid}",
            "listing_id": lid,
            "title": title or f"Property in {area}",
            "address": f"{addr}, {loc}" if addr else loc,
            "price": price,
            "bedrooms": beds,
            "bathrooms": baths,
            "sqm": sqm,
            "parking": park,
            "available_date": avail,
            "description": desc,
            "image": img,
            "url": link,
            "area": area
        })
    return listings

if __name__ == '__main__':
    items = fetch_p24_listings('Tamboerskloof', max_price=18000, property_type='Apartment')
    print(f"Scraped {len(items)} listings:")
    for it in items[:5]:
        print(it['listing_id'], '| R', it['price'], '|', it['title'], '|', it['address'], '| Beds:', it['bedrooms'], '| Sqm:', it['sqm'], '| Park:', it['parking'])
