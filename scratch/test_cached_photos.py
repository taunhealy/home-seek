import urllib.request, urllib.parse, json, time

test_url = 'https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021/117771952'
req_url = f'http://localhost:8000/api/listing-photos?url={urllib.parse.quote(test_url)}'

t0 = time.time()
res1 = urllib.request.urlopen(req_url, timeout=10)
d1 = json.loads(res1.read().decode())
t1 = time.time()
print(f"Call 1: {t1 - t0:.3f}s | status={d1.get('status')} | photos={len(d1.get('photos', []))}")

t2 = time.time()
res2 = urllib.request.urlopen(req_url, timeout=10)
d2 = json.loads(res2.read().decode())
t3 = time.time()
print(f"Call 2 (Cached): {t3 - t2:.3f}s | status={d2.get('status')} | photos={len(d2.get('photos', []))}")

