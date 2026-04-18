import requests
import json

url = "http://localhost:8000/deploy-sniper"
payload = {
    "user_id": "taun_test_user",
    "search_query": "Modern flat in Sea Point",
    "alert_enabled": True,
    "max_price": 12000,
    "min_bedrooms": 2,
    "pet_friendly": True
}

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {str(e)}")
