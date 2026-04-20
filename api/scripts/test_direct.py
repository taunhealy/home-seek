import sys
import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

class EvolutionClient:
    def __init__(self):
        self.base_url = os.getenv("EVOLUTION_API_URL")
        self.api_key = os.getenv("EVOLUTION_API_KEY")
        self.instance_name = os.getenv("EVOLUTION_INSTANCE")
        self.instance_token = os.getenv("EVOLUTION_INSTANCE_KEY")

    async def send_whatsapp(self, number: str, message: str):
        if not self.base_url or not self.api_key:
            print("Evolution API not configured. Skipping WhatsApp notification.")
            return

        clean_number = number.replace('+', '').replace(' ', '')
        if not (clean_number.startswith('27') or len(clean_number) > 10):
            clean_number = f"27{clean_number.lstrip('0')}"

        url = f"{self.base_url}/message/sendText/{self.instance_name}"
        headers = {
            "apikey": self.instance_token or self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "number": clean_number,
            "options": {"delay": 1200, "presence": "composing", "linkPreview": True},
            "textMessage": {"text": message}
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Error sending WhatsApp to {clean_number}: {e}")
                return None

async def main():
    if len(sys.argv) < 2:
        print("Usage: python test_direct.py [phone_number]")
        return

    phone = sys.argv[1]
    client = EvolutionClient()
    
    print(f"Sending DIRECT Kea-Logic Test Message to {phone}...")
    
    message = "*Kea Logic Sniper: Direct Connection Verified*\n\n"
    message += "Bypassing import logic to confirm your GCP gateway is live.\n\n"
    message += "Status: 100% Operational"
    
    result = await client.send_whatsapp(phone, message)
    
    if result:
        print("SUCCESS: Direct Test message sent!")
    else:
        print("FAILED: Check your credentials.")

if __name__ == "__main__":
    asyncio.run(main())
