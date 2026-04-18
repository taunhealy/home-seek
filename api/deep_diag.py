import requests
import json
import time

def run_deep_diagnostic():
    # 1. Load Cookies
    try:
        with open('cookies.json', 'r') as f:
            cookies_list = json.load(f)
        cookies = {c['name']: c['value'] for c in cookies_list}
        print(f"--- Cookie Pulse: Loaded {len(cookies)} cookies (User: {cookies.get('c_user', 'UNKNOWN')}) ---")
    except Exception as e:
        print(f"Cookie Load Failed: {e}")
        return

    # 2. Setup Proxy
    proxy = "http://sp7ghmyebz:5de_P61s5gdkvKtUNj@gate.decodo.com:10001"
    proxies = {"http": proxy, "https": proxy}
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15"
    
    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1"
    }

    url = "https://www.facebook.com/groups/127792434687339/"
    
    print(f"Pinging {url} via {proxy} and iPhone UA...")
    
    try:
        start = time.time()
        # We use a session to persist cookies across the redirect
        session = requests.Session()
        session.cookies.update(cookies)
        
        r = session.get(url, proxies=proxies, headers=headers, timeout=30, allow_redirects=True)
        latency = time.time() - start
        
        print(f"--- Response Received ({latency:.2f}s) ---")
        print(f"Status Code: {r.status_code}")
        print(f"Final URL: {r.url}")
        print(f"Payload Size: {len(r.text)//1024} KB")
        
        # Security Analysis
        checks = {
            "Checkpoint": "checkpoint" in r.url.lower() or "checkpoint" in r.text.lower(),
            "Blocked/Banned": "restricted" in r.text.lower() or "temporarily blocked" in r.text.lower(),
            "Login Required": "login" in r.url.lower() or "login_form" in r.text,
            "Real Content Found": "Huis Huis" in r.text or "Gordon's Bay" in r.text
        }
        
        for name, hit in checks.items():
            print(f"{'🚩' if hit and name != 'Real Content Found' else '✅'} {name}: {hit}")
            
        if not checks["Real Content Found"]:
            print("\n--- HTML SNIPPET ---")
            print(r.text[:1000])

    except Exception as e:
        print(f"CRITICAL FAILURE: {e}")

if __name__ == "__main__":
    run_deep_diagnostic()
