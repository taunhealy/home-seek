import asyncio
import os
import re
import json
import time
import random
from typing import Optional, Dict, Any, List
import httpx

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CACHE_FILE = os.path.join(CACHE_DIR, "p24_cache.json")

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
    - Enforced Jitter Delay: 1.2s - 2.5s between requests.
    - Persistent Disk & RAM Cache: Avoids repeat requests entirely.
    - Automated Circuit Breaker: Pauses traffic on 429/503/Server unavailable.
    """
    def __init__(self):
        self._lock = asyncio.Lock()
        self._last_request_time = 0.0
        self._min_interval = 1.4  # seconds
        self._circuit_open_until = 0.0
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._load_disk_cache()

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

    async def fetch_html(self, url: str, cache_ttl_seconds: float = 86400 * 3) -> Optional[str]:
        """
        Safely fetches a Property24 URL with polite concurrency, rate-limiting, and caching.
        Returns HTML string or None if blocked/unavailable.
        """
        if not url:
            return None

        # 1. Check Cache first
        cached = self.get_cached(url, max_age_seconds=cache_ttl_seconds)
        if cached:
            return cached

        # 2. Check Circuit Breaker
        now = time.time()
        if now < self._circuit_open_until:
            print(f"[P24 CLIENT] Circuit breaker active for {int(self._circuit_open_until - now)}s. Skipping {url}")
            return None

        # 3. Acquire concurrency lock (Strictly 1 request at a time)
        async with self._lock:
            # Re-check cache in case previous task fetched it
            cached = self.get_cached(url, max_age_seconds=cache_ttl_seconds)
            if cached:
                return cached

            # Enforce polite spacing between requests
            now = time.time()
            elapsed = now - self._last_request_time
            needed_interval = self._min_interval + random.uniform(0.2, 0.9)
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
                    self._last_request_time = time.time()

                    # Check for rate limit or ban page
                    if resp.status_code in [429, 503] or "Server unavailable" in resp.text:
                        print(f"[P24 CLIENT] Rate-limit detected (HTTP {resp.status_code} / 'Server unavailable'). Tripping circuit breaker for 90s.")
                        self._circuit_open_until = time.time() + 90.0
                        return None

                    if resp.status_code == 200:
                        html = resp.text
                        self.set_cache(url, html)
                        return html

                    return None

            except Exception as e:
                self._last_request_time = time.time()
                print(f"[P24 CLIENT] Fetch error on {url}: {e}")
                return None

p24_client = Property24RateLimiter()

