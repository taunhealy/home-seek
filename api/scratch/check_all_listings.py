import urllib.request, json

res = urllib.request.urlopen('http://localhost:8000/reports/taun_test_user')
data = json.loads(res.read())
for it in data['reports'][0]['ranked_listings']:
    rank = it.get('rank')
    title = it.get('title')
    agency = it.get('agency_name')
    rating = it.get('agency_rating')
    is_landlord = it.get('is_direct_landlord')
    is_avail = it.get('is_available')
    status = it.get('availability_status')
    bldg = it.get('building_name')
    print(f"#{rank}: {title} | Bldg: {bldg} | Agency: {agency} ({rating}*) | Landlord: {is_landlord} | Avail: {is_avail} [{status}]")

