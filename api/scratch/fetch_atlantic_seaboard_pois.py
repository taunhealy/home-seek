import urllib.request
import urllib.parse
import json

key = 'AIzaSyBsSqzphMvv3ClPZtUFqOqSuIqPj_cZknI'

def search(q):
    url = f'https://maps.googleapis.com/maps/api/place/textsearch/json?query={urllib.parse.quote(q)}&key={key}'
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode('utf-8')).get('results', [])

data = {
    'gyms_green_point': search('gyms in Green Point Cape Town'),
    'gyms_sea_point': search('gyms in Sea Point Cape Town'),
    'bars_green_point': search('popular bars and pubs in Green Point Cape Town'),
    'bars_sea_point': search('popular bars and pubs in Sea Point Cape Town'),
    'restaurants_green_point': search('best restaurants in Green Point Cape Town'),
    'restaurants_sea_point': search('best restaurants in Sea Point Cape Town'),
}

for category, results in data.items():
    print(f"\n=== {category.upper().replace('_', ' ')} ===")
    for item in results[:7]:
        name = item.get('name')
        addr = item.get('formatted_address', '')
        loc = item.get('geometry', {}).get('location', {})
        lat = loc.get('lat')
        lng = loc.get('lng')
        rating = item.get('rating')
        reviews = item.get('user_ratings_total')
        print(f"• {name} (★ {rating}, {reviews} reviews)")
        print(f"  Address: {addr}")
        print(f"  Coords: ({lat}, {lng})")

