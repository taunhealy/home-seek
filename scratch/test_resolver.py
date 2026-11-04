import sys
sys.path.append('api')
from scraper.portal_resolver import resolve_p24_url

for q in ["George", "Rondebosch", "Tamboerskloof", "Wilderness", "Gardens"]:
    print(f"{q:15} -> {resolve_p24_url(q)}")
