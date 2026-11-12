# Home-Seek Development & Property24 Scraping Rules

This document establishes critical operational rules for developing, debugging, and maintaining the **Home-Seek** application.

---

## 🛡️ Rule 1: Property24 Rate-Limit Prevention & Development Mode Safeguards

Property24 (`property24.com`) enforces strict Cloudflare bot detection, IP rate limits, and anti-scraping blocks. Rapid or uncached outbound requests result in temporary or permanent IP bans with the following block page:

> *"Server unavailable. Please check back later. If the issue persists please contact support (https://www.property24.com/contact-us)"*

### Mandatory Rules for Development:

1. **NEVER spam or send rapid concurrent requests to `property24.com`**:
   - Automated scripts, test loops, or hot-reload triggers MUST NEVER make repeated outbound requests to Property24.
   - A minimum token-bucket delay of **3.5s – 5.0s with randomized jitter** is mandatory between any two outbound calls.
   - Max concurrency is strictly **1 outbound request at a time** via `p24_client` lock.

2. **Always Prioritize Local Cache (`.p24_live_cache.json` and `p24_cache.json`)**:
   - In development (`P24_DEV_MODE=True`), cache TTL is extended to **7 days**.
   - If a suburb has existing cached listings (even under a different price filter), the backend MUST reuse and filter the cached listings locally instead of hitting Property24 over the network.
   - `force_fresh` (a manual **Scrape P24** click) MAY bypass cache when the cached suburb data is older than **15 minutes**, so new listings posted during the day are picked up. Automatic loads, hot reloads, and tests (`force_fresh=False`) must stay cache-first.

3. **Circuit Breaker is Mandatory**:
   - When HTTP 429, 503, or the body text `"Server unavailable"` / `"Please check back later"` is detected:
     - Immediately trip the circuit breaker for **at least 180 seconds**.
     - Gracefully fallback to local cache, fuzzy suburb cache, or offline simulated listings.
     - Never throw an unhandled exception or return an empty UI screen.

4. **Favourites Importer Best Practice**:
   - When importing Property24 favourites, prefer pasting raw HTML copied from `myproperty24/favourites`.
   - HTML parsing operates **100% locally with 0 network calls**, completely bypassing rate limits and bot challenges.
   - When URLs are pasted, resolve single listings through local live caches first before attempting outbound network requests.

5. **Offline Mock & Fallback Tolerance**:
   - When developing UI, map features, or filtering logic, use offline mock data or existing caches. Never rely on live scraping during frontend layout or component development.

