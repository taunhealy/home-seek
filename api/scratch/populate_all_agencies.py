import sys, re, urllib.request
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.agency_reputation import lookup_agency_reputation

db = get_db()
doc = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale").get()
data = doc.to_dict()
ranked = data.get("ranked_listings", [])

print(f"Inspecting agency for {len(ranked)} listings...")

for l in ranked:
    lid = l.get("listing_id")
    url = l.get("url")
    curr_agency = l.get("agency_name")
    
    if not curr_agency and url:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.property24.com/"})
            html = urllib.request.urlopen(req, timeout=5).read().decode("utf-8", errors="ignore")
            
            agency_schema = re.search(r'\{[^{}]*"@type"\s*:\s*"(?:RealEstateAgent|Organization)"[^{}]*"name"\s*:\s*"([^"]+)"', html)
            if agency_schema:
                curr_agency = agency_schema.group(1).strip()
            else:
                m_agency = re.search(r'"agencyName"\s*:\s*"([^"]+)"', html) or \
                           re.search(r'class="[^"]*p24_agencyLogoName[^"]*"[^>]*>\s*<span>([^<]+)</span>', html, re.S) or \
                           re.search(r'alt="Property to rent by ([^"]+)"', html)
                if m_agency:
                    curr_agency = m_agency.group(1).strip()
        except Exception as e:
            print(f"Error fetching {lid}: {e}")

    l["agency_name"] = curr_agency
    if curr_agency:
        rep = lookup_agency_reputation(curr_agency)
        l["agency_rating"] = rep.get("google_rating")
        l["agency_review_count"] = rep.get("google_review_count")
        l["agency_risk_level"] = rep.get("risk_level", "low")
        l["agency_flags"] = rep.get("flags", [])
        l["agency_complaint_sample"] = rep.get("recent_complaint_sample")
        l["agency_url"] = rep.get("google_reviews_url")
        l["agency_hellopeter_rating"] = rep.get("hellopeter_rating")

    print(f"#{l.get('rank')} - {lid} | Agency: {l.get('agency_name')} | Rating: {l.get('agency_rating')} stars | Risk: {l.get('agency_risk_level')}")

db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale").update({"ranked_listings": ranked})
print("Updated report in Firestore with all Agency reviews and risk scores!")
