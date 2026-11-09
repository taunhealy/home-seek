import sys
sys.path.append('api')
from services.p24_client import p24_client
from bs4 import BeautifulSoup
import re
import json

with open('api/services/.p24_live_cache.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

pats = [
    re.compile(r'\b(?:in|at|into)\s+(?:the\s+)?(?:sought-after\s+|prestigious\s+|popular\s+|secure\s+|exclusive\s+|stunning\s+|modern\s+|luxury\s+)?([A-Z][a-zA-Z0-9\s\'-]{2,30}?(?:Mansions|Court|Heights|Towers|Mews|Place|Manor|Apartments|Flats|Lofts|View|Sands|Ridge|Close|Gate|Estate|Square|Villas|Pavilion|Residences|Studios|Park|Quay|Lodge|Terrace|House))\b', re.I),
    re.compile(r'\b([A-Z][a-zA-Z0-9\s\'-]{2,25}?(?:Mansions|Court|Heights|Towers|Mews|Manor|Lofts|Sands|Ridge|Square|Villas|Pavilion|Residences|Quay|Terrace))\b'),
    re.compile(r'(?:to rent in|apartment in)\s+([A-Z][a-zA-Z0-9\s\'-]{2,30}?),\s*(?:[A-Z][a-z]+)', re.I)
]

excluded = {
    'bedroom house', 'bedroom apartment', 'bedroom flat', 'bed house',
    'bed apartment', 'guest house', 'main house', 'town house',
    'beach house', 'garden flat', 'family home', 'open plan',
    'ground floor', 'first floor', 'second floor', 'top floor'
}

matches = []
for k, val in data.items():
    items = val.get('items', []) if isinstance(val, dict) else val
    for item in items:
        addr = item.get('address', '')
        suburb = item.get('suburb', '')
        url = item.get('url', '')
        detail_html = p24_client.get_cached(url) if url else None
        desc_text = ''
        if detail_html:
            soup = BeautifulSoup(detail_html, 'html.parser')
            desc_el = soup.find(class_=re.compile(r'p24_description|js_readMoreText', re.I))
            if desc_el:
                desc_text = desc_el.get_text(' ', strip=True)

        full_text = f"{item.get('title', '')} {desc_text}"
        for pat in pats:
            m = pat.search(full_text)
            if m:
                cand = m.group(1).strip()
                cand_clean = re.sub(r'^(?:a|an|the|this|that|in|at)\s+', '', cand, flags=re.I).strip()
                if cand_clean.lower() not in excluded and len(cand_clean) > 3 and not cand_clean.lower().startswith('bedroom') and not cand_clean.lower().startswith('ground'):
                    matches.append({
                        'id': item.get('id'),
                        'suburb': suburb,
                        'building': cand_clean,
                        'current_address': addr,
                        'title': item.get('title')
                    })
                    break

print(f'Total extracted building matches: {len(matches)}')
for m in matches[:25]:
    print(f"[{m['suburb']}] {m['building']} (Current: {m['current_address']})")

