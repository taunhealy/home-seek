import asyncio
import re
import time
from typing import Dict, Any, List
from bs4 import BeautifulSoup
from services.p24_client import p24_client

_STATUS_BADGE_RE = re.compile(
    r'\b(Let Agreed|Under Offer|Withdrawn|Sold|Off Market|Expired|Rented)\b',
    re.I,
)
_EXPIRED_VISIBLE_RE = re.compile(
    r'(?:this\s+(?:listing|property)\s+(?:has\s+expired|is\s+no\s+longer\s+available|is\s+unavailable)'
    r'|(?:listing|property)\s+(?:not\s+found|has\s+been\s+removed|expired)'
    r'|sorry,?\s+this\s+property\s+is\s+no\s+longer\s+available)',
    re.I,
)


async def check_single_listing_availability(
    url: str, cache_ttl_seconds: float = 3600
) -> Dict[str, Any]:
    if not url:
        return {
            "is_available": False,
            "verified": True,
            "status_reason": "Missing URL",
            "last_verified_at": time.time(),
        }

    try:
        html, status_code, final_url = await p24_client.fetch_html_with_status(
            url, cache_ttl_seconds=cache_ttl_seconds
        )

        # Definite HTTP removal / expiry
        if status_code in (404, 410):
            return {
                "is_available": False,
                "verified": True,
                "status_reason": f"Expired / Removed (HTTP {status_code})",
                "last_verified_at": time.time(),
            }

        if not html:
            # Rate-limited, circuit open, or transient network failure: never suppress falsely
            return {
                "is_available": True,
                "verified": False,
                "status_reason": "Skipped (Rate-Limit / Unavailable)",
                "last_verified_at": time.time(),
            }

        # Check if Property24 redirected a specific listing URL back to a suburb search page
        lid_match = re.search(r'/(\d{7,10})(?:[/?#]|$)', url)
        if lid_match and final_url and lid_match.group(1) not in final_url:
            p24_client.remove_cache(url)
            return {
                "is_available": False,
                "verified": True,
                "status_reason": "Expired (Redirected to Search)",
                "last_verified_at": time.time(),
            }

        # Strip non-visible nodes (<script>, <style>, <select>/<option>) to avoid false positives from Report Issue JSON
        soup = BeautifulSoup(html, 'html.parser')
        for tag in soup(['script', 'style', 'noscript', 'select', 'option']):
            tag.decompose()

        # 1. Check for genuine status tags / banners / expired alerts
        for status_el in soup.find_all(
            class_=re.compile(r'p24_listingStatus|p24_status|p24_badge|p24_tag|p24_expired|p24_alert|alert', re.I)
        ):
            el_txt = status_el.get_text(' ', strip=True)
            m = _STATUS_BADGE_RE.search(el_txt)
            if m:
                p24_client.remove_cache(url)
                return {
                    "is_available": False,
                    "verified": True,
                    "status_reason": f"Off-Market ({m.group(1).strip()})",
                    "last_verified_at": time.time(),
                }
            if _EXPIRED_VISIBLE_RE.search(el_txt):
                p24_client.remove_cache(url)
                return {
                    "is_available": False,
                    "verified": True,
                    "status_reason": "Expired / No Longer Available",
                    "last_verified_at": time.time(),
                }

        # 2. Check headings / visible body text for explicit expiry notices
        visible_text = soup.get_text(' ', strip=True)
        if _EXPIRED_VISIBLE_RE.search(visible_text):
            p24_client.remove_cache(url)
            return {
                "is_available": False,
                "verified": True,
                "status_reason": "No Longer Available",
                "last_verified_at": time.time(),
            }

        # 3. Detect silent fallback to search-results page without listing detail container
        has_search_tiles = bool(soup.find('div', class_=re.compile(r'p24_regularTile|p24_tileContainer', re.I)))
        has_detail_price = bool(soup.find(class_=re.compile(r'p24_listingDetail|p24_gallery|p24_mainImage|p24_description', re.I)))
        if has_search_tiles and not has_detail_price:
            p24_client.remove_cache(url)
            return {
                "is_available": False,
                "verified": True,
                "status_reason": "Expired (Search Fallback)",
                "last_verified_at": time.time(),
            }

        return {
            "is_available": True,
            "verified": True,
            "status_reason": "Active Listing",
            "last_verified_at": time.time(),
        }

    except Exception:
        return {
            "is_available": True,
            "verified": False,
            "status_reason": "Active Listing",
            "last_verified_at": time.time(),
        }

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
