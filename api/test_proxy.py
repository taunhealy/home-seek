import time
import requests

def test_node(session_id, target_url):
    proxy = f"http://user-sp7ghmyebz-country-za-session-{session_id}:5de_P61s5gdkvKtUNj@gate.decodo.com:10001"
    proxies = {"http": proxy, "https": proxy}
    print(f"\n--- Testing Sticky Session: {session_id} ---")
    
    try:
        start = time.time()
        print(f"Pinging {target_url}...")
        r = requests.get(target_url, proxies=proxies, timeout=20)
        latency = time.time() - start
        
        if "ipinfo" in target_url:
            print(f"✅ SUCCESS: Connected via IP -> {r.json().get('ip')}")
            print(f"⏱️ Latency: {latency:.2f} seconds")
        else:
            print(f"✅ SUCCESS: Loaded FB Payload -> {len(r.text)/1024:.1f} KB")
            print(f"⏱️ Latency: {latency:.2f} seconds")
            
    except Exception as e:
        print(f"DEAD NODE: Connection Failed after {time.time() - start:.2f} seconds.")
        print(f"Error: {e}")

if __name__ == "__main__":
    print("--- Testing Decodo Raw Copy-Paste Credentials ---")
    proxy = "http://sp7ghmyebz:5de_P61s5gdkvKtUNj@za.decodo.com:40001"
    try:
        r = requests.get("https://ipinfo.io/json", proxies={"http": proxy, "https": proxy}, timeout=20)
        print("✅ SUCCESS NO-SUFFIX:", r.json().get("ip"), "| Country:", r.json().get("country"))
    except Exception as e:
        print("❌ FAILED NO-SUFFIX:", e)

    test_node("debug101", "https://ipinfo.io/json")
