import urllib.request
import re
from typing import Dict, Any

def enrich_listing_details(item: Dict[str, Any]) -> Dict[str, Any]:
    url = item.get("url")
    if not url:
        return item
    
    try:
        req = urllib.request.Request(
            url, 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.property24.com/"}
        )
        html = urllib.request.urlopen(req, timeout=5).read().decode("utf-8", errors="ignore")
        
        # Check parking icons
        park_m = re.search(r'title="Parking Spaces"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S) or \
                 re.search(r'title="Garages"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S)
        if park_m:
            item["parking"] = int(park_m.group(1))
            
        # Check parking text
        txt = html.lower()
        if "undercover parking" in txt or "basement parking" in txt or "secure parking bay" in txt or "garage" in txt:
            if not item.get("parking"):
                item["parking"] = 1
            item["has_secure_parking"] = True
            
        # Check 24hr security
        if "24-hour security" in txt or "24hr security" in txt or "manned security" in txt:
            item["has_24hr_security"] = True
            
        # Check sqm if missing
        if not item.get("sqm"):
            size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                     re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S)
            if size_m:
                item["sqm"] = int(size_m.group(1))
                
        # Check agency on detail page if missing
        if not item.get("agency_name"):
            schema_agency = re.search(r'"@type"\s*:\s*"RealEstateAgent"\s*,\s*"name"\s*:\s*"([^"]+)"', html) or \
                            re.search(r'title="Estate Agency profile for ([^"]+)"', html)
            if schema_agency:
                item["agency_name"] = schema_agency.group(1).strip()
    except Exception as e:
        print(f"Enrich error for {url}: {e}")
        
    return item

sample_item = {
    "url": "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019",
    "parking": None
}
res = enrich_listing_details(sample_item)
print("Enriched item:", res)
