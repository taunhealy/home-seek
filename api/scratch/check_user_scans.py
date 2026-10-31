import sys
sys.path.append('api')
from main import get_db

db = get_db()
for uid in ['taun_test_user', 'R4R2k7z2XAQGgRjB57ctZcOkEbp2']:
    print(f"=== User: {uid} ===")
    alerts = list(db.collection('users').document(uid).collection('alerts').stream())
    print(f"Found {len(alerts)} alerts")
    for a in alerts:
        d = a.to_dict()
        print(f"  Alert [{a.id}]: name={d.get('name')} | areas={d.get('areas') or d.get('suburbs')} | budget={d.get('max_price')} | min_beds={d.get('min_bedrooms') or d.get('bedrooms')} | active={d.get('is_active', True)}")

    reports = list(db.collection('users').document(uid).collection('reports').stream())
    print(f"Found {len(reports)} reports")
    for r in reports:
        rd = r.to_dict()
        print(f"  Report [{r.id}]: title={rd.get('title')} | alert_id={rd.get('alert_id')} | areas={rd.get('areas_scouted')}")

