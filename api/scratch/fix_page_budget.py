file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\reports\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = '?.filter(item => !hideUnavailable || item.is_available !== false)'
replacement1 = '?.filter(item => (!hideUnavailable || item.is_available !== false) && (!selectedReport.max_price || !item.price || item.price <= selectedReport.max_price))'

assert target1 in content, "target1 not found"
content = content.replace(target1, replacement1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully added frontend budget filter safeguard to page.tsx!")

