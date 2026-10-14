import asyncio
import os
import sys
from pathlib import Path
import json

# Add api directory to path
current_dir = Path(__file__).resolve().parent
api_dir = current_dir.parent
sys.path.append(str(api_dir))

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Force Local Sniper mode & Headless
os.environ["LOCAL_SNIPER"] = "true"
os.environ["HEADLESS"] = "true"

from services.database import get_db, get_user_alerts, get_user_profile, save_search
from main_local import (
    deploy_sniper,
    fetch_user_alerts,
    update_alert,
    remove_alert,
    fetch_user_listings,
    autonomous_pulse_heartbeat_once,
    engine
)

async def run_full_alert_and_scanner_test():
    print("\n" + "="*70)
    print("🎯 STARTING E2E TEST: Alert Setup, Alert Management & Scheduled Scanner")
    print("="*70)

    test_user_id = "taun_test_user"
    db = get_db()
    
    # Ensure test user profile exists
    profile = await get_user_profile(test_user_id)
    print(f"\n[STEP 0] Verified User Profile: {test_user_id} (Tier: {profile.get('tier', 'free')})")

    # Start the persistent scraper engine
    print("\n[INIT] Launching Persistent Sniper Engine...")
    await engine.start()

    test_search_id = None

    try:
        # =====================================================================
        # STEP 1: SETUP ALERT (Deploy Sniper with Sea View & Hout Bay)
        # =====================================================================
        print("\n" + "-"*60)
        print("📍 STEP 1: Setting up New Alert: 'Hout Bay Apartment with Sea View'")
        print("-"*60)

        alert_payload = {
            "user_id": test_user_id,
            "target_area": "Hout Bay",
            "search_query": "AI Radar: Hout Bay (Sea Views, Apartment)",
            "alert_enabled": True,
            "is_active": True,
            "max_price": 120000,
            "property_type": "Apartment",
            "property_sub_type": "Whole",
            "require_verified_sea_view": True,
            "must_include": ["Sea Views"],
            "rental_type": "long-term",
            "pet_friendly": False,
            "sources": ["Property24"],
            "strict_mode": False
        }

        # Save search alert for user
        test_search_id = await save_search(test_user_id, alert_payload)
        assert test_search_id is not None, "Failed to create alert in database"
        print(f"✅ Alert successfully created! ID: {test_search_id}")
        print(f"   Target: {alert_payload['target_area']} | Property Type: {alert_payload['property_type']}")
        print(f"   Max Price: R{alert_payload['max_price']:,} | Require Sea View: {alert_payload['require_verified_sea_view']}")

        # =====================================================================
        # STEP 2: MANAGE ALERTS (Fetch, Update, Verify)
        # =====================================================================
        print("\n" + "-"*60)
        print("⚙️ STEP 2: Managing Alerts (Fetch & Update)")
        print("-"*60)

        # 2a. Fetch user alerts
        alerts = await fetch_user_alerts(test_user_id)
        found_alert = next((a for a in alerts if a.get("id") == test_search_id or a.get("search_id") == test_search_id), None)
        assert found_alert is not None, f"Created alert {test_search_id} not found in user alerts list!"
        print(f"✅ Fetched alert from API: Found alert for '{found_alert.get('target_area')}'")
        assert found_alert.get("require_verified_sea_view") is True, "Alert sea view flag mismatch"

        # 2b. Test Update: Toggle to Standby (is_active: False)
        print("\n[2b] Testing Alert Management: Toggle Standby (is_active: False)...")
        update_res = await update_alert(test_user_id, test_search_id, {"is_active": False})
        assert update_res.get("status") == "ok", "Failed to update alert to standby"
        
        updated_alerts = await fetch_user_alerts(test_user_id)
        alert_standby = next((a for a in updated_alerts if a.get("id") == test_search_id or a.get("search_id") == test_search_id), None)
        assert alert_standby.get("is_active") is False, "Alert is_active was not updated to False"
        print("✅ Alert successfully toggled to Standby (is_active = False)")

        # 2c. Test Update: Toggle back to Active and adjust parameters
        print("\n[2c] Testing Alert Management: Re-activate and update criteria...")
        update_res = await update_alert(test_user_id, test_search_id, {
            "is_active": True,
            "max_price": 115000,
            "notes": "Automated verification test"
        })
        assert update_res.get("status") == "ok", "Failed to re-activate alert"
        
        active_alerts = await fetch_user_alerts(test_user_id)
        alert_active = next((a for a in active_alerts if a.get("id") == test_search_id or a.get("search_id") == test_search_id), None)
        assert alert_active.get("is_active") is True, "Alert is_active was not restored to True"
        assert alert_active.get("max_price") == 115000, "Alert max_price update failed"
        print("✅ Alert successfully updated & re-activated (is_active = True, max_price = R115,000)")

        # =====================================================================
        # STEP 3: SCHEDULED SCANNER EXECUTION
        # =====================================================================
        print("\n" + "-"*60)
        print("📡 STEP 3: Executing Scheduled Scanner (Pulse Heartbeat)")
        print("-"*60)
        print("Simulating autonomous heartbeat scan cycle...")
        
        # Clear previous test listings for Hout Bay from user's collection if any
        existing_listings = await fetch_user_listings(test_user_id)
        for l in existing_listings:
            if "hout bay" in str(l.get("address", "")).lower() or "hout bay" in str(l.get("title", "")).lower():
                db.collection("users").document(test_user_id).collection("listings").document(l["id"]).delete()
                print(f"   [CLEANUP] Pruned old test listing: {l['id']}")

        # Trigger heartbeat cycle for Hout Bay
        await autonomous_pulse_heartbeat_once(target_query="Hout Bay")
        print("✅ Scheduled scanner pulse completed.")

        # =====================================================================
        # STEP 4: VERIFY PROPERTY DISCOVERY & SEA VIEW MATCH
        # =====================================================================
        print("\n" + "-"*60)
        print("🔍 STEP 4: Verifying Discovered Properties in User Dashboard")
        print("-"*60)

        user_listings = await fetch_user_listings(test_user_id)
        print(f"Total user listings in dashboard: {len(user_listings)}")

        hout_bay_listings = [
            l for l in user_listings 
            if "hout bay" in str(l.get("address", "")).lower() or "hout bay" in str(l.get("title", "")).lower()
        ]
        
        print(f"Discovered Hout Bay listings for {test_user_id}: {len(hout_bay_listings)}")
        
        sea_view_apartments = [
            l for l in hout_bay_listings 
            if l.get("view_category") == "Sea" and str(l.get("property_type", "")).lower() == "apartment"
        ]

        print(f"\n🌟 Matched Hout Bay Apartments with Sea View: {len(sea_view_apartments)}")
        for idx, listing in enumerate(sea_view_apartments):
            print(f"\n--- MATCH #{idx+1} ---")
            print(f"  Title:         {listing.get('title')}")
            print(f"  Price:         R{listing.get('price'):,}")
            print(f"  Area:          {listing.get('address')}")
            print(f"  Property Type: {listing.get('property_type')}")
            print(f"  View:          {listing.get('view_category')}")
            print(f"  Bedrooms:      {listing.get('bedrooms')}")
            print(f"  Bathrooms:     {listing.get('bathrooms')}")
            print(f"  Source:        {listing.get('platform')}")
            print(f"  URL:           {listing.get('source_url')}")
            if listing.get('ai_report'):
                print(f"  Verdict:       {listing.get('ai_report', {}).get('verdict')}")

        assert len(sea_view_apartments) > 0, "Expected at least 1 Hout Bay apartment with sea view to be found by the scanner!"
        print(f"\n✅ VERIFICATION SUCCESS: Scheduled scanner found and matched: '{sea_view_apartments[0].get('title')}' in {sea_view_apartments[0].get('address')} with {sea_view_apartments[0].get('view_category')} view!")

        # =====================================================================
        # STEP 5: ALERT DELETION / CLEANUP
        # =====================================================================
        print("\n" + "-"*60)
        print("🗑️ STEP 5: Managing Alerts (Delete Test Alert)")
        print("-"*60)

        del_res = await remove_alert(test_user_id, test_search_id)
        assert del_res.get("status") == "ok", "Failed to delete alert"
        
        post_del_alerts = await fetch_user_alerts(test_user_id)
        assert not any(a.get("id") == test_search_id or a.get("search_id") == test_search_id for a in post_del_alerts), "Alert was not deleted!"
        print(f"✅ Successfully deleted test alert '{test_search_id}' from user dashboard.")

        print("\n" + "="*70)
        print("🎉 ALL TESTS PASSED SUCCESSFULLY!")
        print("="*70)

    finally:
        # Gracefully stop the browser engine
        print("\n[CLEANUP] Stopping Persistent Sniper Engine...")
        await engine.stop()
        print("[CLEANUP] Persistent Engine Stopped cleanly.")

if __name__ == "__main__":
    asyncio.run(run_full_alert_and_scanner_test())
