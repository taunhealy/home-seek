import sys, asyncio, json
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.pro_report_generator import generate_pro_ai_report

async def run_test():
    db = get_db()
    rep = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale").get().to_dict()
    listings = rep.get("ranked_listings", [])
    target = None
    for l in listings:
        if l.get("listing_id") == "114409019":
            target = l
            break
            
    print("Testing generate_pro_ai_report on listing 114409019 (Palmhof)...")
    res = await generate_pro_ai_report(
        listing=target,
        user_prompt="Quiet 1-bedroom in Gardens for remote work & music production, mountain biking and surfing gear storage",
        personal_tastes="Remote web designer & electronic music producer. Low street noise is critical for monitors and recording. MTB bike transport and secure parking required.",
        user_id="taun_test_user"
    )
    print("\nPRO REPORT OUTPUT:")
    print(json.dumps(res, indent=2))

asyncio.run(run_test())

