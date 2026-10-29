import urllib.request
import urllib.parse
import json

targets = [
    "Sea Point", "Camps Bay", "Hout Bay", "Southern Peninsula", 
    "Fish Hoek", "Constantia", "Green Point", "Gardens", 
    "Stellenbosch", "Somerset West", "Bloubergstrand"
]

for t in targets:
    url = f"https://www.property24.com/autocomplete/propertiesgrouped?term={urllib.parse.quote(t)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            matches = []
            for letter, items in data.items():
                for item in items:
                    name_match = (t.lower() == item.get('name', '').lower()) or (t.lower() in item.get('name', '').lower())
                    parent_match = any(loc in str(item.get('parentName', '')).lower() for loc in ['western cape', 'cape town', 'stellenbosch'])
                    if name_match and parent_match:
                        matches.append(item)
            if matches:
                # pick exact name match if exists
                exact = [m for m in matches if m.get('name', '').lower() == t.lower()]
                m = exact[0] if exact else matches[0]
                print(f"[{t}] id={m['id']}, name='{m['name']}', parent='{m['parentName']}'")
            else:
                print(f"[{t}] No match found")
    except Exception as e:
        print(f"[{t}] Error: {e}")
