import re

file_path = r'c:\Ryoko\Projects\home-seek\api\main.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

models_code = '''
class UpdateLocationsRequest(BaseModel):
    report_id: str
    user_id: str
    anchors: List[Dict[str, Any]]
'''

if 'class UpdateLocationsRequest' not in content:
    content = content.replace('class VerifyAvailabilityRequest(BaseModel):', models_code + '\nclass VerifyAvailabilityRequest(BaseModel):')

endpoint_code = '''
@app.post("/api/reports/update-locations")
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
'''

if '/api/reports/update-locations' not in content:
    content = content.replace('@app.post("/api/reports/verify-availability")', endpoint_code + '\n@app.post("/api/reports/verify-availability")')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected update-locations endpoint into main.py!")

