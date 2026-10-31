import sys, httpx, asyncio, re

async def test_extract():
    url = "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021/117771952"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021",
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
        resp = await client.get(url)
        html = resp.text
        
        # Extract images
        lightbox_ids = re.findall(r'data-(?:lightbox-src|image-url)="https://images\.prop24\.com/(\d+)', html)
        listing_img_ids = re.findall(r'alt="Listing number:[^"]*"[^>]*(?:lazy-src|src)="https://images\.prop24\.com/(\d+)', html)
        gal_href_ids = re.findall(r'rel="photo\[pp_gal\]"[^>]*href="https://images\.prop24\.com/(\d+)', html)
        all_ids = re.findall(r'https://images\.prop24\.com/(\d+)/[^\s"\'<>]+', html)

        print("lightbox_ids:", len(lightbox_ids), lightbox_ids[:5])
        print("listing_img_ids:", len(listing_img_ids), listing_img_ids[:5])
        print("gal_href_ids:", len(gal_href_ids), gal_href_ids[:5])
        print("all_ids:", len(all_ids), all_ids[:5])

asyncio.run(test_extract())

