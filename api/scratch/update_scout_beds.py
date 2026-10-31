file_path = r'c:\Ryoko\Projects\home-seek\api\services\ai_scout.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_def = 'def scrape_portal_listings(area: str, max_price: Optional[int] = None, min_price: Optional[int] = None, property_type: Optional[str] = None) -> List[Dict[str, Any]]:'
new_def = 'def scrape_portal_listings(area: str, max_price: Optional[int] = None, min_price: Optional[int] = None, property_type: Optional[str] = None, min_bedrooms: Optional[float] = None) -> List[Dict[str, Any]]:'

if old_def in content:
    content = content.replace(old_def, new_def)

# Add sp=bd param if min_bedrooms is provided
target_params = '    if property_type:\n        pt = property_type.lower()'
replacement_params = '''    if min_bedrooms and min_bedrooms > 0:
        params.append(f"sp=bd{int(min_bedrooms)}")
    if property_type:
        pt = property_type.lower()'''

if target_params in content:
    content = content.replace(target_params, replacement_params)
else:
    target_crlf = target_params.replace('\n', '\r\n')
    replacement_crlf = replacement_params.replace('\n', '\r\n')
    if target_crlf in content:
        content = content.replace(target_crlf, replacement_crlf)

# Update call site
old_call = '''            scraped = scrape_portal_listings(
                area=area_clean,
                max_price=prefs.max_price,
                min_price=prefs.min_price,
                property_type=prefs.property_type
            )'''

new_call = '''            scraped = scrape_portal_listings(
                area=area_clean,
                max_price=prefs.max_price,
                min_price=prefs.min_price,
                property_type=prefs.property_type,
                min_bedrooms=prefs.min_bedrooms
            )'''

if old_call in content:
    content = content.replace(old_call, new_call)
else:
    old_call_crlf = old_call.replace('\n', '\r\n')
    new_call_crlf = new_call.replace('\n', '\r\n')
    if old_call_crlf in content:
        content = content.replace(old_call_crlf, new_call_crlf)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated ai_scout.py with min_bedrooms portal scraping!")

