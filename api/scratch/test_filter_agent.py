import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

def extract_property_photos(html_text: str):
    # Strategy 1: Find all IDs from data-lightbox-src="https://images.prop24.com/(\d+)"
    # and data-image-url="https://images.prop24.com/(\d+)"
    lightbox_ids = re.findall(r'data-(?:lightbox-src|image-url)="https://images\.prop24\.com/(\d+)', html_text)
    
    # Strategy 2: Find all from alt="Listing number:[^"]*, Image number: (\d+)"
    # with lazy-src or src containing the id
    listing_img_ids = re.findall(r'alt="Listing number:[^"]*"[^>]*(?:lazy-src|src)="https://images\.prop24\.com/(\d+)', html_text)

    # Strategy 3: rel="photo[pp_gal]" href="https://images.prop24.com/(\d+)"
    gal_href_ids = re.findall(r'rel="photo\[pp_gal\]"[^>]*href="https://images\.prop24\.com/(\d+)', html_text)
    
    # Combine preserving order
    all_pids = []
    seen = set()
    for pid in lightbox_ids + listing_img_ids + gal_href_ids:
        if pid not in seen:
            seen.add(pid)
            all_pids.append(pid)

    # Secondary check: exclude any PID that belongs to an agent photo or agency logo
    # Specifically, look for agentPhoto, RealEstateAgent, etc.
    agent_pids = set(re.findall(r'(?:agentPhoto|RealEstateAgent|agent-profile|agent-image)[^>]*https://images\.prop24\.com/(\d+)', html_text))
    agent_pids.update(re.findall(r'https://images\.prop24\.com/(\d+)/[^\s"\'<>]*(?:UpperCrop|Fit450|Fit200|Fit150)', html_text))
    
    clean_photos = [f"https://images.prop24.com/{pid}/Crop600x400" for pid in all_pids if pid not in agent_pids]
    return clean_photos

photos = extract_property_photos(html)
print(f"Extracted {len(photos)} clean property photos (Agent photos excluded):")
for idx, p in enumerate(photos):
    print(f"  [{idx+1}] {p}")

