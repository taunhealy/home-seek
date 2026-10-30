import urllib.request
import re

url_detail = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/117408746"
req = urllib.request.Request(url_detail, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.property24.com/"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Check Schema.org floorSize
schema_size = re.search(r'"floorSize"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
print("Schema floorSize:", schema_size.group(1) if schema_size else None)

# Check HTML size
html_size = re.search(r'title="Floor Size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
            re.search(r'class="p24_size"[^>]*>.*?<span>(\d+)\s*m²</span>', html, re.S) or \
            re.search(r'(\d+)\s*m²\s*(?:apartment|flat|unit|floor|property)', html, re.I) or \
            re.search(r'(?:floor\s*size|size|under\s*roof)[\s:]*(\d+)\s*m²', html, re.I)

print("HTML floor size:", html_size.group(1) if html_size else None)

