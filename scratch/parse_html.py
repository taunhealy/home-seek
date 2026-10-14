import re
import json
from bs4 import BeautifulSoup

with open("scratch/hout_bay_page.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

title_el = soup.find("h1") or soup.find("title")
title = title_el.get_text(strip=True) if title_el else ""

# Price
price_el = soup.find(class_=re.compile(r"p24_price", re.I)) or soup.find(text=re.compile(r"R\s*\d+"))
price_text = price_el.get_text(strip=True) if hasattr(price_el, "get_text") else str(price_el)

# Key Features / Overview
overview = {}
for item in soup.find_all(class_=re.compile(r"p24_feature|p24_keyFeature", re.I)):
    overview[item.get_text(strip=True)] = True

# Description
desc_el = soup.find(class_=re.compile(r"p24_description|js_readMoreText", re.I))
description = desc_el.get_text(separator="\n", strip=True) if desc_el else ""

# Agency
agency_el = soup.find(class_=re.compile(r"p24_branding|p24_agency", re.I))
agency = agency_el.get_text(strip=True) if agency_el else ""

# Images
images = []
for img in soup.find_all("img"):
    src = img.get("src") or img.get("data-src") or img.get("data-original")
    if src and "images.prop24.com" in src:
        # Get higher res if thumbnail
        full_res = re.sub(r"/Crop\d+x\d+/", "/Resize1920x1080/", src)
        if full_res not in images:
            images.append(full_res)

print("--- PARSED LISTING DETAILS ---")
print(f"TITLE: {title}")
print(f"PRICE: {price_text}")
print(f"AGENCY: {agency}")
print(f"IMAGES FOUND: {len(images)}")
if images:
    print(f"FIRST 3 IMAGES: {images[:3]}")
print(f"\nDESCRIPTION SNIPPET:\n{description[:500]}...")

with open("scratch/parsed_summary.json", "w", encoding="utf-8") as f:
    json.dump({
        "title": title,
        "price_text": price_text,
        "agency": agency,
        "description": description,
        "images": images[:8]
    }, f, indent=2)
