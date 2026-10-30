import urllib.request, re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.property24.com/"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Search for agency branding in detail page
print("Agency branding matches in 114409019:")
for m in re.finditer(r'.{0,40}(?:agency|re/max|remax|rawson|watchprop|seeff|agent).{0,40}', html, re.I):
    txt = m.group(0).strip()
    if any(k in txt.lower() for k in ["re/max", "remax", "living", "watchprop", "rawson", "agency"]):
        print("  ->", txt)

# Check Schema.org RealEstateAgent
agent_json = re.findall(r'\{[^{}]*"@type"\s*:\s*"(?:RealEstateAgent|Organization)"[^{}]*\}', html)
print("\nSchema RealEstateAgent JSON:")
for a in agent_json:
    print("  ->", a)

# Check agency logo images
agency_logos = re.findall(r'<img[^>]*alt="([^"]*)"[^>]*(?:Fit450x225|Fit200x100|agency)[^>]*>', html, re.I) or \
               re.findall(r'<img[^>]*(?:Fit450x225|Fit200x100)[^>]*alt="([^"]*)"[^>]*>', html, re.I)
print("\nAgency logo images:", agency_logos)

# Check agent block
agent_block = re.findall(r'class="p24_agent(?:Details|Card|Name)"[^>]*>(.*?)</div>', html, re.S)
print("\nAgent block text:")
for ab in agent_block:
    print("  ->", re.sub(r'<[^>]+>', ' ', ab).strip())

