with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)
    if 'item["sqm"] = int(size_m.group(1))' in line:
        new_lines.append("""
        # Check Agency Name & Reputation
        if not item.get("agency_name"):
            agency_schema = re.search(r'\\{[^{}]*"@type"\\s*:\\s*"(?:RealEstateAgent|Organization)"[^{}]*"name"\\s*:\\s*"([^"]+)"', html)
            if agency_schema:
                item["agency_name"] = agency_schema.group(1).strip()
            else:
                m_agency = re.search(r'"agencyName"\\s*:\\s*"([^"]+)"', html) or \\
                           re.search(r'class="[^"]*p24_agencyLogoName[^"]*"[^>]*>\\s*<span>([^<]+)</span>', html, re.S) or \\
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
                item["agency_hellopeter_rating"] = rep.get("hellopeter_rating")
""")

with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Inserted agency extraction into ai_scout.py!")

