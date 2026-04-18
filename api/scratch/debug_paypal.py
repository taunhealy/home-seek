import requests
import json

CLIENT_ID = "ASUtAsOmzOgu8lX6Coxl8ouWxUIozHx4bJ-u2pgfDVdMhxlY8XhMp_iLnYOjPx3QqlSET5k0jkup5BUH"
SECRET = "EKbToCCIkvNuHgV9rwIe6DYeQOmAqub_GojtsxnG3yI2-XFGNER4YWGTuAxoMKomKihP1n6vaZvpLGjs"

def test(url):
    try:
        r = requests.post(url, auth=(CLIENT_ID, SECRET), data={"grant_type": "client_credentials"})
        print(f"{url}: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"{url}: ERROR {e}")

test("https://api-m.paypal.com/v1/oauth2/token")
test("https://api-m.sandbox.paypal.com/v1/oauth2/token")
