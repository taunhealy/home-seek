file_path = r'c:\Ryoko\Projects\home-seek\api\services\ai_scout.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = 'if prefs.max_price and it.get("price") and it["price"] > (prefs.max_price + 1000):'
replacement = '# Strict budget ceiling: strictly exclude any listing exceeding max budget\n            if prefs.max_price and it.get("price") and it["price"] > prefs.max_price:'

assert target in content, "target not found"
content = content.replace(target, replacement)

prompt_target = "- Budget Max: R {prefs.max_price or 'Flexible'} pm"
prompt_replacement = "- Budget Max: R {prefs.max_price or 'Flexible'} pm (STRICT CEILING — absolutely no listings above this rent)"
if prompt_target in content:
    content = content.replace(prompt_target, prompt_replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully enforced strict budget ceiling in ai_scout.py!")

