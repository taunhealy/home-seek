import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from services.database import get_db

def query_db():
    try:
        db = get_db()
        docs = db.collection("listings").limit(50).stream()
        count = 0
        m2m = []
        for d in docs:
            count += 1
            data = d.to_dict()
            title = data.get("title", "")
            lease = data.get("lease_period", "")
            rtype = data.get("rental_type", "")
            desc = data.get("description", "")
            combined = f"{title} {lease} {rtype} {desc}".lower()
            if any(k in combined for k in ["month to month", "month-to-month", "m2m", "monthly", "flexible", "short-term"]):
                m2m.append(data)
                
        print(f"Total inspected: {count}, M2M hits: {len(m2m)}")
        for x in m2m[:5]:
            print(f"- {x.get('title')} | R{x.get('price')} | {x.get('address')} | {x.get('lease_period')}")
    except Exception as e:
        print("Query error:", e)

if __name__ == "__main__":
    query_db()
