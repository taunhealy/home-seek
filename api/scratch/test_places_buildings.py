import urllib.request
import urllib.parse
import json

key = 'AIzaSyBsSqzphMvv3ClPZtUFqOqSuIqPj_cZknI'
buildings = [
    ('Marais Mansions', 'Sea Point'),
    ('Parioli Court', 'Tamboerskloof'),
    ('Brabazon Court', 'Vredehoek'),
    ('Wembley Square', 'Gardens'),
    ('Capricorn Beach Estate', 'Muizenberg')
]

for b, sub in buildings:
    q = f"{b}, {sub}, Cape Town"
    url = f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={urllib.parse.quote(q)}&inputtype=textquery&fields=name,formatted_address,geometry&key={key}"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        cands = data.get('candidates', [])
        if cands:
            c = cands[0]
            name = c.get('name')
            addr = c.get('formatted_address')
            loc = c.get('geometry', {}).get('location', {})
            print(f"✓ {b} ({sub}) -> {name}: {addr} | ({loc.get('lat')}, {loc.get('lng')})")
        else:
            print(f"✗ {b} ({sub}) -> Not found")

