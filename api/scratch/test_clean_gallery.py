import urllib.request
import re

url = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Method 1: Exact gallery items via data-image-url in js_galleryImage or js_lightboxImageWrapper
gallery_urls = re.findall(r'class="[^"]*js_galleryImage[^"]*"[^>]*data-image-url="([^"]+)"', html)
if not gallery_urls:
    gallery_urls = re.findall(r'data-image-url="(https://images\.prop24\.com/[^"]+)"', html)

# Method 2: Fallback to js_galleryThumbnail lazy-src
if not gallery_urls:
    gallery_urls = re.findall(r'class="[^"]*js_galleryThumbnail[^"]*"[^>]*lazy-src="([^"]+)"', html)

# Method 3: alt="Listing number: ..., Image number: ..."
if not gallery_urls:
    gallery_urls = re.findall(r'alt="Listing number:[^"]*, Image number:[^"]*"[^>]*src="([^"]+)"', html)

print("Targeted Gallery Photos Count:", len(gallery_urls))
for idx, p in enumerate(gallery_urls):
    print(f"  Photo {idx+1}: {p}")

