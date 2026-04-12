import httpx
import os
from dotenv import load_dotenv

load_dotenv()

class EvolutionClient:
    def __init__(self):
        self.base_url = os.getenv("EVOLUTION_API_URL")
        self.api_key = os.getenv("EVOLUTION_API_KEY")
        self.instance_name = os.getenv("EVOLUTION_INSTANCE_NAME")

    async def send_whatsapp(self, number: str, message: str):
        if not self.base_url or not self.api_key:
            print("Evolution API not configured. Skipping WhatsApp notification.")
            return

        # Ensure number is in correct format (adding South Africa prefix if missing)
        clean_number = number.replace('+', '').replace(' ', '')
        if not (clean_number.startswith('27') or len(clean_number) > 10):
            clean_number = f"27{clean_number.lstrip('0')}"

        url = f"{self.base_url}/message/sendText/{self.instance_name}"
        headers = {
            "apikey": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "number": clean_number,
            "options": {
                "delay": 1200,
                "presence": "composing",
                "linkPreview": True
            },
            "textMessage": {
                "text": message
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Error sending WhatsApp to {clean_number}: {e}")
                return None

class ResendEmailClient:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")

    async def send_email(self, to: str, subject: str, body: str):
        if not self.api_key:
            print("Resend API key not configured. Skipping email notification.")
            return

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": self.from_email,
            "to": [to],
            "subject": subject,
            "html": body.replace('\n', '<br>')
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Error sending email to {to}: {e}")
                return None

