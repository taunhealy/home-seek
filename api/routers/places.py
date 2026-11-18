import json
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

router = APIRouter(tags=["places"])


class RealViewAnalyzeRequest(BaseModel):
    image_url: str
    room_type: str = "bedroom"


@router.get("/api/realview/rectify")
async def realview_rectify_endpoint(url: str, k1: float = -0.22, k2: float = 0.06, fov_crop: float = 1.25):
    """RealView de-distortion: converts 0.5x ultra-wide photo to human eye natural perspective."""
    try:
        from services.lens_rectifier import fetch_image_bytes, rectify_image_bytes
        raw_bytes = fetch_image_bytes(url)
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Could not fetch image")
        rect_bytes = rectify_image_bytes(raw_bytes, k1=k1, k2=k2, fov_crop=fov_crop)
        return Response(content=rect_bytes, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/realview/analyze")
async def realview_analyze_endpoint(req: RealViewAnalyzeRequest):
    """RealView Multimodal AI spatial reality check (Pro Feature)."""
    try:
        from services.lens_rectifier import analyze_spatial_reality_with_ai
        analysis = await analyze_spatial_reality_with_ai(req.image_url, req.room_type)
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/places/autocomplete")
async def autocomplete_places_endpoint(q: str = "", limit: int = 8):
    try:
        from services.places_service import search_places
        results = await search_places(q, limit=limit)
        return {"status": "success", "query": q, "suggestions": results}
    except Exception:
        return {"status": "success", "query": q, "suggestions": []}


@router.get("/api/places/details")
async def place_details_endpoint(query: str = "", lat: Optional[float] = None, lng: Optional[float] = None):
    try:
        from services.places_service import get_place_details
        details = await get_place_details(query=query, lat=lat, lng=lng)
        if details:
            if isinstance(details.get("photo_urls"), str):
                try:
                    details["photo_urls"] = json.loads(details["photo_urls"])
                except Exception:
                    details["photo_urls"] = [details["photo_url"]] if details.get("photo_url") else []
            return {"status": "success", "place": details}
        return {"status": "not_found", "message": "Place details not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/api/places/photo")
async def place_photo_proxy(photo_reference: str, maxwidth: int = 1000):
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google Places API key not configured")
    photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth={maxwidth}&photo_reference={photo_reference}&key={api_key}"
    return RedirectResponse(url=photo_url, status_code=307)


@router.get("/api/config/mapbox")
async def get_mapbox_public_config():
    """Returns public Mapbox pk.* token for on-demand 3D Terrain Preview."""
    tok = (os.getenv("MAPBOX_ACCESS_TOKEN") or "").strip()
    if tok.startswith("pk."):
        return {"status": "success", "token": tok}
    return {"status": "unavailable", "token": None}
