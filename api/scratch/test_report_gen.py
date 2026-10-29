import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import asyncio
from services.scheduler import scheduler

async def test_run():
    print('Testing scheduler generate_alert_report for taun_test_user...')
    fake_alert = {
        'alert_id': 'test_alert_1',
        'title': 'Gardens & Tamboerskloof AI Daily Scout',
        'areas': ['Gardens', 'Tamboerskloof'],
        'prompt': 'Remote web designer who loves mountain biking, needs acoustic quiet, wants to walk to cafes',
        'personal_tastes': 'Acoustic privacy for music, safe storage for bike, unpretentious vibe, near Kloof St',
        'max_price': 18000,
        'min_bedrooms': 1,
        'property_type': 'Apartment',
        'notify_whatsapp': False,
        'notify_email': False
    }
    report = await scheduler.generate_alert_report('taun_test_user', fake_alert)
    print('Report generated:', report['id'], '| Ranked count:', len(report['ranked_listings']))
    for r in report['ranked_listings'][:3]:
        print(f"#{r['rank']} {r['title']} (R {r['price']}) - {r['short_explanation'][:75]}...")

if __name__ == '__main__':
    asyncio.run(test_run())
