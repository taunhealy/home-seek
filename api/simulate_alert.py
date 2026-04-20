import asyncio
import os
from services.notifications import EvolutionClient, ResendEmailClient
from services.database import get_db, get_user_profile
from datetime import datetime

async def simulate():
    user_id = "taun_test_user"
    print(f"[MISSION] INITIATING BRANDED SIMULATION for {user_id}...")
    
    db = get_db()
    profile = await get_user_profile(user_id)
    
    # 1. Dummy Listing Data
    listing = {
        "title": "PREMIUM: 3 Bed High-Trust Loft in Kalk Bay",
        "price": 35000,
        "address": "Kalk Bay, Cape Town",
        "source_url": "https://www.property24.com/to-rent/kalk-bay/cape-town/11018/987654321",
        "platform": "Facebook",
        "bedrooms": 3,
        "bathrooms": 2,
        "is_furnished": True,
        "is_pet_friendly": True,
        "property_type": "Loft",
        "view_category": "Sea",
        "created_at": datetime.now().isoformat(),
        "match_reason": "Strategic Match: Kalk Bay loft captured via High-Frequency scan."
    }
    
    # 2. Persist to Dashboard
    doc_id = "sim_listing_premium_888"
    db.collection("users").document(user_id).collection("listings").document(doc_id).set(listing)
    print("[SUCCESS] Dashboard Feed Synchronized.")
    
    # 3. WhatsApp Signal
    whatsapp = profile.get("whatsapp")
    if whatsapp:
        wa_client = EvolutionClient()
        wa_msg = f"🏠 *Home-Seek Sniper Match*\n\n*{listing['title']}*\n💰 R{listing['price']:,}\n📍 {listing['address']}\n🔗 {listing['source_url']}"
        await wa_client.send_whatsapp(whatsapp, wa_msg)
        print(f"[SIGNAL] WhatsApp Signal Dispatched to {whatsapp}.")

    # 4. Email Signal (Premium Template)
    email = profile.get("email")
    if email:
        email_client = ResendEmailClient()
        subject = f"🏹 Mission Success: {listing['title']}"
        body = f"""
        <div style="background-color: #050505; color: #ffffff; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 24px; border: 1px solid #10b9811a;">
            <div style="text-align: center; margin-bottom: 30px;">
                <span style="color: #10b981; font-weight: 900; letter-spacing: 0.3em; font-size: 10px; text-transform: uppercase;">Home-Seek Intelligence</span>
            </div>
            
            <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 10px;">{listing['title']}</h1>
            <p style="color: #10b981; font-size: 20px; font-weight: 800; margin-bottom: 20px;">R{listing['price']:,}</p>
            
            <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 16px; margin-bottom: 30px;">
                <p style="color: rgba(255,255,255,0.4); font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Neighborhood</p>
                <p style="margin: 0; font-size: 14px;">{listing['address']}</p>
            </div>

            <div style="text-align: center; margin-bottom: 40px;">
                <a href="{listing['source_url']}" style="background-color: #10b981; color: #000000; padding: 18px 40px; border-radius: 12px; font-weight: 900; text-decoration: none; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; display: inline-block;">View Property</a>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 30px; text-align: center;">
                <p style="color: rgba(255,255,255,0.2); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3em;">Tactical Field Operations</p>
                <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin-top: 10px;">
                    This is a simulation alert. To adjust terminal telemetry, visit your 
                    <a href="https://home-seek.vercel.app/discover" style="color: #10b981; text-decoration: none;">Discovery Dashboard</a>.
                </p>
            </div>
        </div>
        """
        await email_client.send_email(email, subject, body)
        print(f"[SIGNAL] Branded Email Relay Dispatched to {email}.")

    print("[FINISH] SIMULATION COMPLETE.")

if __name__ == "__main__":
    asyncio.run(simulate())
