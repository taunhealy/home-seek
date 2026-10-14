import asyncio
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv("api/.env")
load_dotenv(".env")

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath("api"))

from intelligence.evaluator import PropertyEvaluator
from services.templates import build_alert_subject, get_match_template

async def test_privacy_intelligence():
    with open("scratch/parsed_summary.json", "r", encoding="utf-8") as f:
        data = json.load(f)

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
        "agency_name": "Close Realty",
        "agency_rating": 3.4,
        "description": data["description"],
        "source_url": "https://www.property24.com/to-rent/hout-bay-central/hout-bay/western-cape/16694/111058260?vn=True",
        "image_urls": data["images"]
    }

    evaluator = PropertyEvaluator()

    print("--- 🧪 TEST 1: User Requires Private Garden & Independent Living (Strict Mode) ---")
    strict_report = await evaluator.evaluate_property(
        listing=listing,
        require_independent_living=True,
        require_private_entrance=True,
        require_private_garden=True,
        exclude_landlord_on_site=True,
        strict_mode=True
    )
    print(f"IS MATCH: {strict_report.is_match} (Expected: False)")
    print(f"FIT SCORE: {strict_report.fit_score}%")
    print(f"UNMET MUST-HAVES: {strict_report.unmet_must_haves}")
    print(f"TRIGGERED EXCLUSIONS: {strict_report.triggered_exclusions}")

    print("\n--- 🧪 TEST 2: User Requires Private Garden & Entrance (Advisory Mode) ---")
    advisory_report = await evaluator.evaluate_property(
        listing=listing,
        require_independent_living=True,
        require_private_entrance=True,
        require_private_garden=True,
        exclude_landlord_on_site=True,
        strict_mode=False
    )
    print(f"IS MATCH: {advisory_report.is_match} (Expected: True)")
    print(f"FIT SCORE: {advisory_report.fit_score}%")
    print(f"PRIVACY SCORE: {advisory_report.privacy_intel.privacy_score}% Autonomy")
    print(f"PRIVACY FLAGS: {advisory_report.privacy_intel.privacy_flags}")

    # Email Subject Generation Test
    subject = build_alert_subject(listing, report=advisory_report.dict())
    print(f"\n📧 DYNAMIC EMAIL SUBJECT LINE:")
    print(f"   --> {subject}")

    # Email Template Generation Test
    email_html = get_match_template(listing, report=advisory_report.dict())
    print(f"\n✉️ EMAIL HTML GENERATED: {len(email_html)} characters with Upfront Mismatch Notice included!")

if __name__ == "__main__":
    asyncio.run(test_privacy_intelligence())
