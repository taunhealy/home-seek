import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Find where photos are in the HTML
# Specifically look for gallery / carousel / slide elements or JSON blobs
print("Listing HTML length:", len(html))

# Check for JSON data or gallery containers
gallery_matches = re.findall(r'<div[^>]*class="[^"]*(?:gallery|carousel|slider|photos)[^"]*"[^>]*>', html, re.I)
print("Gallery containers:", gallery_matches[:5])

# Find all image tags and their parent context or classes
img_tags = re.findall(r'<img[^>]+src="([^">]+)"[^>]*>', html)
print("All img tags count:", len(img_tags))

# Check image URLs and their classes/alt
detailed_imgs = re.findall(r'(<img[^>]+https://images\.prop24\.com/[^>]+>)', html)
for itm in detailed_imgs[:10]:
    print("IMG:", itm)

# Also check for js-slider or lightbox or json data in scripts
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.S)
for s in scripts:
    if 'images.prop24.com' in s:
        print("Found images in script, length:", len(s))
        # look for image URLs in script
        found_in_script = re.findall(r'https://images\.prop24\.com/\d+/[^"\']+', s)
        print("Photos in script:", found_in_script[:5])

