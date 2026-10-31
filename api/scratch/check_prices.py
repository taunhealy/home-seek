import urllib.request, json
res = urllib.request.urlopen('http://localhost:8000/reports/taun_test_user')
data = json.loads(res.read())
max_p = data['reports'][0].get('max_price', 18000)
print(f"Report Max Budget: R{max_p}")
for it in data['reports'][0]['ranked_listings']:
    p = it.get('price')
    over = " [OVER BUDGET!]" if p and p > max_p else ""
    print(f"#{it.get('rank')}: R{p:,} - {it.get('title')} ({it.get('address')}){over}")

