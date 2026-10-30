import sys, asyncio
sys.path.insert(0, "c:/Ryoko/Projects/home-seek/api")
from services.database import get_db
from services.pro_report_generator import generate_pro_ai_report

async def update_blackbrick():
    db = get_db()
    rep_ref = db.collection("users").document("taun_test_user").collection("reports").document("rep_20261029_174526_test_ale")
    rep_doc = rep_ref.get()
    if not rep_doc.exists:
        print("Report not found!")
        return

    rep = rep_doc.to_dict()
    ranked = rep.get("ranked_listings", [])
    
    target_item = None
    target_idx = -1
    for idx, item in enumerate(ranked):
        if str(item.get("listing_id")) == "117408746":
            target_item = item
            target_idx = idx
            break

    if not target_item:
        print("Listing 117408746 not found in report!")
        return

    print("Found listing 117408746! Updating to BlackBrick Gardens (Apartment Hotel)...")
    target_item["building_name"] = "BlackBrick Gardens (Apartment Hotel)"
    target_item["has_lift"] = "yes"
    target_item["floor_number"] = "3rd Floor"
    target_item["parking"] = 0
    target_item["sqm"] = 48
    target_item["title"] = "1 Bedroom Apartment Hotel Suite"

    target_item["short_explanation"] = (
        "Design-led 48 m² serviced suite in BlackBrick Gardens (Apartment Hotel). "
        "Superb on-site hotel amenities (Rosetta coffee, co-working club, rooftop pool, 100% backup power), "
        "but operates as a transient hybrid hotel with high tourist turnover, zero private sports gear storage, "
        "and weekend rooftop social noise."
    )

    target_item["pros"] = [
        "100% Load shedding proof (industrial generator backup)",
        "On-site Rosetta Roastery, co-working club, gym & rooftop pool",
        "Designer turnkey interior with 24/7 digital concierge & security"
    ]

    target_item["cons"] = [
        "⚠️ Hybrid apartment hotel — high transient tourist turnover & corridor noise",
        "⚠️ Compact 48 m² hotel layout — zero private storage for MTB or sports gear",
        "Street parking only — no dedicated secure bay included",
        "Weekend social noise from rooftop restaurant and bar"
    ]

    target_item["verdict"] = "Lifestyle Aparthotel: Excellent for networking & lock-up-and-go remote work, but unsuited for quiet acoustic isolation or sports gear."

    # Generate fresh Pro AI Report tailored to BlackBrick Gardens
    print("Generating comprehensive Pro AI Report for BlackBrick Gardens...")
    pro_rep = await generate_pro_ai_report(
        listing=target_item,
        user_prompt="Quiet 1-bedroom in Gardens for remote work & music production, mountain biking and surfing gear storage",
        personal_tastes="Remote web designer & electronic music producer. Low street noise is critical for monitors and recording. MTB bike transport and secure parking required.",
        user_id="taun_test_user"
    )

    # Enhance Pro Report with specific aparthotel insights
    pro_rep["universal_foundation"]["building_dossier"]["name"] = "BlackBrick Gardens (Apartment Hotel)"
    pro_rep["universal_foundation"]["building_dossier"]["airbnb_party_risk"] = "Very High — Hybrid Apartment Hotel with daily tourist turnover"
    pro_rep["universal_foundation"]["building_dossier"]["community_summary"] = (
        "Trendy design-led vertical village with Rosetta Roastery, co-working club, and rooftop pool. "
        "High hospitality guest turnover creates frequent hallway footfall and suitcase noise."
    )
    pro_rep["universal_foundation"]["building_dossier"]["soundproofing"] = "Double-glazed windows block street noise, but internal hotel hallway doors lack heavy acoustic dampening."
    pro_rep["universal_foundation"]["accessibility_and_parking"]["parking_summary"] = "Street parking only — no dedicated basement bay included"
    pro_rep["universal_foundation"]["accessibility_and_parking"]["has_lift"] = "yes"
    pro_rep["universal_foundation"]["accessibility_and_parking"]["floor"] = "3rd Floor"
    pro_rep["universal_foundation"]["accessibility_and_parking"]["stair_climb_effort"] = "High-speed hotel elevator access available"

    pro_rep["personalized_audit"]["wfh_studio_feasibility"]["status"] = "Compromised for Audio"
    pro_rep["personalized_audit"]["wfh_studio_feasibility"]["desk_fit_analysis"] = (
        "A 140cm desk fits into the living area, and on-site co-working spaces are fantastic for laptop work. "
        "However, music production with open studio monitors will disrupt neighboring hotel guests and pick up hallway turnover."
    )
    pro_rep["personalized_audit"]["gear_storage_and_transit"]["status"] = "Restricted"
    pro_rep["personalized_audit"]["gear_storage_and_transit"]["details"] = (
        "While high-speed elevators make moving an MTB bike up to the 3rd floor effortless, "
        "the 48 m² hotel suite has zero lockable gear storage or balcony space. Bringing a muddy mountain bike into a boutique hotel lobby is strictly discouraged."
    )
    pro_rep["personalized_audit"]["tailored_advisor_verdict"] = (
        "While BlackBrick offers incredible amenities (Rosetta coffee, backup generators, co-working club), "
        "it is fundamentally an apartment hotel. The lack of private gear storage, street parking only, "
        "and daily tourist turnover make it a mismatch for a remote music producer with an MTB bike."
    )

    target_item["pro_report"] = pro_rep
    target_item["vision_audit"] = pro_rep

    ranked[target_idx] = target_item
    rep_ref.update({"ranked_listings": ranked})
    print("Listing 117408746 updated with BlackBrick Gardens Hotel Analysis & Pro Dossier!")

asyncio.run(update_blackbrick())

