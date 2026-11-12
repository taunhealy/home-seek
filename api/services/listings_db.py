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

def upsert_listings(items: List[Dict[str, Any]], suburb_name: str) -> int:
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

        # Any existing listing in this suburb that was NOT in the fresh scrape has been rented / removed!
        # Mark missing listings as is_available = 0 so they disappear from search immediately.
        clean_ids = [str(it.get("id") or it.get("p24_id") or "").strip() for it in items if (it.get("id") or it.get("p24_id"))]
        clean_ids_formatted = [f"p24-{x}" if (not x.startswith("p24-") and x.isdigit()) else x for x in clean_ids]
        if clean_ids_formatted:
            placeholders = ",".join(["?"] * len(clean_ids_formatted))
            conn.execute(f"""
                UPDATE listings 
                SET is_available = 0, updated_at = ?
                WHERE suburb_normalized = ? 
                AND is_available = 1
                AND id NOT IN ({placeholders})
            """, [now, sub_norm] + clean_ids_formatted)

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

    query = """
        SELECT raw_json FROM listings
        WHERE suburb_normalized IN ({seq})
        AND is_available = 1
        AND price >= ?
        AND price <= ?
    """.format(seq=",".join(["?"] * len(clean_subs)))

    params: List[Any] = list(clean_subs) + [min_price, max_price]

    # Optional bedroom filter
    if beds and beds != "any":
        bed_str = "".join(filter(str.isdigit, str(beds)))
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
                results.append(json.loads(row["raw_json"]))
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

