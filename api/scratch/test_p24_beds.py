import urllib.request, re

def check_p24(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
        m = re.findall(r'title="Bedrooms"[^>]*>.*?<span>(\d+(?:\.\d+)?)</span>', html, re.S)
        print(url, '-> Beds found:', m[:10])
    except Exception as e:
        print(url, 'Error:', e)

check_p24('https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?sp=bd1')
check_p24('https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145?sp=bd2')

