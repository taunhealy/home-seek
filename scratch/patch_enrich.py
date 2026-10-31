with open('api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        if any(k in txt for k in ["24-hour security", "24hr security", "manned security"]):
            item["has_24hr_security"] = True"""

replacement = """        if any(k in txt for k in ["24-hour security", "24hr security", "manned security"]):
            item["has_24hr_security"] = True

        # Extract Elevator & Floor cues
        if "elevator" in txt or ("lift" in txt and "short walk" not in txt):
            item["has_lift"] = "yes"
        elif "no lift" in txt or "stairs only" in txt:
            item["has_lift"] = "no"

        floor_m = re.search(r'\\b(ground|1st|2nd|3rd|4th|first|second|third|fourth|top)\\s+floor\\b', txt)
        if floor_m:
            item["floor_number"] = floor_m.group(0)"""

text_norm = text.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in text_norm:
    text_norm = text_norm.replace(target_norm, replacement_norm)
    with open('api/services/ai_scout.py', 'w', encoding='utf-8') as f:
        f.write(text_norm)
    print("SUCCESS: Floor and lift extraction added to enrich_candidate_listing")
else:
    print("TARGET NOT FOUND")

