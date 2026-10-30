with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "r", encoding="utf-8") as f:
    content = f.read()

target = """        if not item.get("sqm"):
            schema_size = re.search(r'"floorSize"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
            if schema_size:
                item["sqm"] = int(schema_size.group(1))
            else:
                size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'(\d+)\s*m²\s*(?:apartment|flat|unit|floor|property)', html, re.I)
                if size_m:
                    item["sqm"] = int(size_m.group(1))"""

replacement = """        if not item.get("sqm"):
            schema_size = re.search(r'"floorSize"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
            if schema_size:
                item["sqm"] = int(schema_size.group(1))
            else:
                size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'(\d+)\s*m²\s*(?:apartment|flat|unit|floor|property)', html, re.I)
                if size_m:
                    item["sqm"] = int(size_m.group(1))

        # Check Agency Name & Reputation
        if not item.get("agency_name"):
            agency_schema = re.search(r'\{[^{}]*"@type"\s*:\s*"(?:RealEstateAgent|Organization)"[^{}]*"name"\s*:\s*"([^"]+)"', html)
            if agency_schema:
                item["agency_name"] = agency_schema.group(1).strip()
            else:
                m_agency = re.search(r'"agencyName"\s*:\s*"([^"]+)"', html) or \
                           re.search(r'class="[^"]*p24_agencyLogoName[^"]*"[^>]*>\s*<span>([^<]+)</span>', html, re.S) or \
                           re.search(r'alt="Property to rent by ([^"]+)"', html)
                if m_agency:
                    item["agency_name"] = m_agency.group(1).strip()

        if item.get("agency_name") and not item.get("agency_rating"):
            from services.agency_reputation import lookup_agency_reputation
            rep = lookup_agency_reputation(item["agency_name"])
            if rep:
                item["agency_rating"] = rep.get("google_rating")
                item["agency_review_count"] = rep.get("google_review_count")
                item["agency_risk_level"] = rep.get("risk_level", "low")
                item["agency_flags"] = rep.get("flags", [])
                item["agency_complaint_sample"] = rep.get("recent_complaint_sample")
                item["agency_url"] = rep.get("google_reviews_url")
                item["agency_hellopeter_rating"] = rep.get("hellopeter_rating")"""

if target in content and "lookup_agency_reputation" not in content:
    content = content.replace(target, replacement, 1)
    with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched enrich_candidate_listing with agency reputation!")
else:
    print("Target not found or already patched")

