import sys
import os
import asyncio
from pathlib import Path

# Add parent dir to path to import services
sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.notifications import EvolutionClient

async def main():
    if len(sys.argv) < 2:
        print("Usage: python test_whatsapp.py [phone_number]")
        print("Example: python test_whatsapp.py 27821234567")
        return

    phone = sys.argv[1]
    client = EvolutionClient()
    
    print(f"🚀 Sending Kea-Logic Test Message to {phone}...")
    
    message = "🏠 *Kea Logic Sniper: Connection Verified*\n\n"
    message += "Your residential intelligence node is now successfully linked to WhatsApp.\n\n"
    message += "🎯 *Current Mission:* Rental Discovery (v24.0)\n"
    message += "📊 *Status:* Online & Stealth"
    
    result = await client.send_whatsapp(phone, message)
    
    if result:
        print("✅ SUCCESS: Test message sent! Check your WhatsApp.")
    else:
        print("❌ FAILED: Check your .env credentials and Evolution Dashboard status.")

if __name__ == "__main__":
    asyncio.run(main())
