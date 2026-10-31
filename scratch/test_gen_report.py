import asyncio, sys
sys.path.insert(0, 'c:/Ryoko/Projects/home-seek/api')
from services.database import get_db
from services.scheduler import scheduler

async def run_test():
    db = get_db()
    alerts = db.collection('users').document('taun_test_user').collection('alerts').stream()
    alert_doc = None
    for a in alerts:
        alert_doc = {"alert_id": a.id, **a.to_dict()}
        break
    if not alert_doc:
        print("No alert found for taun_test_user")
        return

    print("Generating report for alert:", alert_doc.get("alert_id"), "min_bedrooms:", alert_doc.get("min_bedrooms"), "max_price:", alert_doc.get("max_price"))
    rep = await scheduler.generate_alert_report('taun_test_user', alert_doc)
    print("Generated Report ID:", rep.get("id"))
    ranked = rep.get("ranked_listings", [])
    print(f"Ranked listings ({len(ranked)}):")
    for l in ranked:
        print(f"  #{l.get('rank')} {l.get('title')} | R {l.get('price')} | beds={l.get('bedrooms')} | img={bool(l.get('image'))} ({l.get('image')[:40]}...) | imgs={len(l.get('images') or [])}")

asyncio.run(run_test())

