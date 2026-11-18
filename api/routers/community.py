import re
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["community"])

_DEFAULT_DUMMY_UID = "R4R2k7z2XAQGgRjB57ctZcOkEbp2"


class AuthCredentialsPayload(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = ""


class ProfileSettingsPayload(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class SubmitAddressRequest(BaseModel):
    listing_id: str
    address: str
    suburb: Optional[str] = ""


class CommentPayload(BaseModel):
    user_id: str
    body: str


@router.post("/api/auth/register")
async def register_user_endpoint(payload: AuthCredentialsPayload):
    from services.community_db import register_email_user
    res = register_email_user(payload.email, payload.password, payload.display_name or "")
    if res["status"] == "invalid":
        raise HTTPException(status_code=400, detail=res["detail"])
    if res["status"] == "conflict":
        raise HTTPException(status_code=409, detail=res["detail"])
    return res


@router.post("/api/auth/login")
async def login_user_endpoint(payload: AuthCredentialsPayload):
    from services.community_db import login_email_user
    res = login_email_user(payload.email, payload.password)
    if res["status"] == "unauthorized":
        raise HTTPException(status_code=401, detail=res["detail"])
    return res


@router.put("/api/user-profile/{user_id}/settings")
async def update_user_profile_settings(user_id: str, payload: ProfileSettingsPayload):
    from services.community_db import update_user_community_profile
    from core.firebase_client import get_effective_user_id

    effective_id = get_effective_user_id(user_id, _DEFAULT_DUMMY_UID)
    res = update_user_community_profile(
        effective_id,
        nickname=payload.nickname,
        avatar_url=payload.avatar_url,
    )
    if res.get("status") in ("invalid_nickname", "nickname_taken", "invalid_avatar", "invalid_user"):
        raise HTTPException(status_code=400, detail=res.get("detail") or "Invalid profile settings.")
    return {
        "status": "success",
        "nickname": res.get("nickname"),
        "avatar_url": res.get("avatar_url"),
    }


@router.post("/api/listings/submit-address")
async def submit_listing_address(req: SubmitAddressRequest):
    """
    Allows a user to manually submit a street address for a listing whose address
    was withheld/unknown, geocodes it, and persists it in the shared DB pool & cache.
    Strictly rejects listings that already have a verified street address or leave the designated area.
    """
    from services.listings_db import get_listing_by_id, is_missing_address_text, update_listing_address
    from services.live_search import update_cached_listing_address
    from services.address_normalizer import CAPE_TOWN_SUBURBS, _haversine_km, geocode_address_precision

    clean_addr = (req.address or "").strip()
    if len(clean_addr) < 4 or is_missing_address_text(clean_addr):
        raise HTTPException(status_code=400, detail="Please enter a valid street name/number (e.g. 14 Derwent Rd, Gardens).")

    stored_listing = get_listing_by_id(req.listing_id)
    if stored_listing and stored_listing.get("is_address_withheld") == 0 and not is_missing_address_text(stored_listing.get("address")):
        raise HTTPException(status_code=409, detail="This listing already has a street address.")

    designated_suburb = (stored_listing.get("suburb") if stored_listing else None) or (req.suburb or "").strip()
    sub_key = designated_suburb.lower().strip()
    sub_center = CAPE_TOWN_SUBURBS.get(sub_key)
    if not sub_center and stored_listing and stored_listing.get("lat") is not None and stored_listing.get("lng") is not None:
        sub_center = (float(stored_listing["lat"]), float(stored_listing["lng"]))

    geo = geocode_address_precision(clean_addr, default_suburb=designated_suburb)
    new_lat = geo.get("lat")
    new_lng = geo.get("lng")
    formatted_addr = geo.get("formatted_address") or (
        f"{clean_addr}, {designated_suburb}" if designated_suburb and designated_suburb.lower() not in clean_addr.lower() else clean_addr
    )

    if new_lat is None or new_lng is None or geo.get("is_withheld"):
        raise HTTPException(
            status_code=400,
            detail=f"Could not pinpoint that street address in {designated_suburb or 'the designated area'}. Please include street name and number.",
        )

    if sub_center:
        dist_km = _haversine_km(float(new_lat), float(new_lng), sub_center[0], sub_center[1])
        if dist_km > 3.5:
            raise HTTPException(
                status_code=400,
                detail=f"Address must stay within {designated_suburb or 'the designated area'} (geocoded point is {dist_km:.1f} km away).",
            )

    if sub_key:
        raw_lower = clean_addr.lower()
        for other_sub in CAPE_TOWN_SUBURBS.keys():
            if other_sub != sub_key and len(other_sub) >= 4 and re.search(rf"\b{re.escape(other_sub)}\b", raw_lower):
                raise HTTPException(
                    status_code=400,
                    detail=f"Address cannot reference {other_sub.title()} — it must stay within {designated_suburb}.",
                )

    extra_fields: Dict[str, Any] = {}
    try:
        from services.acoustic_registry import evaluate_listing_acoustics
        if new_lat is not None and new_lng is not None:
            ac = evaluate_listing_acoustics(address=formatted_addr, lat=float(new_lat), lng=float(new_lng), suburb=designated_suburb)
            if isinstance(ac, dict):
                extra_fields["acoustic_audit"] = ac
                if ac.get("noise_risk"):
                    extra_fields["noise_risk"] = ac["noise_risk"]
                if "is_main_road" in ac:
                    extra_fields["is_main_road"] = bool(ac["is_main_road"])
    except Exception:
        pass

    db_res = update_listing_address(
        listing_id=req.listing_id,
        new_address=formatted_addr,
        lat=new_lat,
        lng=new_lng,
        extra_fields=extra_fields,
    )
    if db_res.get("status") == "already_has_address":
        raise HTTPException(status_code=409, detail="This listing already has a street address.")

    cache_patch = {
        "address": formatted_addr,
        "is_address_withheld": False,
        "address_source": "user_submitted",
        **({"lat": new_lat} if new_lat is not None else {}),
        **({"lng": new_lng} if new_lng is not None else {}),
        **extra_fields,
    }
    cache_updated = update_cached_listing_address(req.listing_id, cache_patch)
    if db_res.get("status") == "not_found" and not cache_updated:
        raise HTTPException(status_code=404, detail="Listing not found in database or cache.")

    return {
        "status": "success",
        "listing_id": req.listing_id,
        "address": formatted_addr,
        "lat": new_lat,
        "lng": new_lng,
        "is_address_withheld": False,
        "address_source": "user_submitted",
        **extra_fields,
    }


@router.get("/api/listings/comments/counts")
async def get_all_comment_counts():
    from services.community_db import get_comment_counts, get_latest_comments_by_listing, get_recent_comments_by_listing
    return {
        "counts": get_comment_counts(),
        "latest": get_latest_comments_by_listing(),
        "recent": get_recent_comments_by_listing(3),
    }


@router.get("/api/listings/nickname/{user_id}")
async def get_user_nickname_endpoint(user_id: str):
    from services.community_db import get_or_create_nickname
    return {"user_id": user_id, "nickname": get_or_create_nickname(user_id)}


@router.get("/api/listings/{listing_id}/comments")
async def list_listing_comments(listing_id: str):
    from services.community_db import get_listing_comments
    return {"comments": get_listing_comments(listing_id)}


@router.post("/api/listings/{listing_id}/comments")
async def add_listing_comment(listing_id: str, payload: CommentPayload):
    from services.community_db import create_listing_comment
    try:
        comment = create_listing_comment(listing_id, payload.user_id, payload.body)
        return {"status": "success", "comment": comment}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/api/listings/comments/{comment_id}")
async def edit_listing_comment(comment_id: str, payload: CommentPayload):
    from services.community_db import update_listing_comment
    try:
        res = update_listing_comment(comment_id, payload.user_id, payload.body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if res["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Comment not found.")
    if res["status"] == "forbidden":
        raise HTTPException(status_code=403, detail="You can only edit your own comments.")
    return {"status": "success", "comment": res["comment"]}


@router.delete("/api/listings/comments/{comment_id}")
async def remove_listing_comment(comment_id: str, user_id: str):
    from services.community_db import delete_listing_comment
    status = delete_listing_comment(comment_id, user_id)
    if status == "not_found":
        raise HTTPException(status_code=404, detail="Comment not found.")
    if status == "forbidden":
        raise HTTPException(status_code=403, detail="You can only delete your own comments.")
    return {"status": "success"}
