import re

with open('api/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

endpoints = re.findall(r'@app\.(get|post|put|delete)\([\"\'](.*?)[\"\']', text)
for method, path in endpoints:
    print(f"{method.upper():6} {path}")

