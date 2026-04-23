from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
import os
import json
import asyncio
import re
import time
from json_repair import repair_json
from datetime import datetime
from typing import Type, TypeVar, Optional, List
import hashlib
from services.database import record_hash, is_hash_scanned
import sys

def print_safe(msg):
    try:
        # Purge non-ASCII to prevent charmap crashes on Windows
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except:
        pass

T = TypeVar("T", bound=BaseModel)

class Listing(BaseModel):
    title: str
    price: int
    bedrooms: Optional[float] = Field(None, description="Number of bedrooms")
    bathrooms: Optional[float] = Field(None, description="Number of bathrooms")
    address: Optional[str] = Field(None, description="Clean suburb name")
    source_url: str
    platform: str
    
    # Professional Metadata (v56.0)
    property_type: Optional[str] = Field(None, description="Apartment, House, Studio, etc.")
    property_sub_type: str = Field("Whole", description="Whole vs Shared")
    view_category: Optional[str] = Field(None, description="Categorization: 'Sea', 'Mountain', or 'Other'")
    is_furnished: Optional[bool] = Field(None, description="TRUE if furnished")
    amenities: list[str] = Field(default_factory=list, description="Features: e.g., ['Pool', 'Security', 'Fibre']")
    parking_slots: Optional[int] = Field(None, description="Number of parking spaces")
    available_date: Optional[str] = Field(None, description="Immediate, 1 May, etc.")
    contact_info: Optional[str] = Field(None, description="Phone/Email from text")
    sqm: Optional[int] = Field(None, description="Square meters")
    published_at: Optional[str] = Field(None, description="Original publication date/time")
    
    # Flags
    is_pet_friendly: Optional[bool] = None
    is_looking_for: bool = False
    description: Optional[str] = None
    match_score: int = 0
    match_reason: str = ""

class ExtractionResult(BaseModel):
    listings: list[Listing]
    confidence_score: float
    raw_summary: str
    cached_hashes: List[str] = Field(default_factory=list)

class GeminiExtractor:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        # Default LLM
        self.default_model = "gemini-2.5-flash"
        # 🧠 Brain Cache: Store initialized models to avoid startup latency
        self._model_cache = {}

    def get_llm(self, model_name: Optional[str] = None):
        target_name = model_name or self.default_model
        
        # 🛡️ Safety Translation Map for stubborn/legacy frontend strings
        model_map = {
            "gemini-2.0-flash-exp": "gemini-2.5-flash",
            "gemini-1.5-flash": "gemini-2.5-flash",
            "gemini-1.5-flash-latest": "gemini-2.5-flash",
            "gemini-1.5-flash-8b": "gemini-2.5-flash",
            "gemini-2.0-flash": "gemini-2.5-flash",
            "gemini-2.5-flash": "gemini-2.5-flash",
            "gemini-3-flash-preview": "gemini-3-flash-preview", 
            "gemini-pro-latest": "gemini-pro-latest",
            "gemini-flash-latest": "gemini-2.5-flash"
        }
        
        target_model_id = model_map.get(target_name) or target_name
        
        # 🚀 Instant Recall: Check the cache first
        if target_model_id in self._model_cache:
            return self._model_cache[target_model_id]

        if not self.api_key:
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}]  FATAL: AI API KEY NOT FOUND IN ENVIRONMENT!")

        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [BRAIN] Activating model {target_model_id} (Key check: {'FOUND' if self.api_key else 'MISSING'})")
        
        # 🛡️ Dual-key injection for legacy/modern compatibility
        llm = ChatGoogleGenerativeAI(
            model=target_model_id,
            api_key=self.api_key,
            google_api_key=self.api_key, 
            temperature=0,
            request_timeout=60, # Kill hangs after 60s
            max_retries=3       # Auto-retry on blips
        )
        
        self._model_cache[target_model_id] = llm
        return llm

    def _clean_text(self, text: str) -> str:
        """Aggressive noise scrubber to maximize Gemini speed/focus."""
        import re
        # Remove FB Action fluff
        junk = [
            r"Facebook(?:\s+Facebook)+", # Remove repeated "Facebook Facebook..."
            r"Facebook", r"Like", r"Reply", r"Share", r"Follow", r"Comment", r"Meer weergeven", 
            r"See more", r"See Translation", r"View \d+ more comments",
            r"Sponsored", r"Suggested for you",
            r"React", r"Write a comment", r"Search Results", r"Filters",
            r"Join Group", r"About this group", r"Public group", r"Members", r"Activity",
            r"Joined", r"Invite", r"Discussion", r"Featured", r"Media", r"Files",
            r"\b[a-zA-Z0-9]{15,}\b", # Remove likely obfuscation strings like 'ostnerSdopu'
            r"\b(?:\w\s+){3,}\w\b", # Remove single-char letter salad (a f 1 0 t 8)
            r"\b[a-z]{5,10}[A-Z][a-z]{1,5}\b" # Remove 'eoonrtpdSs' style CSS salad
        ]
        # 🛡️ PROTECT SNIPER HEADERS: Temporarily move headers to safety
        placeholders = []
        def hide_header(match):
            placeholders.append(match.group(0))
            return f"__SNIPER_HEADER_{len(placeholders)-1}__"
        
        text = re.sub(r"### START_SNIPER_LISTING \[DIRECT_LINK:.*?\] ###", hide_header, text)

        for pattern in junk:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE)
            
        # Restore headers
        for i, val in enumerate(placeholders):
            text = text.replace(f"__SNIPER_HEADER_{i}__", val)
            
        # Clean white space and layout noise
        text = re.sub(r"\n\s*\n", "\n", text)
        text = re.sub(r" {2,}", " ", text)
        return text.strip()[:200000]

    async def extract(self, text: str, schema: Type[T], model_name: Optional[str] = None, time_constraint: Optional[str] = None, search_query: Optional[str] = None) -> T:
        """Extracts listings using a chunked strategy - now with QUERY-BOUND HASH-SKIP for cost efficiency."""
        import hashlib
        from services.database import is_hash_scanned, record_hash
        
        # Clean white space and layout noise before checking size
        text = self._clean_text(text)
        
        # 🟢 STRATEGY A: Block-Based Splitting (Facebook style)
        blocks = text.split('### START_SNIPER_LISTING')
        header = blocks[0]
        listings_blocks = blocks[1:]
        
        if len(listings_blocks) > 0:
            query_prefix = (search_query or "Global").lower().strip()
            skipped_count = 0
            
            pitiable_blocks = []
            for b in listings_blocks:
                h_key = hashlib.sha256(f"{query_prefix}-{b[:300]}".encode()).hexdigest()
                scanned = await is_hash_scanned(h_key)
                if not scanned: 
                    pitiable_blocks.append({"text": b, "hash": h_key})
                else: 
                    skipped_count += 1

            # Parallel Batch Processing of ONLY the NEW blocks
            chunk_size = 3 # Reduced for deep stability on heavy portal data
            chunks = []
            for i in range(0, len(pitiable_blocks), chunk_size):
                batch = pitiable_blocks[i:i+chunk_size]
                chunk_text = header + "\n" + "\n".join([f"### START_SNIPER_LISTING{item['text']}" for item in batch])
                chunks.append({"text": chunk_text, "hashes": [item["hash"] for item in batch]})
            
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [BRAIN] Extracting {len(pitiable_blocks)} NEW blocks in {len(chunks)} parallel chunks...")
            
            # 🚀 Frugal Token Filter: Ensure we are not passing massive blocks if they look non-relevant
            for chunk in chunks:
                chunk["text"] = self._frugal_scrub(chunk["text"])

            tasks = [self._extract_chunk(c["text"], schema, model_name, time_constraint) for c in chunks]
            batch_results = await asyncio.gather(*tasks)
            
            # Record hashes ONLY for successful chunks
            for idx, res in enumerate(batch_results):
                if res.confidence_score > 0 or "Error" not in res.raw_summary:
                    for h in chunks[idx]["hashes"]:
                        await record_hash(h, {"query": search_query})
                else:
                    print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Guard: Skipping hash recording for failed chunk {idx}.")
            
            # Merge results
            final_listings = []
            seen_keys = set()
            max_confidence = 0.0
            for res in batch_results:
                for l in res.listings:
                    key = f"{l.title}-{l.price}"
                    if key in seen_keys: continue
                    seen_keys.add(key)
                    final_listings.append(l)
                max_confidence = max(max_confidence, res.confidence_score)
            return schema(listings=final_listings, confidence_score=max_confidence, raw_summary=f"Processed {len(pitiable_blocks)} new items (Skipped {skipped_count} cached).")
        
        # 🔵 STRATEGY B: Unstructured Splitting (Portal style like Property24/Facebook Raw)
        # 📉 EFFICIENCY LIMIT: Only process the first 15k chars for portals
        if len(text) > 15000:
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧬 Portal Efficiency: Clipping text to 15k chars to save credits.")
            text = text[:15000]
            
        # Standard Single Call (already clipped)
        return await self._extract_chunk(text, schema, model_name, time_constraint)

    async def _extract_chunk(self, text: str, schema: Type[T], model_name: Optional[str] = None, time_constraint: Optional[str] = None) -> T:
        parser = PydanticOutputParser(pydantic_object=schema)
        llm = self.get_llm(model_name)
        
        # 🚀 Final Token Scrubber: Remove markdown image noise
        import re
        text = re.sub(r"!\[.*?\]\(.*?\)", "", text) # Remove images
        
        # 🎯 Dynamic Guidelines based on constraints
        pet_rule = "2. Pets Allowed: Strictly look for keywords. If 'Pets Allowed', set True. If 'No Pets', set False. If NOT MENTIONED, you MUST set null."
        if time_constraint and "SOURCE IS PRE-FILTERED FOR PETS" in time_constraint:
            pet_rule = "2. Pets Allowed: SOURCE IS PRE-FILTERED FOR PETS. If text is silent/unknown, set is_pet_friendly=TRUE. ONLY set False if it explicitly says 'No Pets'."

        now = datetime.now()
        current_date_str = now.strftime("%B %Y")
        
        prompt_text = (
            f"Current Date: {current_date_str}\n\n"
            "You are a professional property data extractor. The text contains unique listing blocks separated by '### START_SNIPER_LISTING'.\n"
            "MANDATORY RULE 1: YOU MUST EXTRACT EVERY SINGLE RESIDENTIAL LISTING FOUND.\n"
            "MANDATORY RULE 2: NEVER extract Commercial, Office, Retail, Industrial, Parking, Garages, or Business spaces. If you include a shop or office, you FAIL.\n"
            "MANDATORY RULE 3 (URL PRECISION): Each listing block starts with '### START_SNIPER_LISTING [DIRECT_LINK: URL] ###'. You MUST extract that 'URL' and set it as the 'source_url' for every listing found within that specific block. THIS IS YOUR PRIMARY SOURCE FOR THE LINK.\n"
            "Identify and extract ALL relevant residential rental listings Snappy and ACCURATELY.\n\n"
            "FIELD RULES:\n"
            "1. Property Sub-Type: Strictly identify if the listing is for a 'Whole' property (entire apartment/house) or 'Shared' (a room in a house, flatshare, digs, or room-only).\n"
            "2. Pet Policy: Set is_pet_friendly=TRUE ONLY if the listing explicitly states pets are welcome.\n"
            "3. Identify Category (rental_type/property_type): \n"
            "   - 'long-term': Standard 12 month+ leases or if it doesn't mention any short-term/flexible duration.\n"
            "   - 'short-term': Flexible, daily/weekly/monthly stays (not sitting). Includes 'Short-Mid Term', '3-6 months', 'Month-to-month', 'Winter rental', 'Remote stay', or any duration less than 12 months.\n"
            "   - 'pet-sitting': UNIQUE CATEGORY for stay > 1 month where homeowner needs a pet/house-sitter.\n"
            "   - Set 'property_type' to 'Apartment', 'House', 'Studio', 'Cottage', or 'Townhouse' based on description.\n"
            "4. Availability & Contact: \n"
            "   - Set 'available_date' (e.g., 'Immediate', '1st June').\n"
            "   - Set 'contact_info' (Phone number or email address found in the text).\n"
            "5. Identify Availability: If a tenant is 'looking for' a place, 'ISO', or posting a 'wanted' ad, you MUST set is_looking_for: TRUE. Only set FALSE if the property is actually available for rent.\n"
            "6. Price: Extract the monthly rental price as an integer. In the South African context, '[number]k' always means thousands of Rands (e.g., '34k' -> 34000, '25k' -> 25000). Extract ONLY the numeric value.\n"
            "7. Address: Extract the specific SUBURB clearly (e.g., 'Sea Point', 'Gardens').\n"
            "8. View Category: Based on text, set to 'Sea' (if mentions ocean/beach), 'Mountain' (if mentions table mountain/peaks), or 'Other'.\n"
            "9. Furnished: Set is_furnished=TRUE if text mentions 'furnished', 'fully equipped'. Set FALSE if 'unfurnished'.\n"
            "10. Amenities: Extract a list of perks like ['Pool', 'Security', 'Fibre', 'Garage', 'Gym', 'Balcony', 'Parking'].\n"
            "11. SQM: Extract the square meterage/footage as an integer if available (e.g. '80sqm' -> 80).\n"
            "12. Published Date: Look for '2 hours ago', 'Yesterday', or specific dates and set published_at. \n"
            "MANDATORY RECENCY RULE: If a listing is from 2022, 2023, or more than 3 months old based on the current date, YOU MUST EXCLUDE IT. Only extract fresh, active listings.\n\n"
            "NEIGHBORHOOD PRECISION RULES:\n"
            "- Be extremely specific about suburbs. Do NOT just say 'Cape Town' if a specific neighborhood is mentioned.\n"
            "- Landmark Mapping: Use local knowledge. For example, 'Empire', 'Surfer's Corner', or 'York Road' means the neighborhood is 'Muizenberg'. 'Beach Road' or 'Main Road' near the ocean in the Atlantic Seaboard usually means 'Sea Point'.\n\n"
            "10. DO NOT output null fields. If a field like 'bedrooms' or 'bathrooms' is unknown, OMIT the key entirely.\n"
            "IMPORTANT CONSTRAINT: {time_instruction}\n\n"
            "{instructions}\n\n"
            "TEXT TO ANALYZE:\n{text}"
        )
        
        time_instruction = time_constraint if time_constraint else "Extract all valid results."
        prompt = ChatPromptTemplate.from_template(prompt_text)
        
        try:
            # 🎙️ Manually format the prompt
            formatted_prompt = prompt_text.format(
                text=text,
                time_instruction=time_instruction,
                instructions=parser.get_format_instructions()
            )
            
            # 🛡️ RETRY SHIELD: Handle transient 504/500 errors from Google
            max_retries = 3
            content = ""
            for attempt in range(max_retries):
                try:
                    start_time = time.time()
                    print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [HEARTBEAT] Calling Gemini API (Payload: {len(formatted_prompt)} chars)...")
                    response = await llm.ainvoke(
                        formatted_prompt,
                        config={"timeout": 120}
                    )
                    duration = time.time() - start_time
                    print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [INTELLIGENCE] Response received in {duration:.1f}s.")
                    
                    # 🛡️ Handle list-type content (Gemini 3.0)
                    if isinstance(response.content, list):
                        content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content]).strip()
                    else:
                        content = response.content.strip()
                    break # Success! Break the retry loop
                except Exception as e:
                    err_str = str(e)
                    if ("504" in err_str or "Deadline" in err_str or "503" in err_str) and attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 3
                        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ AI Congestion (Attempt {attempt+1}): {err_str[:80]}... Retrying in {wait_time}s")
                        await asyncio.sleep(wait_time)
                        continue
                    raise e
            
            # Clean up markdown formatting
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # 🏁 Self-Healing JSON: Handle cutoffs and malformed output
            raw_data = repair_json(content, return_objects=True)
            
            # 🧹 Data Massaging & Deduplication
            if isinstance(raw_data, dict) and "listings" in raw_data:
                unique_listings = []
                seen_keys = set()
                for l in raw_data["listings"]:
                    # Dedup by title + price string combo
                    key = f"{l.get('title')}-{l.get('price')}"
                    if key in seen_keys: continue
                    seen_keys.add(key)
                    
                    for field in ["price", "bedrooms", "bathrooms"]:
                        if field in l and (l[field] == "null" or l[field] == "" or l[field] is None):
                            l[field] = None
                    unique_listings.append(l)
                raw_data["listings"] = unique_listings

            # Forensic Logging: Show exactly what AI found
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [BRAIN] AI Raw Data Captured:")
            try:
                print_safe(json.dumps(raw_data, indent=2))
            except:
                print_safe(raw_data)

            try:
                # Attempt standard parse
                return parser.parse(json.dumps(raw_data))
            except Exception as pe:
                print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Pydantic Repairing Partial Results: {str(pe)}")
                # Manual fallback for cut-off JSON (Recover valid items)
                valid_items = []
                for item in raw_data.get("listings", []):
                    try:
                        valid_items.append(Listing(**item))
                    except: continue
                return schema(listings=valid_items, confidence_score=0.8, raw_summary="Partial results recovered")
        except Exception as e:
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] Extraction Error: {str(e)}")
            # Return an empty result object instead of crashing
            return schema(listings=[], confidence_score=0.0, raw_summary="Error during extraction")

    async def filter_listings(self, listings: list, query: str, model_name: Optional[str] = None) -> list:
        if not listings:
            return []
            
        llm = self.get_llm(model_name)
            
        prompt = ChatPromptTemplate.from_template(
            "You are a rental sniper expert. Evaluate property listings against the user's requirements.\n"
            "USER REQUIREMENTS: {query}\n\n"
            "LISTINGS:\n{listings_json}\n\n"
            "Respond with a JSON list for listings with score > 40.\n"
            "CRITICAL RULES:\n"
            "1. If 'is_pet_friendly' is exactly FALSE, the score MUST be 0. If it is NULL (Unknown), check the description/title. If they don't explicitly say 'No Pets', DO NOT penalize the score.\n"
            "2. EXCLUDE all Industrial, Retail, Office, or Commercial listings unless user specifically asks for them.\n"
            "3. Be extremely critical about location. If the user asks for a specific suburb (e.g., 'Muizenberg'), and the listing is in a different suburb (e.g., 'Sea Point'), the score MUST be 0. We do NOT want general city matches when a specific neighborhood is defined.\n"
            "4. ELIMINATE WANTED ADS: If the post is a tenant 'Looking for' a place, 'ISO', 'Room wanted', or a 'Wanted' ad, the score MUST be 0. We only want available properties.\n"
            "5. RELOCATION REQUESTS: Exclude people 'moving to Cape Town' or 'relocating from Joburg' who are describing their search. These are NOT listings.\n"
            "6. PRICE SENSITIVITY: If the price is 0, 'Request', or not stated, penalize the score slightly (e.g. -10 points) unless it is an incredible match otherwise.\n"
            "7. NEIGHBORHOOD KNOWLEDGE: Be smart. If someone lists 'Boyes Drive' or 'Surfer Corner', that is in Muizenberg. Do not reject familiar landmarks of the target area.\n\n"
            "WARNING: Do not hallucinate matches. If the USER asked for 'Muizenberg' and you provide a listing for 'Sea Point', you are failing your core objective.\n"
            "Format: [{{ \"index\": 0, \"score\": 95, \"reason\": \"Verified residential home available to rent.\" }}, ...]\n"
            "Return ONLY the JSON array."
        )
        
        listings_json = json.dumps([l.model_dump() for l in listings], indent=2)
        try:
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [INTELLIGENCE] Ranking {len(listings)} listings against query: '{query}'")
            response = await llm.ainvoke(prompt.format(query=query, listings_json=listings_json))
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [INTELLIGENCE] Ranking complete.")
            
            # 🛡️ Handle list-type content (Gemini sometimes returns multiple parts)
            if isinstance(response.content, list):
                content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content]).strip()
            else:
                content = response.content.strip()
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] AI Raw Response: {content}")
            # Clean up markdown formatting if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # 🏁 Self-Healing JSON
            data = repair_json(content, return_objects=True)
            matches = data if isinstance(data, list) else data.get("matches", [])
            # 🛡️ RESIDENTIAL HARD-FILTER & PET ENFORCEMENT
            user_wants_pets = any(x in query.lower() for x in ["pet", "dog", "cat", "animal"])
            # 🏢 Filter 1: Junk words in title
            # Split junk into broad rejections vs title-only rejections
            junk_words_broad = ["commercial sales", "industrial", "warehouse", "retail space", "office space", "storage unit"]
            junk_words_title = ["parking bay", "garage for rent", "storage only", "business for sale"]
            
            results = []
            for match in matches:
                if not isinstance(match, dict): continue
                idx = match.get("index")
                if idx is not None and isinstance(idx, int) and idx < len(listings):
                    listing = listings[idx]
                    
                    # 🏢 Filter 1: Junk words in title
                    title_low = listing.title.lower()
                    if any(jw in title_low for jw in junk_words_title):
                        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Scrubber: Rejected Title match: {listing.title}")
                        continue
                    
                    # 🐕 Filter 2: Smart Pet-Trust (Source-Aware)
                    is_pre_filtered = "ptf=True" in (listing.source_url or "") or "pet-friendly" in (listing.source_url or "").lower()
                    
                    if user_wants_pets and not is_pre_filtered and listing.is_pet_friendly is not True:
                        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Scrubber: Rejected Non-Confirmed Pet match (No source filter): {listing.title}")
                        continue
                        
                    if listing.is_looking_for is True:
                        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Scrubber: Rejected 'Wanted/Request' ad: {listing.title}")
                        continue

                    # 🏥 Nuclear Residential Filtering (Remove Commercial/Industrial/Garages)
                    content_lower = (listing.title + " " + (listing.description or "")).lower()
                    triggered_word = next((p for p in junk_words_broad if p in content_lower), None)
                    if triggered_word:
                        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Scrubber: Rejected Commercial/Industrial match ('{triggered_word}'): {listing.title}")
                        continue

                    # 🌍 Filter 3: Geography Hallucination Guard (The 'Muizenberg vs Sea Point' Wall)
                    target_area = query.lower()
                    listing_area = (listing.address or listing.title).lower()
                    
                    if "any" not in target_area:
                        # Detect blatant mismatches (e.g. Sea Point vs Muizenberg)
                        known_suburbs = ["sea point", "seapoint", "greenpoint", "green point", "muizenberg", "lakeside", "marina da gama", "st james", "kalk bay", "fish hoek", "noordhoek", "kommetjie", "wynberg", "pinelands", "newlands", "kenilworth", "observatory", "woodstock"]
                        detected_target = next((s for s in known_suburbs if s in target_area), None)
                        detected_listing = next((s for s in known_suburbs if s in listing_area), None)
                        
                        if detected_target and detected_listing and detected_target != detected_listing:
                            # EXCEPTIONS: Greenpoint vs Green Point
                            if not (detected_target.replace(" ", "") == detected_listing.replace(" ", "")):
                                print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Scrubber: Blocked Geo-Mismatch Hallucination: {listing.title} ({detected_listing}) for query '{query}'")
                                continue
                        
                    # 🏠 Filter 4: Score floor check
                    listing.match_score = match.get("score", 0)
                    if listing.match_score < 40:
                        continue

                    listing.match_reason = match.get("reason", "Relevant residential match.")
                    results.append(listing)
                else:
                    print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Scrubber: Invalid match index/rejected by AI ranking.")
            
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [INTELLIGENCE] Final accepted count: {len(results)}/{len(listings)}")
            return results
        except Exception as e:
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] AI Filtering Error: {str(e)}")
            return []

    def _frugal_scrub(self, text: str) -> str:
        """
        Assists Gemini by removing lines that are clearly not related to property listings.
        Keeps lines that contain currency, bedroom counts, or property keywords.
        """
        # 🧼 Nuclear Scrubber: Strips everything except the core identifying data
        # Specifically targeting Property24 noise (P24_, tracking, etc.)
        lines = text.split('\n')
        scrubbed = []
        for line in lines:
            line = line.strip()
            if len(line) < 5: continue
            if any(x in line for x in ['Tracking', 'Cookie', 'Script', 'Function', 'var ', 'div ', 'p24_', 'Token']): continue
            # Keep lines that look like prices, areas, or titles
            is_numeric = any(char.isdigit() for char in line)
            is_capitalized = line[0].isupper() if line else False
            
            if is_numeric or is_capitalized or len(line) > 20:
                scrubbed.append(line)
        
        return "\n".join(scrubbed)[:5000]

    async def determine_location(self, query: str, model_name: Optional[str] = None) -> str:
        """Uses AI to extract the primary geographic area from a user's free-text prompt."""
        # 🧪 The Obsidian Normalization Map (Hard-coded to prevent AI "laziness")
        abrv_map = {
            "muiz": "Muizenberg",
            "muzenberg": "Muizenberg",
            "muizenberg": "Muizenberg",
            "muizenburg": "Muizenberg",
            "kalkbay": "Kalk Bay",
            "kalk": "Kalk Bay",
            "gp": "Green Point",
            "greenpoint": "Green Point",
            "sp": "Sea Point",
            "seapoint": "Sea Point",
            "cbd": "Cape Town City Centre",
        }
        
        # 1. Immediate Intercept (If the user just typed the keyword)
        query_clean = query.lower().strip().replace(",", "").replace(".", "")
        print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Debug: Normalizing '{query}' (cleaned: '{query_clean}')")
        
        if query_clean in abrv_map:
            normalized = abrv_map[query_clean]
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] [LOCATION] Match Found! -> {normalized}")
            return normalized

        llm = self.get_llm(model_name)
        prompt = (
            "You are a high-precision Geographic Normalizer.\n"
            "TASK: Convert messy user input into the CANONICAL suburb/city name for Cape Town.\n\n"
            "CANONICAL EXAMPLES:\n"
            "- 'Muzenberg' or 'Muiz' -> Muizenberg\n"
            "- 'Sea Point' or 'SP' -> Sea Point\n"
            "- 'Green Point' or 'GP' -> Green Point\n"
            "- 'CBD' or 'Cape Town' -> Cape Town City Centre\n\n"
            f"INPUT: '{query}'\n\n"
            "INSTRUCTION: Search for the closest match in the Cape Town area. If no specific location or suburb is found in the input (e.g. user just says 'pet friendly'), YOU MUST RETURN 'Any'.\n"
            "RETURN ONLY THE CORRECTED NAME. NO EXPLANATION. NO QUOTES."
        )
        
        try:
            # ⏱️ Deep Extraction Timeout (120s) to survive heavy HTML loads
            response = await self.get_llm(model_name).ainvoke(
                prompt,
                config={"timeout": 120}
            )
        except asyncio.TimeoutError:
            print_safe(f"[{datetime.now().strftime('%H:%M:%S')}] ⏰ Normalization Timeout: Defaulting to Any")
            return "Any"
        
        # 🛡️ Handle list-type content
        if isinstance(response.content, list):
            res_text = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content]).strip()
        else:
            res_text = response.content.strip()

        # 🛡️ Final Guardian: Catch any AI holdovers
        res_text_low = res_text.lower()
        if res_text_low in abrv_map:
            return abrv_map[res_text_low]
        
        return res_text
