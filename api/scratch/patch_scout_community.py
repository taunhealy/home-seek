with open('api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Add import
old_import = 'from services.building_reviews import extract_building_name, get_building_reviews'
new_import = '''from services.building_reviews import extract_building_name, get_building_reviews
from services.community_sentiment import get_community_sentiment'''
assert old_import in text, "old_import not found"
text = text.replace(old_import, new_import)

# Add field to ScoutListingRank
old_field = '    pro_report: Optional[Dict[str, Any]] = None'
new_field = '''    pro_report: Optional[Dict[str, Any]] = None
    community_sentiment: Optional[Dict[str, Any]] = None'''
assert old_field in text, "old_field not found"
text = text.replace(old_field, new_field)

# In final_ranked.append
old_inst1 = '''                        has_lift=base.get("has_lift", "unknown"),
                        building_name=base.get("building_name"),
                        pro_report=base.get("pro_report")
                    ))'''

new_inst1 = '''                        has_lift=base.get("has_lift", "unknown"),
                        building_name=base.get("building_name"),
                        pro_report=base.get("pro_report"),
                        community_sentiment=get_community_sentiment(
                            area=base.get("area", "Gardens"),
                            address=base.get("address", ""),
                            listing_id=base.get("listing_id", ""),
                            title=base.get("title", ""),
                            building_name=base.get("building_name")
                        )
                    ))'''
assert old_inst1 in text, "old_inst1 not found"
text = text.replace(old_inst1, new_inst1)

# In ranked.append
old_inst2 = '''                has_lift=c.get("has_lift", "unknown"),
                building_name=c.get("building_name"),
                pro_report=c.get("pro_report")
            ))'''

new_inst2 = '''                has_lift=c.get("has_lift", "unknown"),
                building_name=c.get("building_name"),
                pro_report=c.get("pro_report"),
                community_sentiment=get_community_sentiment(
                    area=c.get("area", "Gardens"),
                    address=c.get("address", ""),
                    listing_id=c.get("listing_id", ""),
                    title=c.get("title", ""),
                    building_name=c.get("building_name")
                )
            ))'''
assert old_inst2 in text, "old_inst2 not found"
text = text.replace(old_inst2, new_inst2)

with open('api/services/ai_scout.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: api/services/ai_scout.py patched with community sentiment!")

