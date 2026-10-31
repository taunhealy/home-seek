import re

path = 'c:/Ryoko/Projects/home-seek/api/services/ai_scout.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update image extraction in scrape_portal_listings
old_img = r'img_m = re\.search\(r\'src="\(https://images\\\.prop24\\\.com/\[\^"\]\+\)"\', b\)'
new_img = r'img_m = re.search(r\'(?:lazy-src|data-original|data-image-url|data-lightbox-src|src)="(https://images\\.prop24\\.com/[^"]+)"\', b)'
code, c1 = re.subn(old_img, new_img, code)
print('c1 (img_m):', c1)

# 2. Update database fallback and strict candidate filtering
old_fallback_and_filter = r'# Fallback to database registry if portal returned 0 \(e\.g\. anti-bot/503\).*?candidates = candidates\[:12\]'

new_fallback_and_filter = '''# Fallback to database registry if portal returned 0 (e.g. anti-bot/503)
        if not raw_listings:
            try:
                from services.database import get_db
                db = get_db()
                if db:
                    docs = db.collection("listings").limit(400).stream()
                    for d in docs:
                        l_data = d.to_dict()
                        l_addr = (str(l_data.get("address", "")) + " " + str(l_data.get("location", "")) + " " + str(l_data.get("title", ""))).lower()
                        if any(a.lower() in l_addr for a in prefs.areas):
                            if prefs.max_price and l_data.get("price") and l_data.get("price") > prefs.max_price:
                                continue
                            imgs = l_data.get("images") or l_data.get("image_urls") or []
                            first_img = imgs[0] if isinstance(imgs, list) and imgs else (l_data.get("image") or "")
                            raw_listings.append({
                                "id": d.id,
                                "listing_id": d.id,
                                "title": l_data.get("title") or "Rental Property",
                                "address": l_data.get("address") or l_data.get("location") or "Cape Town",
                                "price": l_data.get("price"),
                                "bedrooms": l_data.get("bedrooms"),
                                "bathrooms": l_data.get("bathrooms"),
                                "sqm": l_data.get("sqm"),
                                "parking": l_data.get("parking"),
                                "is_furnished": l_data.get("is_furnished"),
                                "description": l_data.get("description") or "",
                                "image": first_img,
                                "images": imgs if isinstance(imgs, list) else [],
                                "url": l_data.get("source_url") or l_data.get("url") or "",
                                "area": prefs.areas[0] if prefs.areas else "Cape Town",
                                "agency_name": l_data.get("agency_name"),
                                "is_direct_landlord": l_data.get("is_direct_landlord", False)
                            })
            except Exception as e:
                print(f"[SCOUT REGISTRY FALLBACK ERROR] {e}")

        # 2. Strict Hard filter: budget ceiling & minimum bedrooms floor are inviolable
        candidates = []
        for it in raw_listings:
            # Strict budget ceiling
            if prefs.max_price and it.get("price"):
                try:
                    if float(it["price"]) > float(prefs.max_price):
                        continue
                except Exception:
                    pass
            # Strict minimum bedrooms floor
            if prefs.min_bedrooms is not None:
                beds = it.get("bedrooms")
                if beds is not None:
                    try:
                        if float(beds) < float(prefs.min_bedrooms):
                            continue
                    except Exception:
                        pass
                elif float(prefs.min_bedrooms) >= 1.0:
                    t_lower = (it.get("title") or "").lower()
                    if any(w in t_lower for w in ["0.5 bed", "studio", "bachelor", "room to rent"]):
                        continue
            if prefs.must_have_parking and (it.get("parking") is not None and it["parking"] == 0):
                continue
            candidates.append(it)

        # Limit to top 12 candidates for the LLM
        candidates = candidates[:12]'''

code, c2 = re.subn(old_fallback_and_filter, lambda m: new_fallback_and_filter, code, flags=re.DOTALL)
print('c2 (fallback and filter):', c2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Successfully saved ai_scout.py')

