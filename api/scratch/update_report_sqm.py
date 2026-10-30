import sys
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.ai_scout import enrich_candidate_listing

db = get_db()
reports_ref = db.collection("users").document("taun_test_user").collection("reports")
docs = list(reports_ref.stream())

print(f"Inspecting {len(docs)} reports for taun_test_user...")

for d in docs:
    rep_data = d.to_dict()
    ranked = rep_data.get("ranked_listings", [])
    updated = False

    for item in ranked:
        lid = item.get("listing_id")
        sqm = item.get("sqm")
        print(f"#{item.get('rank')} - {lid} - {sqm} m² - {item.get('title')}")

        # If sqm is missing or it is 117408746 (48m²)
        if not sqm or lid == "117408746":
            enrich_candidate_listing(item)
            # If 117408746 explicitly
            if lid == "117408746":
                item["sqm"] = 48
            
            sqm = item.get("sqm")
            print(f"   -> Enriched sqm: {sqm}")

            # Update spatial explanation and pros/cons based on sqm
            if sqm:
                if sqm < 45:
                    item["short_explanation"] = f"Compact {sqm} m² unit in Gardens. Clean starter flat, but cramped for dedicated remote work — fitting a workstation and gear will crowd the living space."
                    cons = [c for c in item.get("cons", []) if "footprint" not in c.lower() and "m²" not in c.lower()]
                    cons.append(f"⚠️ Compact {sqm} m² footprint — constrained for full WFH desk and gear storage")
                    item["cons"] = cons
                elif sqm <= 52:
                    item["short_explanation"] = f"Modest {sqm} m² 1-bedroom in Gardens. Functional living area, but tight for a dedicated music workstation or sports gear without multi-purpose furniture."
                    cons = [c for c in item.get("cons", []) if "floor plan" not in c.lower() and "m²" not in c.lower()]
                    cons.append(f"⚠️ Tight {sqm} m² floor plan — limited clearance for creative workstation and sports gear")
                    item["cons"] = cons
                elif sqm <= 65:
                    item["short_explanation"] = f"Well-proportioned {sqm} m² 1-bedroom in Gardens. Generous floor plan with ample dedicated room for a full WFH desk setup and gear storage without cluttering the lounge."
                    pros = item.get("pros", [])
                    if not any("m²" in p for p in pros):
                        pros.append(f"Generous {sqm} m² layout with dedicated work-from-home space")
                    item["pros"] = pros
                else:
                    item["short_explanation"] = f"Expansive {sqm} m² layout in Gardens. Superior acoustic volume and abundant dedicated zones for music production, monitors, and gear."
                    pros = item.get("pros", [])
                    if not any("m²" in p for p in pros):
                        pros.append(f"Expansive {sqm} m² floor plan with dedicated zones for work and gear")
                    item["pros"] = pros
            updated = True

    if updated:
        reports_ref.document(d.id).update({"ranked_listings": ranked})
        print(f"Updated report {d.id} with sqm data and spatial advisor evaluations!")

