import re

with open('scratch/listing_117782499.html', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'images\.prop24\.com/(\d+)/Ensure.*?js_carouselCaption[^>]*>([^<]*)<', text)
print("Captions:", matches)

