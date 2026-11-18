import sys
from typing import Any, Dict, List
from fastapi import APIRouter, BackgroundTasks, HTTPException
from google.cloud import firestore
from pydantic import BaseModel
from services.database import get_db

router = APIRouter(tags=["reports-pro"])


def print_safe(msg):
    try:
        safe_msg = str(msg).encode("ascii", "ignore").decode("ascii")
        print(safe_msg)
        sys.stdout.flush()
    except Exception:
        pass


def get_effective_user_id(requested_id: str, uid: str = "R4R2k7z2XAQGgRjB57ctZcOkEbp2") -> str:
    if requested_id and requested_id not in ["null", "undefined", "None", ""]:
        return requested_id
    return uid


@router.get("/reports/{user_id}")
async def get_user_reports_endpoint(user_id: str):
    """Fetches all generated AI reports and Top 10 rankings for a user."""
    try:
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(user_id, dummy_uid)
        db = get_db()
        docs = db.collection("users").document(effective_id).collection("reports")\
                 .order_by("created_at", direction=firestore.Query.DESCENDING)\
                 .limit(30).stream()
        reports = [{"id": d.id, **d.to_dict()} for d in docs]
        return {"status": "success", "reports": reports}
    except Exception as e:
        print_safe(f"[GET REPORTS ERROR] {e}")
        return {"status": "success", "reports": []}

@router.post("/trigger-report/{user_id}/{alert_id}")
async def trigger_report_now(user_id: str, alert_id: str, background_tasks: BackgroundTasks):
    """Manually triggers an on-demand report generation for a specific alert."""
    try:
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(user_id, dummy_uid)
        db = get_db()
        doc = db.collection("users").document(effective_id).collection("alerts").document(alert_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        alert_data = {"alert_id": alert_id, **doc.to_dict()}
        from services.scheduler import scheduler
        report = await scheduler.generate_alert_report(effective_id, alert_data)
        return {"status": "success", "report": report}
    except Exception as e:
        print_safe(f"[TRIGGER REPORT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProAuditRequest(BaseModel):
    listing_id: str
    report_id: str
    user_id: str

class TopupCreditsRequest(BaseModel):
    user_id: str
    pack: str = "starter_5"
    credits: int = 5



class UpdateLocationsRequest(BaseModel):
    report_id: str
    user_id: str
    anchors: List[Dict[str, Any]]

class VerifyAvailabilityRequest(BaseModel):
    report_id: str
    user_id: str

@router.post("/api/reports/pro-audit")
async def generate_pro_audit_endpoint(req: ProAuditRequest):
    """
    Unlocks a high-precision Pro AI Vision Report for a specific listing in a report.
    Costs 1 Pro Credit (R10). Results are permanently cached on the listing.
    """
    try:
        from services.pro_report_generator import generate_pro_ai_report
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        user_ref = db.collection("users").document(effective_id)
        u_doc = user_ref.get()
        user_data = u_doc.to_dict() if u_doc.exists else {}
        user_credits = user_data.get("pro_credits", 5)
        
        rep_ref = db.collection("users").document(effective_id).collection("reports").document(req.report_id)
        rep_doc = rep_ref.get()
        if not rep_doc.exists:
            rep_ref = db.collection("users").document("taun_test_user").collection("reports").document(req.report_id)
            rep_doc = rep_ref.get()
            if not rep_doc.exists:
                raise HTTPException(status_code=404, detail="Report not found")
        
        rep_data = rep_doc.to_dict()
        ranked = rep_data.get("ranked_listings", [])
        
        target_listing = None
        target_idx = -1
        for idx, item in enumerate(ranked):
            if str(item.get("listing_id")) == str(req.listing_id):
                target_listing = item
                target_idx = idx
                break
                
        if not target_listing:
            raise HTTPException(status_code=404, detail=f"Listing {req.listing_id} not found in report")
            
        # 1. If already audited, return cached report for free!
        if target_listing.get("pro_report"):
            return {
                "status": "success",
                "pro_report": target_listing["pro_report"],
                "is_cached": True,
                "remaining_credits": user_credits
            }
            
        # 2. Check credits
        if user_credits < 1:
            return {
                "status": "insufficient_credits",
                "pro_credits": user_credits,
                "message": "You need 1 Pro Credit (R10) to unlock this forensic AI report."
            }
            
        # 3. Generate Pro Report
        user_prompt = rep_data.get("user_prompt", "")
        personal_tastes = rep_data.get("personal_tastes", "")
        pro_report = await generate_pro_ai_report(
            listing=target_listing,
            user_prompt=user_prompt,
            personal_tastes=personal_tastes,
            user_id=effective_id
        )
        
        # 4. Deduct 1 credit & update user
        new_credits = max(0, user_credits - 1)
        user_ref.set({"pro_credits": new_credits}, merge=True)
        # also update taun_test_user if effective_id != taun_test_user
        if effective_id != "taun_test_user":
            db.collection("users").document("taun_test_user").set({"pro_credits": new_credits}, merge=True)
        
        # 5. Save pro_report permanently on the listing in the report
        target_listing["pro_report"] = pro_report
        target_listing["vision_audit"] = pro_report
        ranked[target_idx] = target_listing
        rep_ref.update({"ranked_listings": ranked})
        
        return {
            "status": "success",
            "pro_report": pro_report,
            "is_cached": False,
            "remaining_credits": new_credits
        }
    except Exception as e:
        print_safe(f"[PRO AUDIT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/credits/topup")
async def topup_credits_endpoint(req: TopupCreditsRequest):
    """Adds Pro Credits to a user wallet (e.g. 5 Pro Reports for R50)."""
    try:
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        user_ref = db.collection("users").document(effective_id)
        u_doc = user_ref.get()
        current_credits = (u_doc.to_dict() if u_doc.exists else {}).get("pro_credits", 5)
        
        new_credits = current_credits + req.credits
        user_ref.set({"pro_credits": new_credits}, merge=True)
        if effective_id != "taun_test_user":
            db.collection("users").document("taun_test_user").set({"pro_credits": new_credits}, merge=True)
            
        return {
            "status": "success",
            "credits_added": req.credits,
            "new_balance": new_credits,
            "message": f"Successfully added {req.credits} Pro Credits. New balance: {new_credits}."
        }
    except Exception as e:
        print_safe(f"[TOPUP ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/api/reports/update-locations")
async def update_report_locations_endpoint(req: UpdateLocationsRequest):
    """
    Updates the user's custom location anchors for a report and recalculates
    proximity and travel times (driving, walking, cycling) for all listings.
    """
    try:
        from services.commute_service import calculate_listing_proximities
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        rep_ref = db.collection("users").document(effective_id).collection("reports").document(req.report_id)
        rep_doc = rep_ref.get()
        if not rep_doc.exists:
            rep_ref = db.collection("users").document("taun_test_user").collection("reports").document(req.report_id)
            rep_doc = rep_ref.get()
            if not rep_doc.exists:
                raise HTTPException(status_code=404, detail="Report not found")
                
        rep_data = rep_doc.to_dict()
        ranked = rep_data.get("ranked_listings", [])
        
        # Recalculate proximity for each listing
        for item in ranked:
            address = item.get("address") or item.get("title") or "Gardens, Cape Town"
            item["location_proximity"] = await calculate_listing_proximities(address, req.anchors)
            
        rep_ref.update({
            "ranked_listings": ranked,
            "location_anchors": req.anchors,
            "commute_anchors": req.anchors
        })
        
        return {
            "status": "success",
            "location_anchors": req.anchors,
            "listings": ranked,
            "message": f"Updated proximity to {len(req.anchors)} locations across {len(ranked)} listings."
        }
    except Exception as e:
        print_safe(f"[UPDATE LOCATIONS ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/reports/verify-availability")
async def verify_availability_endpoint(req: VerifyAvailabilityRequest):
    """
    Checks real-time availability of all listings in a report against Property24/Gumtree.
    Identifies listings that are removed (404), Under Offer, or Let Agreed.
    Updates the report in Firestore and returns updated listing availability data.
    """
    try:
        from services.availability_checker import verify_report_listings_availability
        db = get_db()
        dummy_uid = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"
        effective_id = get_effective_user_id(req.user_id, dummy_uid)
        
        rep_ref = db.collection("users").document(effective_id).collection("reports").document(req.report_id)
        rep_doc = rep_ref.get()
        if not rep_doc.exists:
            rep_ref = db.collection("users").document("taun_test_user").collection("reports").document(req.report_id)
            rep_doc = rep_ref.get()
            if not rep_doc.exists:
                raise HTTPException(status_code=404, detail="Report not found")
                
        rep_data = rep_doc.to_dict()
        ranked = rep_data.get("ranked_listings", [])
        
        result = await verify_report_listings_availability(ranked)
        
        # Persist updated availability status to Firestore
        rep_ref.update({
            "ranked_listings": result["listings"],
            "last_availability_check": result["checked_at"]
        })
        
        return {
            "status": "success",
            "active_count": result["active_count"],
            "unavailable_count": result["unavailable_count"],
            "unavailable_ids": result["unavailable_ids"],
            "listings": result["listings"],
            "checked_at": result["checked_at"]
        }
    except Exception as e:
        print_safe(f"[VERIFY AVAILABILITY ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

