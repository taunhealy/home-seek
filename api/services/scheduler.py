import asyncio
import datetime as dt
import hashlib
from typing import List, Dict, Any, Optional
from google.cloud import firestore
from services.database import get_db, print_safe
from services.ai_scout import scout_engine, ScoutPreferences, AIScoutResult
from services.notifications import EvolutionClient, ResendEmailClient

# South Africa Standard Time is UTC+2 (no daylight saving)
SAST_TZ = dt.timezone(dt.timedelta(hours=2))

class DailyScoutScheduler:
    """
    SaaS Daily Cron Engine:
    - Runs every day at 11:00 AM SAST (South African Standard Time)
    - Scouts and ranks the top 10 listings per active user alert
    - Stores the full insight report in Firestore (`users/{uid}/reports/{report_id}`)
    - Triggers WhatsApp and Email alerts with the top 3 highlights and direct report link
    """
    def __init__(self):
        self._task = None
        self._running = False
        self.last_run_date: Optional[str] = None
        self.evolution = EvolutionClient()
        self.email_client = ResendEmailClient()

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._cron_loop())
        print_safe("[SCHEDULER] ⏰ SaaS Daily AI Scout Scheduler initiated (Target: 11:00 AM SAST).")

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        print_safe("[SCHEDULER] SaaS Daily AI Scout Scheduler stopped.")

    async def _cron_loop(self):
        """Heartbeat check every 30 seconds to catch 11:00 AM SAST."""
        while self._running:
            try:
                now_sast = dt.datetime.now(SAST_TZ)
                today_str = now_sast.strftime("%Y-%m-%d")

                # Trigger at 11:00 AM (between 11:00 and 11:05 AM) once per calendar day
                if now_sast.hour == 11 and self.last_run_date != today_str:
                    print_safe(f"[SCHEDULER] 🎯 11:00 AM SAST reached on {today_str}! Commencing Global Daily AI Scout...")
                    self.last_run_date = today_str
                    await self.run_global_daily_scout()

            except asyncio.CancelledError:
                break
            except Exception as e:
                print_safe(f"[SCHEDULER LOOP ERROR] {e}")

            await asyncio.sleep(30)

    async def run_global_daily_scout(self, force_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Executes daily intelligence scout across all active user alerts or for a specific user.
        """
        db = get_db()
        if not db:
            print_safe("[SCHEDULER] Firestore not connected.")
            return []

        generated_reports = []
        try:
            # Query all active alerts across all users
            if force_user_id:
                alerts_docs = db.collection("users").document(force_user_id).collection("alerts").where("is_active", "==", True).stream()
                all_alerts = [{"user_id": force_user_id, "alert_id": d.id, **d.to_dict()} for d in alerts_docs]
            else:
                # Query across users' alerts collection without requiring composite indexes
                all_alerts = []
                users = db.collection("users").stream()
                for u in users:
                    alerts_docs = db.collection("users").document(u.id).collection("alerts").stream()
                    for d in alerts_docs:
                        data = d.to_dict()
                        if data.get("is_active") is not False:
                            all_alerts.append({"user_id": u.id, "alert_id": d.id, **data})

            print_safe(f"[SCHEDULER] Found {len(all_alerts)} active alerts to scout.")

            for alert in all_alerts:
                user_id = alert.get("user_id")
                if not user_id:
                    continue

                try:
                    report = await self.generate_alert_report(user_id, alert)
                    if report:
                        generated_reports.append(report)
                except Exception as alert_err:
                    print_safe(f"[SCHEDULER] Error processing alert {alert.get('alert_id')}: {alert_err}")

        except Exception as e:
            print_safe(f"[SCHEDULER] Error in run_global_daily_scout: {e}")

        return generated_reports

    async def generate_alert_report(self, user_id: str, alert: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Scouts portals, runs Gemini ranking, saves report to Firestore, and notifies user."""
        db = get_db()
        now_sast = dt.datetime.now(SAST_TZ)
        
        # Prepare preferences from alert config
        areas = alert.get("areas")
        if not areas:
            target_area = alert.get("target_area") or alert.get("search_query") or "Cape Town"
            areas = [a.strip() for a in target_area.split(",") if a.strip()]

        raw_b = alert.get("min_bedrooms")
        parsed_min_b = None
        if raw_b:
            if isinstance(raw_b, list):
                parsed_min_b = float(raw_b[0]) if raw_b else None
            else:
                try:
                    parsed_min_b = float(str(raw_b).replace("+", "").strip())
                except Exception:
                    parsed_min_b = None

        prefs = ScoutPreferences(
            prompt=alert.get("prompt") or alert.get("search_query") or "Looking for best rental matching my lifestyle",
            personal_tastes=alert.get("personal_tastes") or alert.get("lifestyle_prompt") or "",
            areas=areas,
            min_price=alert.get("min_price"),
            max_price=alert.get("max_price") or 20000,
            min_bedrooms=parsed_min_b,
            property_type=alert.get("property_type", "Apartment"),
            is_furnished=alert.get("is_furnished"),
            must_have_parking=bool(alert.get("must_have_parking", False))
        )

        print_safe(f"[SCHEDULER] Scouting for user {user_id} across {prefs.areas} (Max: R {prefs.max_price})...")
        scout_res: AIScoutResult = await scout_engine.scout_and_rank(prefs)

        # Slice top 10 listings
        top_10 = scout_res.ranked_listings[:10]
        ranked_dicts = [l.dict() for l in top_10]
        
        # Populate commute & location proximities if anchors are set
        anchors = alert.get("commute_anchors") or alert.get("location_anchors") or []
        if anchors:
            try:
                from services.commute_service import calculate_listing_proximities
                for item in ranked_dicts:
                    addr = item.get("address") or item.get("location") or item.get("title") or "Cape Town"
                    item["location_proximity"] = await calculate_listing_proximities(addr, anchors)
            except Exception as e:
                print_safe(f"[SCHEDULER PROXIMITY ERROR] {e}")

        report_id = f"rep_{now_sast.strftime('%Y%m%d_%H%M%S')}_{alert.get('alert_id', 'gen')[:8]}"
        report_data = {
            "id": report_id,
            "user_id": user_id,
            "alert_id": alert.get("alert_id"),
            "alert_title": alert.get("title") or f"{', '.join(prefs.areas)} Daily Scout",
            "created_at": now_sast.isoformat(),
            "created_at_timestamp": int(now_sast.timestamp()),
            "areas_scouted": prefs.areas,
            "total_found": scout_res.total_found,
            "overall_summary": scout_res.overall_summary,
            "user_prompt": prefs.prompt,
            "personal_tastes": prefs.personal_tastes,
            "max_price": prefs.max_price,
            "ranked_listings": ranked_dicts,
            "commute_anchors": anchors,
            "location_anchors": anchors
        }

        # 1. Save Report in User's Private Subcollection
        db.collection("users").document(user_id).collection("reports").document(report_id).set(report_data)
        
        # 2. Update Alert's last_run_at telemetry
        alert_ref = alert.get("alert_id")
        if alert_ref:
            try:
                db.collection("users").document(user_id).collection("alerts").document(alert_ref).set({
                    "last_run_at": now_sast.isoformat(),
                    "last_report_id": report_id,
                    "last_match_count": len(top_10)
                }, merge=True)
            except Exception:
                pass

        print_safe(f"[SCHEDULER] ✅ Saved Daily Report {report_id} with {len(top_10)} ranked listings.")

        # 3. Deliver Notifications (WhatsApp / Email)
        await self._dispatch_notifications(user_id, alert, report_data)

        return report_data

    async def _dispatch_notifications(self, user_id: str, alert: Dict[str, Any], report: Dict[str, Any]):
        """Builds concise, professional WhatsApp & Email digest of the top 3 options."""
        top_listings = report.get("ranked_listings", [])[:3]
        if not top_listings:
            return

        db = get_db()
        user_doc = db.collection("users").document(user_id).get()
        user_profile = user_doc.to_dict() if user_doc.exists else {}

        whatsapp_num = user_profile.get("whatsapp") or alert.get("whatsapp_number")
        email_addr = user_profile.get("email") or alert.get("notification_email")
        
        areas_str = ", ".join(report.get("areas_scouted", []))
        summary = report.get("overall_summary", "")

        # Format Top 3 items
        items_text = []
        for it in top_listings:
            price_str = f"R {it['price']:,} pm" if it.get("price") else "Price On Request"
            items_text.append(
                f"• *#{it['rank']} {it['title']}* ({price_str})\n"
                f"  📍 {it['address']}\n"
                f"  💡 {it['short_explanation']}\n"
                f"  🔗 {it['url']}"
            )
        bullet_points = "\n\n".join(items_text)

        wa_message = (
            f"🏡 *HomeSeek Daily Intelligence Report (11:00 AM SAST)*\n"
            f"📍 *Areas:* {areas_str}\n\n"
            f"🧠 *AI Advisor Insight:*\n{summary}\n\n"
            f"🏆 *Top Ranked Matches:*\n\n{bullet_points}\n\n"
            f"📊 View your full interactive Top 10 Report on your HomeSeek Dashboard."
        )

        # Dispatch WhatsApp
        if whatsapp_num and (alert.get("notify_whatsapp", True) or user_profile.get("notify_whatsapp")):
            try:
                await self.evolution.send_whatsapp(whatsapp_num, wa_message)
                print_safe(f"[SCHEDULER] WhatsApp digest sent to {whatsapp_num}")
            except Exception as e:
                print_safe(f"[SCHEDULER] WhatsApp send error: {e}")

        # Dispatch Email
        if email_addr and (alert.get("notify_email", True) or user_profile.get("notify_email")):
            try:
                subject = f"🏡 HomeSeek Top 10 Intelligence Report: {areas_str}"
                await self.email_client.send_email(email_addr, subject, wa_message)
                print_safe(f"[SCHEDULER] Email digest sent to {email_addr}")
            except Exception as e:
                print_safe(f"[SCHEDULER] Email send error: {e}")

scheduler = DailyScoutScheduler()

