import sys, httpx, asyncio

async def test_httpx():
    url = "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021/117771952"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.property24.com/to-rent/sea-point/cape-town/western-cape/11021",
    }
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            print("HTTPX Status:", resp.status_code, "Length:", len(resp.text))
            return resp.status_code == 200
    except Exception as e:
        print("HTTPX Error:", e)
        return False

asyncio.run(test_httpx())

