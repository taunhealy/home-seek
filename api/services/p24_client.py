import asyncio
import os
import re
import json
import time
import random
import threading
from typing import Optional, Dict, Any, List
import httpx

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CACHE_FILE = os.path.join(CACHE_DIR, "p24_cache.json")
CIRCUIT_FILE = os.path.join(CACHE_DIR, ".p24_circuit_state.json")

# Realistic browser identity rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
]

class Property24RateLimiter:
    """
    Enterprise-grade Anti-Rate-Limit & Polite Throttling Client for Property24.
    - Concurrency Cap: Max 1 simultaneous request.
    - Enforced Jitter Delay: 3.5s - 5.0s between requests.
    - Persistent Disk & RAM Cache: Avoids repeat requests entirely.
    - Automated Circuit Breaker: Pauses traffic on 429/503/Server unavailable.
    """
    def __init__(self):
        self._lock = asyncio.Lock()
        self._state_lock = threading.Lock()
        self._last_request_time = 0.0
        self._min_interval = 3.5  # Enforce minimum 3.5s spacing per GEMINI.md
        self._circuit_open_until = 0.0
        self._consecutive_trips = 0
        self._last_trip_reason = ""
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._load_disk_cache()
        self._load_circuit_state()

    def _load_circuit_state(self):
        try:
            if os.path.exists(CIRCUIT_FILE):
                with open(CIRCUIT_FILE, "r", encoding="utf-8") as f:
                    st = json.load(f)
                    if isinstance(st, dict):
                        self._circuit_open_until = float(st.get("circuit_open_until", 0.0))
                        self._consecutive_trips = int(st.get("consecutive_trips", 0))
                        self._last_trip_reason = str(st.get("last_trip_reason", ""))
                        self._last_request_time = max(self._last_request_time, float(st.get("last_request_time", 0.0)))
        except Exception:
            pass

    def _save_circuit_state(self):
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(CIRCUIT_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "circuit_open_until": self._circuit_open_until,
                    "consecutive_trips": self._consecutive_trips,
                    "last_trip_reason": self._last_trip_reason,
                    "last_request_time": self._last_request_time,
                }, f)
        except Exception:
            pass

    def is_circuit_open(self) -> bool:
        with self._state_lock:
            self._load_circuit_state()
            return time.time() < self._circuit_open_until

    def trip_circuit(self, reason: str = "Rate limit / Server unavailable", base_cooldown: float = 300.0) -> int:
        with self._state_lock:
            self._load_circuit_state()
            self._consecutive_trips += 1
            multiplier = min(4, 2 ** (self._consecutive_trips - 1))
            cooldown = int(max(180.0, base_cooldown) * multiplier)
            self._circuit_open_until = max(self._circuit_open_until, time.time() + cooldown)
            self._last_trip_reason = reason
            self._save_circuit_state()
            print(f"[P24 RATE GUARD] Circuit breaker tripped ({reason}). Cooling down for {cooldown}s.")
            return cooldown

    def record_request_slot(self, min_gap_seconds: float = 3.5) -> float:
        """Persists and returns the enforced request timestamp across sync and async clients."""
        with self._state_lock:
            self._load_circuit_state()
            self._last_request_time = time.time()
            self._save_circuit_state()
            return self._last_request_time

    def reset_circuit(self):
        with self._state_lock:
            if self._consecutive_trips > 0 or self._circuit_open_until > 0:
                self._consecutive_trips = 0
                self._circuit_open_until = 0.0
                self._last_trip_reason = ""
                self._save_circuit_state()

    def get_circuit_status(self, cached_queries: Optional[int] = None) -> Dict[str, Any]:
        with self._state_lock:
            self._load_circuit_state()
            now = time.time()
            is_open = now < self._circuit_open_until
            remaining = max(0, int(self._circuit_open_until - now)) if is_open else 0
            return {
                "circuit_open": is_open,
                "cooldown_remaining_seconds": remaining,
                "consecutive_trips": self._consecutive_trips,
                "reason": self._last_trip_reason if is_open else "",
                "cached_queries": cached_queries if cached_queries is not None else len(self._memory_cache),
            }

    def _load_disk_cache(self):
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self._memory_cache = json.load(f)
        except Exception as e:
            self._memory_cache = {}

    def _save_disk_cache(self):
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            # Limit disk cache to latest 1000 items to prevent bloat
            if len(self._memory_cache) > 1000:
                keys = list(self._memory_cache.keys())[-800:]
                self._memory_cache = {k: self._memory_cache[k] for k in keys}
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._memory_cache, f)
        except Exception:
            pass

    def get_cached(self, key: str, max_age_seconds: float = 86400 * 3) -> Optional[str]:
        """Returns cached HTML if present and fresh."""
        if key in self._memory_cache:
            entry = self._memory_cache[key]
            if time.time() - entry.get("timestamp", 0) < max_age_seconds:
                return entry.get("html")
        return None

    def set_cache(self, key: str, html: str):
        self._memory_cache[key] = {
            "timestamp": time.time(),
            "html": html
        }
        self._save_disk_cache()

    def remove_cache(self, key: str):
        if key in self._memory_cache:
            del self._memory_cache[key]
            self._save_disk_cache()

    async def fetch_html_with_status(
        self, url: str, cache_ttl_seconds: float = 86400 * 3
    ) -> tuple[Optional[str], int, str]:
        """
        Safely fetches a Property24 URL with polite concurrency, rate-limiting, and caching.
        Returns `(html, status_code, final_url)`.
        """
        if not url:
            return None, 0, ""

        # 1. Check Cache first
        if cache_ttl_seconds > 0:
            cached = self.get_cached(url, max_age_seconds=cache_ttl_seconds)
            if cached:
                return cached, 200, url

        # 2. Check Shared Persistent Circuit Breaker
        if self.is_circuit_open():
            remaining = self.get_circuit_status().get("cooldown_remaining_seconds", 0)
            print(f"[P24 CLIENT] Circuit breaker active for {remaining}s. Skipping {url}")
            return None, 429, url

        # 3. Acquire concurrency lock (Strictly 1 request at a time)
        async with self._lock:
            # Re-check cache & circuit in case previous task updated them
            if cache_ttl_seconds > 0:
                cached = self.get_cached(url, max_age_seconds=cache_ttl_seconds)
                if cached:
                    return cached, 200, url
            if self.is_circuit_open():
                return None, 429, url

            # Enforce polite spacing between requests (3.5s + 0.5-1.5s jitter)
            now = time.time()
            elapsed = now - self._last_request_time
            needed_interval = self._min_interval + random.uniform(0.5, 1.5)
            if elapsed < needed_interval:
                await asyncio.sleep(needed_interval - elapsed)

            ua = random.choice(USER_AGENTS)
            headers = {
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.property24.com/",
                "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "DNT": "1"
            }

            try:
                async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=12.0) as client:
                    resp = await client.get(url)
                    self.record_request_slot()
                    final_url = str(resp.url)

                    # Check for rate limit, Cloudflare ban or 'Server unavailable' page
                    is_blocked = (
                        resp.status_code in [403, 429, 503]
                        or "server unavailable" in resp.text.lower()
                        or "please check back later" in resp.text.lower()
                    )
                    if is_blocked:
                        self.trip_circuit(f"HTTP {resp.status_code} / 'Server unavailable'", base_cooldown=300.0)
                        return None, resp.status_code, final_url

                    if resp.status_code in (404, 410):
                        self.reset_circuit()
                        self.remove_cache(url)
                        return resp.text, resp.status_code, final_url

                    if resp.status_code == 200:
                        html = resp.text
                        self.reset_circuit()
                        lid_match = re.search(r'/(\d{7,10})(?:[/?#]|$)', url)
                        redirected_away = bool(lid_match and lid_match.group(1) not in final_url)
                        if not redirected_away:
                            self.set_cache(url, html)
                        else:
                            self.remove_cache(url)
                        return html, 200, final_url

                    return None, resp.status_code, final_url

            except Exception as e:
                self.record_request_slot()
                print(f"[P24 CLIENT] Fetch error on {url}: {e}")
                return None, 0, url

    async def fetch_html(self, url: str, cache_ttl_seconds: float = 86400 * 3) -> Optional[str]:
        """
        Safely fetches a Property24 URL with polite concurrency, rate-limiting, and caching.
        Returns HTML string or None if blocked/unavailable.
        """
        html, status_code, _ = await self.fetch_html_with_status(url, cache_ttl_seconds=cache_ttl_seconds)
        if status_code == 200:
            return html
        return None

p24_client = Property24RateLimiter()

