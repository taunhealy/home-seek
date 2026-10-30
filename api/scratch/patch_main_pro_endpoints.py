with open("c:/Ryoko/Projects/home-seek/api/main.py", "r", encoding="utf-8") as f:
    content = f.read()

target = """@app.post("/api/realview/analyze")
async def realview_analyze_endpoint(req: RealViewAnalyzeRequest):
    \"\"\"RealView™ Multimodal AI spatial reality check (Pro Feature).\"\"\"
    try:
        from services.lens_rectifier import analyze_spatial_reality_with_ai
        analysis = await analyze_spatial_reality_with_ai(req.image_url, req.room_type)
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        print_safe(f"[REALVIEW ANALYZE ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))"""

new_code = """@app.post("/api/realview/analyze")
async def realview_analyze_endpoint(req: RealViewAnalyzeRequest):
    \"\"\"RealView™ Multimodal AI spatial reality check (Pro Feature).\"\"\"
    try:
        from services.lens_rectifier import analyze_spatial_reality_with_ai
        analysis = await analyze_spatial_reality_with_ai(req.image_url, req.room_type)
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        print_safe(f"[REALVIEW ANALYZE ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProAuditRequest(BaseModel):
    listing_id: str
    report_id: str
    user_id: str

class TopupCreditsRequest(BaseModel):
    user_id: str
    pack: str = "starter_5"
    credits: int = 5

@app.post("/api/reports/pro-audit")
async def generate_pro_audit_endpoint(req: ProAuditRequest):
    \"\"\"
    Unlocks a high-precision Pro AI Vision Report for a specific listing in a report.
    Costs 1 Pro Credit (R10). Results are permanently cached on the listing.
    \"\"\"
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

@app.post("/api/credits/topup")
async def topup_credits_endpoint(req: TopupCreditsRequest):
    \"\"\"Adds Pro Credits to a user wallet (e.g. 5 Pro Reports for R50).\"\"\"
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
        raise HTTPException(status_code=500, detail=str(e))"""

if target in content:
    content = content.replace(target, new_code, 1)
    with open("c:/Ryoko/Projects/home-seek/api/main.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("main.py patched successfully!")
else:
    print("Target not found in main.py")

