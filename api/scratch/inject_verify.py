import re

with open(r'c:\Ryoko\Projects\home-seek\api\main.py', 'r', encoding='utf-8') as f:
    content = f.read()

req_class = """
class VerifyAvailabilityRequest(BaseModel):
    report_id: str
    user_id: str
"""

if "class VerifyAvailabilityRequest" not in content:
    # insert before @app.post("/api/reports/pro-audit")
    content = content.replace('@app.post("/api/reports/pro-audit")', req_class + '\n@app.post("/api/reports/pro-audit")')

endpoint_func = '''
@app.post("/api/reports/verify-availability")
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
'''

if "/api/reports/verify-availability" not in content:
    # insert before @app.get("/api/listing-photos")
    content = content.replace('@app.get("/api/listing-photos")', endpoint_func + '\n@app.get("/api/listing-photos")')

with open(r'c:\Ryoko\Projects\home-seek\api\main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected verify-availability endpoint into main.py")

