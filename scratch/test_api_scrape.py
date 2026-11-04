import urllib.request
import json

data = {
    "suburbs": ["Rondebosch", "George"],
    "min_price": 11000,
    "max_price": 17000,
    "bedrooms": "1+",
    "anchor_lat": -33.974,
    "anchor_lng": 18.455
}

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/search/live-scrape",
    data=json.dumps(data).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print(f"Backend Response Status: {res.get('status')}")
        print(f"Total Listings Scraped: {res.get('count')}")
        for item in res.get('listings', [])[:3]:
            print(" -", item.get('title'), "|", item.get('price_str'), "|", item.get('address'))
except Exception as e:
    print("Error calling endpoint:", e)

