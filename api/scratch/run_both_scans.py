import sys
import asyncio
sys.path.append('api')
from main import get_db
from services.scheduler import scheduler

async def main():
    db = get_db()
    uid = 'taun_test_user'
    
    # 1. Run Tamboerskloof & Gardens scan
    doc1 = db.collection('users').document(uid).collection('alerts').document('alert_tamboerskloof_gardens').get()
    if doc1.exists:
        print("Triggering Scan 1: Tamboerskloof & Gardens...")
        alert1 = {"alert_id": "alert_tamboerskloof_gardens", **doc1.to_dict()}
        report1 = await scheduler.generate_alert_report(uid, alert1)
        if report1:
            print(f"Generated Report 1: {report1.get('id')} with {len(report1.get('ranked_listings', []))} listings.")
            # Check if 117772253 or Derwent is in it
            for r in report1.get('ranked_listings', []):
                print(f"  #{r.get('rank')} - {r.get('title')} ({r.get('area')}) - R{r.get('price')} - {r.get('url')}")
    
    # 2. Run Green Point & Sea Point scan
    doc2 = db.collection('users').document(uid).collection('alerts').document('alert_greenpoint_seapoint').get()
    if doc2.exists:
        print("\nTriggering Scan 2: Green Point & Sea Point...")
        alert2 = {"alert_id": "alert_greenpoint_seapoint", **doc2.to_dict()}
        report2 = await scheduler.generate_alert_report(uid, alert2)
        if report2:
            print(f"Generated Report 2: {report2.get('id')} with {len(report2.get('ranked_listings', []))} listings.")
            for r in report2.get('ranked_listings', []):
                print(f"  #{r.get('rank')} - {r.get('title')} ({r.get('area')}) - R{r.get('price')} - {r.get('url')}")

if __name__ == '__main__':
    asyncio.run(main())

