file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\discover\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_options = """                    <option value="1">1 Bedroom (or Bachelor)</option>
                    <option value="2">2 Bedrooms</option>
                    <option value="3">3+ Bedrooms</option>"""

new_options = """                    <option value="1">1+ Bedrooms (or Bachelor)</option>
                    <option value="2">2+ Bedrooms</option>
                    <option value="3">3+ Bedrooms</option>
                    <option value="4">4+ Bedrooms</option>"""

if old_options in content:
    content = content.replace(old_options, new_options)
else:
    old_options_crlf = old_options.replace('\n', '\r\n')
    new_options_crlf = new_options.replace('\n', '\r\n')
    assert old_options_crlf in content, "old_options not found"
    content = content.replace(old_options_crlf, new_options_crlf)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated web/src/app/discover/page.tsx options to all +!")

