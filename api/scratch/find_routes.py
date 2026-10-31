with open('api/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'@app\.(?:post|get|put|delete)\(["\']([^"\']+)["\']', text)
for m in matches:
    if any(k in m for k in ['scout', 'alert', 'report', 'scan']):
        print(m)

