import urllib.request, re, json

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117408746"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.property24.com/"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

title_m = re.search(r'<title>(.*?)</title>', html)
print("PAGE TITLE:", title_m.group(1) if title_m else "No title")

desc_m = re.search(r'class="p24_description"[^>]*>(.*?)</div>', html, re.S) or \
         re.search(r'"description"\s*:\s*"(.*?)"', html)
if desc_m:
    print("\nDESCRIPTION:")
    print(desc_m.group(1)[:1200])

print("\nOCCURRENCES OF KEYWORDS:")
for m in re.finditer(r'.{0,35}(?:blackbrick|hotel|aparthotel|amenit|rooftop|club|gardens).{0,35}', html, re.I):
    print("  ->", m.group(0).strip())

