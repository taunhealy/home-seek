import os
import json
import sqlite3
import time
import asyncio
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "listings_pool.db")

def _get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the centralized listings pool SQLite database with indexes."""
    with _get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS listings (
                id TEXT PRIMARY KEY,
                p24_id TEXT,
                suburb TEXT NOT NULL,
                suburb_normalized TEXT NOT NULL,
                title TEXT,
                address TEXT,
                price INTEGER,
                bedrooms REAL,
                bathrooms REAL,
                sqm REAL,
                parking TEXT,
                image TEXT,
                url TEXT,
                lat REAL,
                lng REAL,
                is_address_withheld INTEGER DEFAULT 0,
                has_garage INTEGER DEFAULT 0,
                has_secure_bay INTEGER DEFAULT 0,
                parking_type TEXT,
                stove_type TEXT,
                has_inverter INTEGER DEFAULT 0,
                pet_friendly INTEGER DEFAULT 0,
                fibre_ready INTEGER DEFAULT 0,
                price_value_pct REAL,
                is_available INTEGER DEFAULT 1,
                raw_json TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_suburb ON listings(suburb_normalized)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_price ON listings(price)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_beds ON listings(bedrooms)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_available ON listings(is_available)")

        # Sync state tracking table for suburbs
        conn.execute("""
            CREATE TABLE IF NOT EXISTS suburb_sync_state (
                suburb_normalized TEXT PRIMARY KEY,
                suburb_display TEXT NOT NULL,
                last_synced_at REAL NOT NULL,
                listing_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'ok',
                error_msg TEXT
            )
        """)
        conn.commit()

# Ensure table exists on import
init_db()

def upsert_listings(items: List[Dict[str, Any]], suburb_name: str, is_full_suburb_scrape: bool = False) -> int:
    """Inserts or updates listings in the shared database pool."""
    if not items:
        return 0
    now = time.time()
    sub_norm = suburb_name.strip().lower()
    count = 0

    with _get_connection() as conn:
        for it in items:
            lid = str(it.get("id") or it.get("p24_id") or "").strip()
            if not lid:
                continue
            if not lid.startswith("p24-") and lid.isdigit():
                lid = f"p24-{lid}"
            p24_id = str(it.get("p24_id") or lid.replace("p24-", "")).strip()
            sub = str(it.get("suburb") or suburb_name).strip()
            title = it.get("title", "")
            address = it.get("address", "")
            price = int(it.get("price") or 0)
            bedrooms = float(it.get("bedrooms") or 0)
            bathrooms = float(it.get("bathrooms") or 0)
            sqm = float(it.get("sqm")) if it.get("sqm") is not None else None
            parking = it.get("parking", "")
            image = it.get("image", "")
            url = it.get("url", "")
            lat = float(it.get("lat")) if it.get("lat") is not None else None
            lng = float(it.get("lng")) if it.get("lng") is not None else None
            is_withheld = 1 if it.get("is_address_withheld") else 0
            has_garage = 1 if it.get("has_garage") else 0
            has_secure_bay = 1 if it.get("has_secure_bay") else 0
            parking_type = it.get("parking_type", "")
            stove_type = it.get("stove_type", "")
            has_inverter = 1 if it.get("has_inverter") else 0
            pet_friendly = 1 if it.get("pet_friendly") else 0
            fibre_ready = 1 if it.get("fibre_ready") else 0
            price_value_pct = float(it.get("price_value_pct")) if it.get("price_value_pct") is not None else None

            ex_ts_row = conn.execute(
                "SELECT created_at FROM listings WHERE id = ?",
                (lid,),
            ).fetchone()
            if ex_ts_row and ex_ts_row["created_at"]:
                orig_ts = float(ex_ts_row["created_at"])
                cur_ts = it.get("first_seen_at")
                it = {**it, "first_seen_at": min(orig_ts, float(cur_ts)) if cur_ts else orig_ts}
            elif not it.get("first_seen_at"):
                it = {**it, "first_seen_at": int(now)}

            if is_withheld:
                existing = conn.execute(
                    "SELECT address, lat, lng, is_address_withheld, raw_json FROM listings WHERE id = ?",
                    (lid,),
                ).fetchone()
                if existing and existing["is_address_withheld"] == 0 and existing["address"]:
                    try:
                        ex_raw = json.loads(existing["raw_json"] or "{}")
                    except Exception:
                        ex_raw = {}
                    if ex_raw.get("address_source") == "user_submitted":
                        address = existing["address"]
                        lat = existing["lat"]
                        lng = existing["lng"]
                        is_withheld = 0
                        it = {**it, "address": address, "lat": lat, "lng": lng, "is_address_withheld": False, "address_source": "user_submitted"}
                        for k in ("acoustic_audit", "noise_risk", "is_main_road"):
                            if k in ex_raw:
                                it[k] = ex_raw[k]

            if stove_type in ("electric", "unknown", None, ""):
                ex_vision = conn.execute(
                    "SELECT stove_type, raw_json FROM listings WHERE id = ?",
                    (lid,),
                ).fetchone()
                if ex_vision and ex_vision["stove_type"] in ("gas", "induction"):
                    try:
                        ex_v_raw = json.loads(ex_vision["raw_json"] or "{}")
                    except Exception:
                        ex_v_raw = {}
                    if ex_v_raw.get("vision_verified"):
                        stove_type = ex_vision["stove_type"]
                        it = {**it, "stove_type": stove_type, "vision_verified": True}

            raw_json = json.dumps(it)

            conn.execute("""
                INSERT INTO listings (
                    id, p24_id, suburb, suburb_normalized, title, address, price,
                    bedrooms, bathrooms, sqm, parking, image, url, lat, lng,
                    is_address_withheld, has_garage, has_secure_bay, parking_type,
                    stove_type, has_inverter, pet_friendly, fibre_ready,
                    price_value_pct, is_available, raw_json, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, 1, ?, ?, ?
                )
                ON CONFLICT(id) DO UPDATE SET
                    suburb=excluded.suburb,
                    suburb_normalized=excluded.suburb_normalized,
                    title=excluded.title,
                    address=excluded.address,
                    price=excluded.price,
                    bedrooms=excluded.bedrooms,
                    bathrooms=excluded.bathrooms,
                    sqm=excluded.sqm,
                    parking=excluded.parking,
                    image=excluded.image,
                    url=excluded.url,
                    lat=excluded.lat,
                    lng=excluded.lng,
                    is_address_withheld=excluded.is_address_withheld,
                    has_garage=excluded.has_garage,
                    has_secure_bay=excluded.has_secure_bay,
                    parking_type=excluded.parking_type,
                    stove_type=excluded.stove_type,
                    has_inverter=excluded.has_inverter,
                    pet_friendly=excluded.pet_friendly,
                    fibre_ready=excluded.fibre_ready,
                    price_value_pct=excluded.price_value_pct,
                    raw_json=excluded.raw_json,
                    updated_at=excluded.updated_at
            """, (
                lid, p24_id, sub, sub_norm, title, address, price,
                bedrooms, bathrooms, sqm, parking, image, url, lat, lng,
                is_withheld, has_garage, has_secure_bay, parking_type,
                stove_type, has_inverter, pet_friendly, fibre_ready,
                price_value_pct, raw_json, now, now
            ))
            count += 1

        # Only mark missing listings as unavailable when a full unfiltered suburb scrape ran
        clean_ids = [str(it.get("id") or it.get("p24_id") or "").strip() for it in items if (it.get("id") or it.get("p24_id"))]
        clean_ids_formatted = [f"p24-{x}" if (not x.startswith("p24-") and x.isdigit()) else x for x in clean_ids]
        if is_full_suburb_scrape and clean_ids_formatted:
            placeholders = ",".join(["?"] * len(clean_ids_formatted))
            conn.execute(f"""
                UPDATE listings 
                SET is_available = 0
                WHERE suburb_normalized = ? 
                AND is_available = 1
                AND id NOT IN ({placeholders})
            """, [sub_norm] + clean_ids_formatted)

        # Record sync state for suburb
        conn.execute("""
            INSERT INTO suburb_sync_state (suburb_normalized, suburb_display, last_synced_at, listing_count, status)
            VALUES (?, ?, ?, ?, 'ok')
            ON CONFLICT(suburb_normalized) DO UPDATE SET
                last_synced_at=excluded.last_synced_at,
                listing_count=excluded.listing_count,
                status='ok',
                error_msg=NULL
        """, (sub_norm, suburb_name, now, count))
        conn.commit()

    return count

def query_listings(
    suburbs: List[str],
    min_price: int = 0,
    max_price: int = 999999,
    beds: str = "any"
) -> List[Dict[str, Any]]:
    """Queries the centralized pool instantly using indexed SQL."""
    if not suburbs:
        return []

    clean_subs = [s.strip().lower() for s in suburbs if s.strip()]
    if not clean_subs:
        return []

    sub_clauses = []
    sub_params: List[Any] = []
    for sub in clean_subs:
        sub_clauses.append(
            "(suburb_normalized = ? OR LOWER(address) LIKE ? OR LOWER(address) LIKE ? OR LOWER(address) LIKE ? OR LOWER(url) LIKE ?)"
        )
        sub_params.extend([sub, f"{sub},%", f"% {sub},%", f"% {sub}", f"%/{sub.replace(' ', '-')}/%"])

    query = """
        SELECT created_at, raw_json FROM listings
        WHERE ({sub_where})
        AND is_available = 1
        AND price >= ?
        AND price <= ?
    """.format(sub_where=" OR ".join(sub_clauses))

    params: List[Any] = sub_params + [min_price, max_price]

    # Optional bedroom filter
    if beds and beds != "any":
        import re as _re
        bed_str = _re.sub(r"[^\d.]", "", str(beds))
        if bed_str:
            bed_num = float(bed_str)
            query += " AND bedrooms >= ?"
            params.append(bed_num)

    query += " ORDER BY price ASC"

    results = []
    with _get_connection() as conn:
        cursor = conn.execute(query, params)
        for row in cursor.fetchall():
            try:
                item = json.loads(row["raw_json"])
                if row["created_at"]:
                    cur_fs = item.get("first_seen_at")
                    item["first_seen_at"] = min(float(row["created_at"]), float(cur_fs)) if cur_fs else row["created_at"]
                results.append(item)
            except Exception:
                pass
    return results

def get_suburb_sync_age_seconds(suburb_name: str) -> float:
    """Returns seconds since the suburb was last synced, or 999999999 if never synced."""
    sub_norm = suburb_name.strip().lower()
    with _get_connection() as conn:
        cursor = conn.execute(
            "SELECT last_synced_at FROM suburb_sync_state WHERE suburb_normalized = ?",
            (sub_norm,)
        )
        row = cursor.fetchone()
        if row:
            return time.time() - float(row["last_synced_at"])
    return 999999999.0

def mark_listing_unavailable(listing_id: str):
    """Marks a listing as unavailable / expired."""
    lid = str(listing_id).strip()
    with _get_connection() as conn:
        conn.execute("UPDATE listings SET is_available = 0 WHERE id = ? OR p24_id = ?", (lid, lid.replace("p24-", "")))
        conn.commit()

def is_missing_address_text(addr: Optional[str]) -> bool:
    """Returns True if an address string is empty, withheld, or lacks a street suffix."""
    import re
    s = (addr or "").strip().lower()
    if not s or "withheld" in s or "contact agent" in s or "to rent in" in s or "address" in s:
        return True
    has_street = bool(re.search(
        r'\b(?:street|st|road|rd|avenue|ave|drive|dr|way|wy|lane|ln|close|cl|crescent|cres|circle|cir|boulevard|blvd|terrace|terraces|walk|row|place|pl|court|ct)\b',
        s,
    ))
    return not has_street


def get_listing_by_id(listing_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a single listing's stored metadata by id or p24_id."""
    lid = str(listing_id).strip()
    raw_pid = lid.replace("p24-", "")
    norm_lid = f"p24-{raw_pid}" if raw_pid.isdigit() else lid
    with _get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM listings WHERE id = ? OR p24_id = ? LIMIT 1",
            (norm_lid, raw_pid),
        ).fetchone()
        return dict(row) if row else None


def update_listing_address(
    listing_id: str,
    new_address: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    extra_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Updates a listing's street address & coordinates in the shared DB pool,
    strictly only if the listing currently has no verified street address.
    """
    lid = str(listing_id).strip()
    raw_pid = lid.replace("p24-", "")
    norm_lid = f"p24-{raw_pid}" if raw_pid.isdigit() else lid
    now = time.time()

    with _get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM listings WHERE id = ? OR p24_id = ? LIMIT 1",
            (norm_lid, raw_pid),
        ).fetchone()
        if not row:
            return {"status": "not_found"}

        if row["is_address_withheld"] == 0 and not is_missing_address_text(row["address"]):
            return {"status": "already_has_address", "address": row["address"]}

        try:
            raw = json.loads(row["raw_json"] or "{}")
        except Exception:
            raw = {}

        new_lat = lat if lat is not None else row["lat"]
        new_lng = lng if lng is not None else row["lng"]
        raw["address"] = new_address
        raw["is_address_withheld"] = False
        raw["address_source"] = "user_submitted"
        if new_lat is not None:
            raw["lat"] = new_lat
        if new_lng is not None:
            raw["lng"] = new_lng
        if extra_fields:
            raw.update(extra_fields)

        conn.execute(
            """
            UPDATE listings
            SET address = ?, lat = ?, lng = ?, is_address_withheld = 0, raw_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_address, new_lat, new_lng, json.dumps(raw), now, row["id"]),
        )
        conn.commit()
        return {"status": "updated", "listing_id": row["id"], "item": raw}


def update_listing_vision_attributes(
    listing_id: str,
    stove_type: Optional[str] = None,
    vision_summary: Optional[Dict[str, Any]] = None,
) -> bool:
    """Persists AI Vision-verified attributes (e.g. stove_type) into the shared listings DB pool."""
    lid = str(listing_id).strip()
    if not lid:
        return False
    raw_pid = lid.replace("p24-", "")
    norm_lid = f"p24-{raw_pid}" if raw_pid.isdigit() else lid
    now = time.time()

    with _get_connection() as conn:
        row = conn.execute(
            "SELECT id, stove_type, raw_json FROM listings WHERE id = ? OR p24_id = ? LIMIT 1",
            (norm_lid, raw_pid),
        ).fetchone()
        if not row:
            return False

        try:
            raw = json.loads(row["raw_json"] or "{}")
        except Exception:
            raw = {}

        new_stove = stove_type if stove_type in ("gas", "induction", "electric") else row["stove_type"]
        if new_stove:
            raw["stove_type"] = new_stove
        raw["vision_verified"] = True
        if vision_summary:
            raw["vision_audit"] = {
                "wfh_layout_verdict": vision_summary.get("wfh_layout_verdict"),
                "window_light_audit": vision_summary.get("window_light_audit"),
                "wall_acoustic_audit": vision_summary.get("wall_acoustic_audit"),
                "ceiling_volume_audit": vision_summary.get("ceiling_volume_audit"),
                "lighting_fixtures_audit": vision_summary.get("lighting_fixtures_audit"),
                "exterior_building_audit": vision_summary.get("exterior_building_audit"),
            }

        conn.execute(
            "UPDATE listings SET stove_type = ?, raw_json = ?, updated_at = ? WHERE id = ?",
            (new_stove, json.dumps(raw), now, row["id"]),
        )
        conn.commit()
        return True


def query_ghost_listings(
    suburbs: List[str],
    min_price: int = 0,
    max_price: int = 999999,
    beds: str = "any",
    limit: int = 180,
) -> List[Dict[str, Any]]:
    """Queries past / unavailable (is_available = 0) listings for the map Ghost Layer."""
    if not suburbs:
        return []

    clean_subs = [s.strip().lower() for s in suburbs if s.strip()]
    if not clean_subs:
        return []

    sub_clauses = []
    sub_params: List[Any] = []
    for sub in clean_subs:
        sub_clauses.append(
            "(suburb_normalized = ? OR LOWER(address) LIKE ? OR LOWER(address) LIKE ? OR LOWER(address) LIKE ? OR LOWER(url) LIKE ?)"
        )
        sub_params.extend([sub, f"{sub},%", f"% {sub},%", f"% {sub}", f"%/{sub.replace(' ', '-')}/%"])

    query = """
        SELECT created_at, updated_at, raw_json FROM listings
        WHERE ({sub_where})
        AND is_available = 0
        AND lat IS NOT NULL AND lng IS NOT NULL
        AND price >= ?
        AND price <= ?
    """.format(sub_where=" OR ".join(sub_clauses))

    params: List[Any] = sub_params + [min_price, max_price]
    if beds and beds != "any":
        import re as _re
        bed_str = _re.sub(r"[^\d.]", "", str(beds))
        if bed_str:
            query += " AND bedrooms >= ?"
            params.append(float(bed_str))

    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(int(limit))

    results: List[Dict[str, Any]] = []
    with _get_connection() as conn:
        for row in conn.execute(query, params).fetchall():
            try:
                item = json.loads(row["raw_json"])
                results.append({
                    "id": item.get("id") or f"ghost-{item.get('p24_id')}",
                    "p24_id": item.get("p24_id"),
                    "title": item.get("title") or "Past Listing",
                    "address": item.get("address") or item.get("suburb") or "",
                    "suburb": item.get("suburb") or "",
                    "price": item.get("price") or 0,
                    "bedrooms": item.get("bedrooms"),
                    "bathrooms": item.get("bathrooms"),
                    "sqm": item.get("sqm"),
                    "lat": item.get("lat"),
                    "lng": item.get("lng"),
                    "url": item.get("url"),
                    "image": item.get("image"),
                    "first_seen_at": row["created_at"],
                    "last_seen_at": row["updated_at"],
                })
            except Exception:
                pass
    return results


def get_pool_stats() -> Dict[str, Any]:
    """Returns database summary statistics."""
    with _get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) as c FROM listings WHERE is_available = 1").fetchone()["c"]
        suburbs_count = conn.execute("SELECT COUNT(*) as c FROM suburb_sync_state").fetchone()["c"]
        recent = conn.execute("SELECT suburb_display, last_synced_at, listing_count FROM suburb_sync_state ORDER BY last_synced_at DESC LIMIT 10").fetchall()
        return {
            "total_available_listings": total,
            "synced_suburbs_count": suburbs_count,
            "recent_syncs": [
                {
                    "suburb": r["suburb_display"],
                    "age_minutes": round((time.time() - r["last_synced_at"]) / 60, 1),
                    "count": r["listing_count"]
                }
                for r in recent
            ]
        }

