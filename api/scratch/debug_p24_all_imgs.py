import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Find all lazy-src or background-image or lightbox images
all_matches = re.findall(r'https://images\.prop24\.com/(\d+)/([^\s"\'<>]+)', html)
print(f"Total prop24 matches: {len(all_matches)}")

# Filter out known non-property image patterns:
# e.g. agent photos have 'UpperCrop200x200', 'Crop200x200', 'Fit200x200'
# logos have 'Fit450x225', 'Fit150x75', 'Fit200x100'
by_id = {}
for pid, variant in all_matches:
    if pid not in by_id:
        by_id[pid] = []
    by_id[pid].append(variant)

for pid, variants in by_id.items():
    # check where this pid appears in html
    surrounding = re.findall(rf'.{{0,60}}{pid}.{{0,60}}', html)
    context = surrounding[0] if surrounding else ""
    is_agent = "agent" in context.lower() or "logo" in context.lower() or "remax" in context.lower()
    print(f"ID {pid} (agent={is_agent}): variants={variants[:2]} context: {context[:80]}")

