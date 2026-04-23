import httpx
import os
from dotenv import load_dotenv

load_dotenv()
import sys

def print_safe(msg):
    try:
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except:
        pass

class EvolutionClient:
    def __init__(self):
        self.base_url = os.getenv("EVOLUTION_API_URL")
        self.api_key = os.getenv("EVOLUTION_API_KEY")
        self.instance_name = os.getenv("EVOLUTION_INSTANCE")
        self.instance_token = os.getenv("EVOLUTION_INSTANCE_KEY")

    async def send_whatsapp(self, number: str, message: str):
        if not self.base_url or not self.api_key:
            print_safe("Evolution API not configured. Skipping WhatsApp notification.")
            return

        # Ensure number is in correct format (adding South Africa prefix if missing)
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
            "options": {
                "delay": 1200,
                "presence": "composing",
                "linkPreview": True
            },
            "textMessage": {
                "text": message
            }
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code != 201 and response.status_code != 200:
                    print_safe(f"Evolution API Error [{response.status_code}]: {response.text}")
                
                response.raise_for_status()
                return response.json()
            except Exception as e:
                # If it's an HTTP error, try to show the body
                if hasattr(e, 'response') and e.response:
                    print_safe(f"WhatsApp Pipeline Failure to {clean_number}: {e} | Body: {e.response.text}")
                else:
                    print_safe(f"WhatsApp Pipeline Failure to {clean_number}: {e}")
                return None

class ResendEmailClient:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")

    async def send_email(self, to: str, subject: str, body: str):
        if not self.api_key:
            print_safe("Resend API key not configured. Skipping email notification.")
            return

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": f"Home-Seek Intelligence <{self.from_email}>",
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
                print_safe(f"Error sending email to {to}: {e}")
                return None
class MailerSendClient:
    def __init__(self):
        self.api_key = os.getenv("MAILERSEND_API_KEY")
        # Default trial domain provided by MailerSend
        self.from_email = os.getenv("MAILERSEND_FROM_EMAIL", "MS_Xq2QhV@trial-3yxj6ljnmnygdo2r.mlsender.net")

    async def send_email(self, to: str, subject: str, body: str):
        if not self.api_key:
            print_safe("MailerSend API key not configured. Skipping email notification.")
            return

        url = "https://api.mailersend.com/v1/email"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": {
                "email": self.from_email,
                "name": "Home-Seek Sniper"
            },
            "to": [
                {
                    "email": to
                }
            ],
            "subject": subject,
            "html": body
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print_safe(f"Error sending MailerSend email to {to}: {e}")
                return None
