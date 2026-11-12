---
name: p24-rate-limiting
description: Enforces Property24 scraping rate-limiting, local caching, and offline development safeguards.
trigger: always_on
---

# Property24 Anti-Rate-Limit Rules for Home-Seek

1. **Outbound Request Throttling**:
   - Strictly 1 outbound request at a time.
   - Minimum 3.5s spacing between requests with human jitter.
   - Max 3 suburbs fetched per batch request.

2. **Aggressive Cache First**:
   - In development mode (`P24_DEV_MODE=True`), cache TTL is 7 days.
   - Exception: an explicit user "Scrape P24" click (`force_fresh=True`) refreshes suburbs whose cache is older than 15 minutes.
   - Any query matching an existing cached suburb must be served from `api/services/.p24_live_cache.json` or `api/data/p24_cache.json`.
   - Never bypass cache during automated tests or frontend dev server reloads.

3. **Detection of "Server unavailable" Block**:
   - If response contains `"Server unavailable"` or `"Please check back later"`, immediately engage the 180s circuit breaker.
   - Fall back to cached suburb listings or offline synthetic fixtures. Never retry immediately.

4. **Zero-Network Favourites Parsing**:
   - The Favourites Importer prioritizes pasted HTML tile parsing (`parse_p24_html_tiles`) which runs 100% locally with 0 network calls.

