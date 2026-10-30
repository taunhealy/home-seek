import re

with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
if "from services.building_reviews import" not in content:
    content = "from services.building_reviews import extract_building_name, get_building_reviews\n" + content

# 2. Add fields to ScoutListingRank
old_model_end = """    price_value_pct: Optional[int] = Field(None, description="Percentage over or under fair market median (e.g. -12 for 12% underpriced)")"""

new_model_end = """    price_value_pct: Optional[int] = Field(None, description="Percentage over or under fair market median (e.g. -12 for 12% underpriced)")
    floor_number: Optional[str] = None
    has_lift: Optional[str] = Field("unknown", description="'yes', 'no', 'unknown', or 'N/A (Ground)'")
    building_name: Optional[str] = None
    pro_report: Optional[Dict[str, Any]] = None"""

content = content.replace(old_model_end, new_model_end, 1)

# 3. Enhance enrich_candidate_listing
old_enrich = """        if not item.get("sqm"):
            schema_size = re.search(r'"floorSize"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
            if schema_size:
                item["sqm"] = int(schema_size.group(1))
            else:
                size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'(\d+)\s*m²\s*(?:apartment|flat|unit|floor|property)', html, re.I)
                if size_m:
                    item["sqm"] = int(size_m.group(1))
    except Exception:
        pass
    return item"""

new_enrich = """        if not item.get("sqm"):
            schema_size = re.search(r'"floorSize"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
            if schema_size:
                item["sqm"] = int(schema_size.group(1))
            else:
                size_m = re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
                         re.search(r'(\d+)\s*m²\s*(?:apartment|flat|unit|floor|property)', html, re.I)
                if size_m:
                    item["sqm"] = int(size_m.group(1))

        # Extract Floor Level
        if not item.get("floor_number"):
            if re.search(r'\\bground\\s*floor\\b|\\bground\\s*level\\b', txt):
                item["floor_number"] = "Ground Floor"
            elif re.search(r'\\b1st\\s*floor\\b|\\bfirst\\s*floor\\b', txt):
                item["floor_number"] = "1st Floor"
            elif re.search(r'\\b2nd\\s*floor\\b|\\bsecond\\s*floor\\b', txt):
                item["floor_number"] = "2nd Floor"
            elif re.search(r'\\b3rd\\s*floor\\b|\\bthird\\s*floor\\b', txt):
                item["floor_number"] = "3rd Floor"
            elif re.search(r'\\b4th\\s*floor\\b|\\bfourth\\s*floor\\b', txt):
                item["floor_number"] = "4th Floor"
            elif re.search(r'\\btop\\s*floor\\b|\\bpenthouse\\b', txt):
                item["floor_number"] = "Top Floor"
            elif fl_m := re.search(r'\\b(\\d+)(?:st|nd|rd|th)\\s*floor\\b', txt):
                item["floor_number"] = f"{fl_m.group(1)}th Floor"

        # Extract Lift / Elevator Status
        if not item.get("has_lift"):
            if item.get("floor_number") == "Ground Floor":
                item["has_lift"] = "N/A (Ground)"
            elif any(k in txt for k in ["lift in building", "elevator access", "with lift", "has a lift", "serviced by a lift", "elevator in building", "lifts in block"]):
                item["has_lift"] = "yes"
            elif any(k in txt for k in ["no lift", "stairs only", "walk-up", "walk up", "stair access only"]):
                item["has_lift"] = "no"
            else:
                item["has_lift"] = "unknown"

        # Extract Building Name
        if not item.get("building_name"):
            item["building_name"] = extract_building_name(item.get("title", ""), item.get("address", ""), html)

    except Exception:
        pass
    return item"""

content = content.replace(old_enrich, new_enrich, 1)

# 4. Pass new fields in final_ranked.append
old_instantiate_ai = """                        agency_hellopeter_rating=base.get("agency_hellopeter_rating"),
                        price_value_pct=calculate_price_value_pct(base.get("price"), base.get("bedrooms"), base.get("area", "Gardens"), candidates)
                    ))"""

new_instantiate_ai = """                        agency_hellopeter_rating=base.get("agency_hellopeter_rating"),
                        price_value_pct=calculate_price_value_pct(base.get("price"), base.get("bedrooms"), base.get("area", "Gardens"), candidates),
                        floor_number=base.get("floor_number"),
                        has_lift=base.get("has_lift", "unknown"),
                        building_name=base.get("building_name"),
                        pro_report=base.get("pro_report")
                    ))"""

content = content.replace(old_instantiate_ai, new_instantiate_ai, 1)

# 5. Pass new fields in _deterministic_rank
old_instantiate_det = """                agency_hellopeter_rating=c.get("agency_hellopeter_rating"),
                price_value_pct=calculate_price_value_pct(c.get("price"), c.get("bedrooms"), c.get("area", "Gardens"), candidates)
            ))"""

new_instantiate_det = """                agency_hellopeter_rating=c.get("agency_hellopeter_rating"),
                price_value_pct=calculate_price_value_pct(c.get("price"), c.get("bedrooms"), c.get("area", "Gardens"), candidates),
                floor_number=c.get("floor_number"),
                has_lift=c.get("has_lift", "unknown"),
                building_name=c.get("building_name"),
                pro_report=c.get("pro_report")
            ))"""

content = content.replace(old_instantiate_det, new_instantiate_det, 1)

with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "w", encoding="utf-8") as f:
    f.write(content)

print("ai_scout.py successfully patched!")

