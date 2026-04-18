import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
SECRET = os.getenv("PAYPAL_SECRET")
PRODUCT_ID = "PROD-14W01450XN100840P"

def get_access_token():
    url = "https://api-m.paypal.com/v1/oauth2/token"
    headers = {
        "Accept": "application/json",
        "Accept-Language": "en_US",
    }
    data = {
        "grant_type": "client_credentials"
    }
    response = requests.post(url, auth=(CLIENT_ID, SECRET), headers=headers, data=data)
    token_data = response.json()
    if "access_token" not in token_data:
        print(f"Error getting token: {token_data}")
    return token_data.get("access_token")

def create_plan(name, description, price, currency="ZAR"):
    token = get_access_token()
    if not token: return {}
    url = "https://api-m.paypal.com/v1/billing/plans"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation"
    }
    
    payload = {
        "product_id": PRODUCT_ID,
        "name": name,
        "description": description,
        "status": "ACTIVE",
        "billing_cycles": [
            {
                "frequency": {
                    "interval_unit": "MONTH",
                    "interval_count": 1
                },
                "tenure_type": "REGULAR",
                "sequence": 1,
                "total_cycles": 0,
                "pricing_scheme": {
                    "fixed_price": {
                        "value": str(price),
                        "currency_code": currency
                    }
                }
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

if __name__ == "__main__":
    print("LOG: Creating Silver Plan...")
    silver = create_plan("Silver Sniper", "10 Alerts + 12h Frequency Scan", 200)
    print(f"RESULT: Silver Plan ID: {silver.get('id')}")
    
    print("LOG: Creating Gold Overlord Plan...")
    gold = create_plan("Gold Overlord", "20 Alerts + 1h Frequency Scan", 300)
    print(f"RESULT: Gold Plan ID: {gold.get('id')}")
