import asyncio
import os
import sys
import json
from dotenv import load_dotenv

# Load api/.env
load_dotenv("api/.env")
load_dotenv(".env")

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath("api"))

from intelligence.evaluator import PropertyEvaluator
from services.agency_reputation import lookup_agency_reputation

async def main():
    with open("scratch/parsed_summary.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    rep = lookup_agency_reputation("Close Realty", area="Hout Bay")

    listing = {
        "title": data["title"],
        "price": 17000,
        "bedrooms": 2,
        "bathrooms": 1,
        "sqm": None,
        "address": "Valley Road, Hout Bay Central, Cape Town",
        "property_type": "Cottage",
        "property_sub_type": "Whole",
        "rental_type": "long-term",
        "is_direct_landlord": False,
        "agency_name": rep.get("canonical_name", "Close Realty"),
        "agency_rating": rep.get("google_rating"),
        "agency_flags": rep.get("flags", []),
        "is_pet_friendly": True,
        "is_furnished": False,
        "available_date": "2026-12-01",
        "amenities": ["Parking for 2 cars", "Shared heated pool", "Garden with faux grass", "Prepaid electricity", "Water included"],
        "description": data["description"],
        "source_url": "https://www.property24.com/to-rent/hout-bay-central/hout-bay/western-cape/16694/111058260?vn=True",
        "image_urls": data["images"]
    }

    commute_anchors = [
        {
            "label": "Work (Amazon River Club HQ)",
            "target_place": "Amazon River Club, Observatory",
            "max_distance_km": 30,
            "max_commute_mins": 45,
            "commute_mode": "driving"
        },
        {
            "label": "Cape Town CBD / Foreshore",
            "target_place": "Cape Town CBD",
            "max_distance_km": 25,
            "max_commute_mins": 40,
            "commute_mode": "driving"
        }
    ]

    evaluator = PropertyEvaluator(model_name="gemini-2.5-flash")

    print("🚀 Running AI Property Intelligence Evaluation...")
    report = await evaluator.evaluate_property(
        listing=listing,
        must_include=["Secure Parking Bay", "Pet Friendly", "Fibre Ready"],
        must_exclude=["Room to let / Shared", "Commercial"],
        lifestyle_signals=["Quiet Nature Setting", "Remote Worker Friendly"],
        strict_mode=False,
        commute_anchors=commute_anchors
    )

    report_dict = report.dict()
    with open("scratch/evaluated_report.json", "w", encoding="utf-8") as f:
        json.dump(report_dict, f, indent=2)

    print("\n================== 🎯 EVALUATION REPORT ==================")
    print(f"FIT SCORE: {report.fit_score}% (Match: {report.is_match})")
    print(f"VERDICT: {report.verdict}\n")

    print("--- 🌟 PROS ---")
    for p in report.pros:
        print(f"  • {p}")

    print("\n--- ⚠️ CONS & HIDDEN COSTS ---")
    for c in report.cons_and_hidden_costs:
        print(f"  • {c}")

    print("\n--- 📋 IN-PERSON VIEWING CHECKLIST ---")
    for ch in report.viewing_checklist:
        print(f"  [ ] {ch}")

    if report.vision_intel:
        print("\n--- 🌊 PHOTO VIEW CHECK ---")
        print(f"  Status: {report.vision_intel.sea_view_type} (Score: {report.vision_intel.sea_view_score}%)")
        print(f"  Description: {report.vision_intel.view_description}")

    if report.commute_intel:
        print("\n--- 📍 COMMUTE & DISTANCE ANCHORS ---")
        for ci in report.commute_intel:
            print(f"  • {ci.anchor_label}: {ci.distance_text} (~{ci.duration_text}) [Within Threshold: {ci.is_within_threshold}]")

    print("\n==========================================================")

if __name__ == "__main__":
    asyncio.run(main())
