import asyncio
import re
import time
from typing import Dict, Any, List
from services.p24_client import p24_client

async def check_single_listing_availability(url: str) -> Dict[str, Any]:
    if not url:
        return {"is_available": False, "status_reason": "Missing URL", "last_verified_at": time.time()}

    try:
        html = await p24_client.fetch_html(url, cache_ttl_seconds=3600)
        if not html:
            # If rate-limited or unavailable, assume active to avoid false suppression
            return {"is_available": True, "status_reason": "Active Listing", "last_verified_at": time.time()}

        # 1. Check for genuine status tags / banners
        status_match = re.search(r'class="[^"]*(?:p24_listingStatus|p24_status|p24_badge|p24_tag)[^"]*"[^>]*>\s*(Let Agreed|Under Offer|Withdrawn|Sold|Off Market)', html, re.I)
        if status_match:
            reason = status_match.group(1).strip()
            return {"is_available": False, "status_reason": f"Off-Market ({reason})", "last_verified_at": time.time()}

        # 2. Check if page contains notification banner or heading
        if re.search(r'<h[1-4][^>]*>[^<]*(?:no longer available|property not found|listing not found)[^<]*</h[1-4]>', html, re.I):
            return {"is_available": False, "status_reason": "No Longer Available", "last_verified_at": time.time()}

        return {"is_available": True, "status_reason": "Active Listing", "last_verified_at": time.time()}

    except Exception:
        return {"is_available": True, "status_reason": "Active Listing", "last_verified_at": time.time()}

async def verify_report_listings_availability(listings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Polite, rate-limit safe availability verification.
    Processes listings sequentially with p24_client concurrency throttling.
    """
    unavailable_count = 0
    active_count = 0
    unavailable_ids = []

    for item in listings:
        res = await check_single_listing_availability(item.get("url", ""))
        item["is_available"] = res["is_available"]
        item["availability_status"] = res["status_reason"]
        item["last_verified_at"] = res["last_verified_at"]

        if not res["is_available"]:
            unavailable_count += 1
            unavailable_ids.append(item.get("listing_id"))
        else:
            active_count += 1

    return {
        "total_checked": len(listings),
        "active_count": active_count,
        "unavailable_count": unavailable_count,
        "unavailable_ids": unavailable_ids,
        "listings": listings,
        "checked_at": time.time()
    }
