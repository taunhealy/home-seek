
import requests
import os

def test():
    # Try the one from .env (Residential)
    res_proxy = "http://user-sp7ghmyebz:5de_P61s5gdkvKtUNj@gate.decodo.com:10001"
    # Try the one from test_proxy.py (Potential Datacenter)
    dc_proxy = "http://sp7ghmyebz:5de_P61s5gdkvKtUNj@za.decodo.com:40001"
    
    print("Testing Residential (Port 10001):")
    try:
        r = requests.get("https://ipinfo.io/json", proxies={"http": res_proxy, "https": res_proxy}, timeout=10)
        print(f"  IP: {r.json().get('ip')} ({r.json().get('org')})")
    except Exception as e:
        print(f"  Failed: {e}")
        
    print("\nTesting Potential Datacenter (Port 40001):")
    try:
        r = requests.get("https://ipinfo.io/json", proxies={"http": dc_proxy, "https": dc_proxy}, timeout=10)
        print(f"  IP: {r.json().get('ip')} ({r.json().get('org')})")
    except Exception as e:
        print(f"  Failed: {e}")

if __name__ == '__main__':
    test()
