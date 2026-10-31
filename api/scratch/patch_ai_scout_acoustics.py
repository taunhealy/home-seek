import sys

path = 'api/services/ai_scout.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add acoustic_audit field to ScoutListingRank
old_field = "    community_sentiment: Optional[Dict[str, Any]] = None"
new_field = "    community_sentiment: Optional[Dict[str, Any]] = None\n    acoustic_audit: Optional[Dict[str, Any]] = None"

if old_field in content and "acoustic_audit: Optional[Dict[str, Any]]" not in content:
    content = content.replace(old_field, new_field)

# 2. Add compute_property_acoustic_audit call and pass it
old_sentiment = """                        community_sentiment=get_community_sentiment(
                            area=base.get("area", "Gardens"),
                            address=base.get("address", ""),
                            listing_id=base.get("listing_id", ""),
                            title=base.get("title", ""),
                            building_name=base.get("building_name")
                        )"""

new_sentiment = """                        community_sentiment=get_community_sentiment(
                            area=base.get("area", "Gardens"),
                            address=base.get("address", ""),
                            listing_id=base.get("listing_id", ""),
                            title=base.get("title", ""),
                            building_name=base.get("building_name")
                        ),
                        acoustic_audit=compute_property_acoustic_audit(
                            lat=float(base.get("lat") or -33.9328),
                            lng=float(base.get("lng") or 18.4103),
                            floor_level=base.get("floor_number", ""),
                            text_desc=f"{base.get('description', '')} {base.get('title', '')} {base.get('address', '')}",
                            title=base.get("title", ""),
                            address=base.get("address", "")
                        )"""

if old_sentiment in content and "acoustic_audit=compute_property_acoustic_audit" not in content:
    content = content.replace(old_sentiment, new_sentiment)

# 3. Import compute_property_acoustic_audit if not present
if "from services.acoustic_registry import" not in content:
    content = "from services.acoustic_registry import compute_property_acoustic_audit\n" + content

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Patched ai_scout.py with acoustic_audit in ScoutListingRank.")

