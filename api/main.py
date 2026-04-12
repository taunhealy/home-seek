from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from scraper.engine import SniperEngine
from database import save_listing, get_sources, get_user_profile, create_task, update_task
from notifications import EvolutionClient, ResendEmailClient

load_dotenv()

app = FastAPI(title="Home Seek API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SniperEngine()
notifier_wa = EvolutionClient()
notifier_email = ResendEmailClient()

class SearchTrigger(BaseModel):
    user_id: str
    search_query: str
    alert_enabled: bool = False

@app.get("/")
async def root():
    return {"message": "Home Seek API is online", "status": "running"}

# Global lock to prevent duplicate concurrent tasks
sniper_lock = asyncio.Lock()

async def run_sniper_task(search: SearchTrigger, task_id: str):
    if sniper_lock.locked():
        update_task(task_id, "Aborted", "⚠️ Another sniper task is already in progress. Please wait.", completed=True)
        return

    async with sniper_lock:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] --- NEW SNIPER TASK STARTING [{task_id}] ---")
        try:
            # 1. Fetch secure profile and sources
            user_profile = await get_user_profile(search.user_id)
            # 1. Fetch Sources (Add default portals if none exist)
            sources = await get_sources(search.user_id)
            if not sources:
                sources = [
                    {"name": "Property24 Portal", "url": "https://www.property24.com/to-rent"},
                    {"name": "Gumtree Portal", "url": "https://www.gumtree.co.za/s-property/v1c2l1j1"}
                ]
            
            # 2. Determine Search Location from Prompt
            update_task(task_id, "Brain", "🧠 Intelligence analyzing location...")
            search_location = await engine.extractor.determine_location(search.search_query)
            update_task(task_id, "Brain", f"🧠 Intelligence identified search area: {search_location}")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Smart Search Area: {search_location}")
            
            all_extracted_listings = []
            
            # 3. Scrape targets: If we have a location to search, ALWAYS use clean portals for a fresh start.
            if search_location != "South Africa":
                scrape_targets = [
                    {"name": "Property24 (Direct)", "url": "https://www.property24.com/to-rent"},
                    {"name": "Gumtree (Direct)", "url": "https://www.gumtree.co.za/s-property/v1c2l1j1"}
                ]
            else:
                scrape_targets = sources if sources else [
                    {"name": "Property24 Portal", "url": "https://www.property24.com/to-rent"},
                    {"name": "Gumtree Portal", "url": "https://www.gumtree.co.za/s-property/v1c2l1j1"}
                ]

            for source in scrape_targets:
                source_url = source.get('url')
                if not source_url: continue
                
                try:
                    update_task(task_id, f"Scraping {source.get('name', 'Source')}", f"🕷️ Connecting to {source_url}...")
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Extraction starting for {source_url}...")
                    result = await engine.scrape_url(source_url, task_id=task_id, search_query=search_location)
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Extraction result: {len(result.listings)} items found, confidence: {result.confidence_score}")
                    all_extracted_listings.extend(result.listings)
                    update_task(task_id, f"Scraping {source.get('name', 'Source')}", f"✅ Extracted {len(result.listings)} items.")
                except Exception as e:
                    update_task(task_id, "Error", f"❌ Failed to scrape {source.get('name', 'Source')}: {str(e)}")
                    continue
            
            if not all_extracted_listings:
                update_task(task_id, "Empty", "No listings found in sources.", completed=True)
                return

            # 4. AI Filter using Original Detailed Query
            update_task(task_id, "AI Filtering", f"🧠 Intelligence Engine evaluating {len(all_extracted_listings)} extracted items...")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] AI Filtering {len(all_extracted_listings)} items for query: '{search.search_query}'")
            scored_listings = await engine.extractor.filter_listings(all_extracted_listings, search.search_query)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] AI Scored: {len(scored_listings)} matches found above threshold.")
            
            if len(all_extracted_listings) > 0 and not scored_listings:
                 update_task(task_id, "Filtering", "⚠️ Evaluated extracted items, but none met the 50% match score threshold.")
            
            # 5. Save and Notify
            match_count = 0
            for item in scored_listings:
                try:
                    if item.match_score >= 50:
                        match_count += 1
                        item.user_id = search.user_id
                        await save_listing(item.model_dump())
                    
                        # WhatsApp/Notification integration
                        if search.alert_enabled:
                            tier = user_profile.get("tier", "free")
                            wa_number = user_profile.get("whatsapp")
                            email = user_profile.get("email")
                            
                            msg_subject = f"🎯 Sniper Match: {item.title}"
                            msg_body = f"🏠 {item.title}\n💰 R {item.price:,}\n📍 {item.address}\n\n✅ Reason: {item.match_reason}\n\n🔗 {item.source_url}"
                            
                            if tier == "paid" and wa_number:
                                await notifier_wa.send_whatsapp(wa_number, msg_body)
                            elif email:
                                await notifier_email.send_email(email, msg_subject, msg_body)
                except Exception as e:
                    print(f"Error saving match: {str(e)}")
                    continue
            
            update_task(task_id, "Complete", f"🎯 Found {match_count} high-quality matches!", completed=True)
                    
        except Exception as e:
            update_task(task_id, "Failed", f"🚨 Fatal system error: {str(e)}", completed=True)

@app.post("/deploy-sniper")
async def deploy_sniper(search: SearchTrigger, background_tasks: BackgroundTasks):
    task_id = create_task(search.user_id, search.search_query)
    background_tasks.add_task(run_sniper_task, search, task_id)
    
    return {
        "status": "accepted", 
        "task_id": task_id,
        "message": "Intelligence task started."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
