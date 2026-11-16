import sqlite3
import time
import uuid
import random
import hashlib
import secrets
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "community.db"

_ADJECTIVES = [
    "Quiet", "Sunny", "Brisk", "Coastal", "Clever", "Mellow", "Swift", "Amber",
    "Silver", "Breezy", "Calm", "Steady", "Nimble", "Bright", "Crisp", "Gentle",
    "Witty", "Bold", "Warm", "Velvet", "Cedar", "Granite", "Kloof", "Atlantic",
    "Alpine", "Golden", "Lush", "Urban", "Nordic", "Vivid",
]

_NOUNS = [
    "Pelican", "Dassie", "Protea", "Penguin", "Sunbird", "Mongoose", "Aloe",
    "Kelp", "Heron", "Kingfisher", "Osprey", "Gannet", "Fynbos", "Cove",
    "Ridge", "Terrace", "Lantern", "Compass", "Harbour", "Breeze", "Finch",
    "Cormorant", "Dolphin", "Canyon", "Meadow", "Falcon", "Otter", "Badger",
]


def _get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_community_db():
    with _get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_nicknames (
                user_id TEXT PRIMARY KEY,
                nickname TEXT UNIQUE NOT NULL,
                avatar_url TEXT,
                created_at REAL NOT NULL
            )
        """)
        try:
            conn.execute("ALTER TABLE user_nicknames ADD COLUMN avatar_url TEXT")
        except sqlite3.OperationalError:
            pass
        conn.execute("""
            CREATE TABLE IF NOT EXISTS listing_comments (
                id TEXT PRIMARY KEY,
                listing_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                nickname TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users_auth (
                user_id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                display_name TEXT,
                password_hash TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_comments_listing ON listing_comments(listing_id)")
        conn.commit()


init_community_db()


def _normalize_listing_id(listing_id: str) -> str:
    lid = str(listing_id or "").strip()
    raw = lid.replace("p24-", "")
    return f"p24-{raw}" if raw.isdigit() else lid


def _generate_reddit_nickname() -> str:
    adj = random.choice(_ADJECTIVES)
    noun = random.choice(_NOUNS)
    num = random.randint(10, 999)
    return f"{adj}{noun}{num}"


def get_or_create_nickname(user_id: str) -> str:
    uid = str(user_id or "").strip()
    if not uid:
        return _generate_reddit_nickname()

    with _get_connection() as conn:
        row = conn.execute("SELECT nickname FROM user_nicknames WHERE user_id = ?", (uid,)).fetchone()
        if row:
            return row["nickname"]

        now = time.time()
        for _ in range(25):
            candidate = _generate_reddit_nickname()
            try:
                conn.execute(
                    "INSERT INTO user_nicknames (user_id, nickname, created_at) VALUES (?, ?, ?)",
                    (uid, candidate, now),
                )
                conn.commit()
                return candidate
            except sqlite3.IntegrityError:
                continue

        fallback = f"Seeker{uuid.uuid4().hex[:6].upper()}"
        conn.execute(
            "INSERT OR IGNORE INTO user_nicknames (user_id, nickname, created_at) VALUES (?, ?, ?)",
            (uid, fallback, now),
        )
        conn.commit()
        return fallback


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    use_salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), use_salt.encode("utf-8"), 120_000)
    return f"{use_salt}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected_hex = stored.split("$", 1)
        return secrets.compare_digest(_hash_password(password, salt), stored)
    except Exception:
        return False


def register_email_user(email: str, password: str, display_name: str = "") -> Dict[str, Any]:
    clean_email = (email or "").strip().lower()
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        return {"status": "invalid", "detail": "Please enter a valid email address."}
    if not password or len(password) < 6:
        return {"status": "invalid", "detail": "Password must be at least 6 characters."}

    clean_name = (display_name or "").strip() or clean_email.split("@")[0]
    uid = f"local-{uuid.uuid4().hex[:12]}"
    pw_hash = _hash_password(password)
    now = time.time()

    with _get_connection() as conn:
        existing = conn.execute("SELECT user_id FROM users_auth WHERE email = ?", (clean_email,)).fetchone()
        if existing:
            return {"status": "conflict", "detail": "An account with this email already exists."}
        conn.execute(
            "INSERT INTO users_auth (user_id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, clean_email, clean_name, pw_hash, now),
        )
        conn.commit()

    nickname = get_or_create_nickname(uid)
    return {
        "status": "success",
        "user": {
            "uid": uid,
            "email": clean_email,
            "displayName": clean_name,
            "nickname": nickname,
            "avatar_url": None,
        },
    }


def login_email_user(email: str, password: str) -> Dict[str, Any]:
    clean_email = (email or "").strip().lower()
    if not clean_email or not password:
        return {"status": "unauthorized", "detail": "Email and password are required."}

    with _get_connection() as conn:
        row = conn.execute("SELECT * FROM users_auth WHERE email = ?", (clean_email,)).fetchone()
        if not row or not _verify_password(password, row["password_hash"]):
            return {"status": "unauthorized", "detail": "Invalid email or password."}

    cprof = get_user_community_profile(row["user_id"])
    return {
        "status": "success",
        "user": {
            "uid": row["user_id"],
            "email": row["email"],
            "displayName": row["display_name"] or clean_email.split("@")[0],
            "nickname": cprof.get("nickname"),
            "avatar_url": cprof.get("avatar_url"),
        },
    }


def get_user_community_profile(user_id: str) -> Dict[str, Optional[str]]:
    uid = str(user_id or "").strip()
    nickname = get_or_create_nickname(uid)
    if not uid:
        return {"nickname": nickname, "avatar_url": None}
    with _get_connection() as conn:
        row = conn.execute(
            "SELECT nickname, avatar_url FROM user_nicknames WHERE user_id = ?",
            (uid,),
        ).fetchone()
        if row:
            return {"nickname": row["nickname"], "avatar_url": row["avatar_url"]}
        return {"nickname": nickname, "avatar_url": None}


def update_user_community_profile(
    user_id: str,
    nickname: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> Dict[str, Any]:
    import re
    uid = str(user_id or "").strip()
    if not uid:
        return {"status": "invalid_user"}

    # Ensure row exists first
    current_nick = get_or_create_nickname(uid)

    with _get_connection() as conn:
        row = conn.execute(
            "SELECT nickname, avatar_url FROM user_nicknames WHERE user_id = ?",
            (uid,),
        ).fetchone()
        next_nick = row["nickname"] if row else current_nick
        next_avatar = row["avatar_url"] if row else None

        if nickname is not None:
            clean_nick = nickname.strip()
            if not re.match(r"^[A-Za-z0-9_-]{3,24}$", clean_nick):
                return {
                    "status": "invalid_nickname",
                    "detail": "Nickname must be 3–24 characters (letters, numbers, _ or -).",
                }
            conflict = conn.execute(
                "SELECT user_id FROM user_nicknames WHERE lower(nickname) = lower(?) AND user_id != ?",
                (clean_nick, uid),
            ).fetchone()
            if conflict:
                return {"status": "nickname_taken", "detail": "That nickname is already taken."}
            next_nick = clean_nick

        if avatar_url is not None:
            clean_av = avatar_url.strip()
            if clean_av and not (clean_av.startswith("http://") or clean_av.startswith("https://") or clean_av.startswith("data:image/")):
                return {"status": "invalid_avatar", "detail": "Avatar must be an image URL or uploaded image."}
            if len(clean_av) > 500_000:
                return {"status": "invalid_avatar", "detail": "Uploaded image is too large (max ~350KB)."}
            next_avatar = clean_av or None

        conn.execute(
            "UPDATE user_nicknames SET nickname = ?, avatar_url = ? WHERE user_id = ?",
            (next_nick, next_avatar, uid),
        )
        if nickname is not None:
            conn.execute(
                "UPDATE listing_comments SET nickname = ? WHERE user_id = ?",
                (next_nick, uid),
            )
        conn.commit()
        return {"status": "updated", "nickname": next_nick, "avatar_url": next_avatar}


def get_comment_counts() -> Dict[str, int]:
    with _get_connection() as conn:
        rows = conn.execute(
            "SELECT listing_id, COUNT(*) as cnt FROM listing_comments GROUP BY listing_id"
        ).fetchall()
        return {r["listing_id"]: int(r["cnt"]) for r in rows}


def get_recent_comments_by_listing(limit: int = 3) -> Dict[str, List[Dict[str, Any]]]:
    with _get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, listing_id, nickname, body, created_at
            FROM listing_comments
            ORDER BY created_at DESC
            """
        ).fetchall()
        recent: Dict[str, List[Dict[str, Any]]] = {}
        for r in rows:
            lid = r["listing_id"]
            bucket = recent.setdefault(lid, [])
            if len(bucket) < limit:
                bucket.append({
                    "id": r["id"],
                    "nickname": r["nickname"],
                    "body": r["body"],
                    "created_at": r["created_at"],
                })
        return recent


def get_latest_comments_by_listing() -> Dict[str, Dict[str, Any]]:
    recent = get_recent_comments_by_listing(1)
    return {lid: items[0] for lid, items in recent.items() if items}


def get_listing_comments(listing_id: str) -> List[Dict[str, Any]]:
    norm_id = _normalize_listing_id(listing_id)
    with _get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, listing_id, user_id, nickname, body, created_at, updated_at
            FROM listing_comments
            WHERE listing_id = ?
            ORDER BY created_at DESC
            """,
            (norm_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def create_listing_comment(listing_id: str, user_id: str, body: str) -> Dict[str, Any]:
    norm_id = _normalize_listing_id(listing_id)
    uid = str(user_id or "").strip() or f"guest-{uuid.uuid4().hex[:8]}"
    clean_body = (body or "").strip()
    if not clean_body:
        raise ValueError("Comment cannot be empty.")

    nickname = get_or_create_nickname(uid)
    cid = str(uuid.uuid4())
    now = time.time()

    with _get_connection() as conn:
        conn.execute(
            """
            INSERT INTO listing_comments (id, listing_id, user_id, nickname, body, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (cid, norm_id, uid, nickname, clean_body, now, now),
        )
        conn.commit()

    return {
        "id": cid,
        "listing_id": norm_id,
        "user_id": uid,
        "nickname": nickname,
        "body": clean_body,
        "created_at": now,
        "updated_at": now,
    }


def update_listing_comment(comment_id: str, user_id: str, body: str) -> Dict[str, Any]:
    clean_body = (body or "").strip()
    if not clean_body:
        raise ValueError("Comment cannot be empty.")

    with _get_connection() as conn:
        row = conn.execute("SELECT * FROM listing_comments WHERE id = ?", (comment_id,)).fetchone()
        if not row:
            return {"status": "not_found"}
        if row["user_id"] != user_id:
            return {"status": "forbidden"}

        now = time.time()
        conn.execute(
            "UPDATE listing_comments SET body = ?, updated_at = ? WHERE id = ?",
            (clean_body, now, comment_id),
        )
        conn.commit()
        updated = dict(row)
        updated["body"] = clean_body
        updated["updated_at"] = now
        return {"status": "updated", "comment": updated}


def delete_listing_comment(comment_id: str, user_id: str) -> str:
    with _get_connection() as conn:
        row = conn.execute("SELECT user_id FROM listing_comments WHERE id = ?", (comment_id,)).fetchone()
        if not row:
            return "not_found"
        if row["user_id"] != user_id:
            return "forbidden"

        conn.execute("DELETE FROM listing_comments WHERE id = ?", (comment_id,))
        conn.commit()
        return "deleted"
