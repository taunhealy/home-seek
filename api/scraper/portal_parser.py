import re
from typing import Optional, Dict, Any, List
from models.listing import RentalListing

COMMERCIAL_KEYWORDS = [
    "commercial", "office", "retail", "industrial", "warehouse", 
    "parking", "garage", "storage", "shop", "factory", "business premises"
]

SHORT_TERM_PATTERNS = [
    (r"\bmonth[\s-]to[\s-]month\b", "Month-to-month"),
    (r"\b(?:[1-6]|one|two|three|four|five|six)[\s-]months?(?:\s+renewable)?\b", "1-6 Months"),
    (r"\bwinter\s+(?:let|rental|lease)\b", "Winter Rental"),
    (r"\bshort[\s-]term\b", "Short-term"),
    (r"\bholiday\s+(?:rental|let|home)\b", "Holiday Rental"),
    (r"\btemporary\s+(?:stay|lease|rental)\b", "Temporary Stay"),
    (r"\b(?:daily\s+rate|per\s+day|per\s+night|per\s+week|weekly)\b", "Daily/Weekly"),
    (r"\bavailable\s+until\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b", "Fixed Term Until Date"),
    (r"\bflexible\s+(?:lease|duration|dates|stay)\b", "Flexible Duration"),
]

def is_commercial(title: str, text: str = "") -> bool:
    """Detects commercial listings that must be excluded from residential search."""
    check_str = f"{title} {text}".lower()
    return any(re.search(rf"\b{re.escape(k)}\b", check_str) for k in COMMERCIAL_KEYWORDS)

def extract_lease_term(text: str) -> tuple[str, Optional[str]]:
    """
    Returns (rental_type, lease_period_description).
    rental_type is either 'short-term' or 'long-term'.
    """
    text_clean = text.lower()
    for pattern, label in SHORT_TERM_PATTERNS:
        match = re.search(pattern, text_clean)
        if match:
            # Check for false positive: "short walk to beach", "12 months"
            matched_str = match.group(0)
            if "short walk" in text_clean and "short" in matched_str and "short-term" not in text_clean:
                continue
            return "short-term", match.group(0).strip().capitalize()
            
    # Explicit 12-month indicators
    if re.search(r"\b(?:12[\s-]months?|1[\s-]year|annual\s+lease|long[\s-]term)\b", text_clean):
        return "long-term", "12 months"
        
    return "long-term", None

def parse_p24_card(card: Dict[str, Any], default_suburb: Optional[str] = None) -> Optional[RentalListing]:
    """
    Deterministically parses a Property24 card dictionary into a high-fidelity Listing model.
    Bypasses LLM token costs for structured cards.
    """
    title = str(card.get("titleStr") or card.get("title") or "").strip()
    full_text = str(card.get("fullText") or "").strip()
    excerpt = str(card.get("excerptStr") or card.get("excerpt") or "").strip()
    link = str(card.get("link") or "").strip()
    
    if not title and not full_text:
        return None
        
    # 1. Commercial Safety Gate
    if is_commercial(title, full_text):
        return None

    # 2. Price Extraction
    price_str = str(card.get("priceStr") or card.get("price") or "")
    price = 0
    price_match = re.search(r"R\s*([0-9][0-9\xa0 ,]*)", price_str or full_text)
    if price_match:
        digits = re.sub(r"[\s,\xa0]+", "", price_match.group(1))
        if digits.isdigit():
            price = int(digits)
            
    if price <= 0:
        return None # Portals require valid price

    # 3. Bedroom Extraction
    bedrooms = None
    bed_match = re.search(r"(\d+)\s*(?:bed|bedroom)", f"{title} {full_text}", re.IGNORECASE)
    if bed_match:
        bedrooms = float(bed_match.group(1))

    # 4. Bathroom Extraction
    bathrooms = None
    bath_match = re.search(r"(\d+)\s*(?:bath|bathroom)", full_text, re.IGNORECASE)
    if bath_match:
        bathrooms = float(bath_match.group(1))

    # 4b. Size (Square Meters) Extraction
    sqm = None
    size_str = str(card.get("sizeStr") or card.get("size") or "")
    sqm_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:m²|m2|sqm|sq\s*m|square\s*met(?:er|re)s?)", f"{size_str} {title} {excerpt} {full_text}", re.IGNORECASE)
    if sqm_match:
        try:
            sqm = int(round(float(sqm_match.group(1).replace(",", "."))))
        except (ValueError, TypeError):
            pass

    # 5. Location / Suburb
    location = str(card.get("locationStr") or card.get("location") or "")
    address = str(card.get("addressStr") or card.get("address") or "")
    clean_address = location or address or default_suburb or "Cape Town"
    if "," in clean_address:
        clean_address = clean_address.split(",")[0].strip()

    # 6. Direct Landlord Detection
    is_landlord = bool(
        card.get("isLandlord") 
        or "plt=3" in link 
        or "listed_by_owner" in full_text 
        or "landlord" in full_text.lower()
    )

    # 7. Lease Period & Rental Type
    rental_type, lease_period = extract_lease_term(f"{title} {excerpt} {full_text}")

    # 8. Furnished Status
    is_furnished = None
    if re.search(r"\bunfurnished\b", full_text, re.I):
        is_furnished = False
    elif re.search(r"\b(?:furnished|fully equipped)\b", full_text, re.I):
        is_furnished = True

    # 9. Pet Policy
    is_pet_friendly = None
    if re.search(r"\b(?:no pets|pets not allowed|no dogs|no cats)\b", full_text, re.I):
        is_pet_friendly = False
    elif re.search(r"\b(?:pet friendly|pets allowed|dog friendly|cat friendly|pets welcome)\b", full_text, re.I):
        is_pet_friendly = True

    # 10. Property Type
    p_type = "Apartment"
    if re.search(r"\b(?:house|villa)\b", title, re.I): p_type = "House"
    elif re.search(r"\b(?:cottage|garden cottage)\b", title, re.I): p_type = "Cottage"
    elif re.search(r"\b(?:studio)\b", title, re.I): p_type = "Studio"
    elif re.search(r"\b(?:townhouse)\b", title, re.I): p_type = "Townhouse"

    # 11. Property Sub-Type (Whole vs Shared)
    sub_type = "Whole"
    if re.search(r"\b(?:room to let|flatshare|digs|shared apartment|single room)\b", f"{title} {full_text}", re.I):
        sub_type = "Shared"

    # 12. View Category
    view_cat = "Other"
    if re.search(r"\b(?:sea|ocean|beach|atlantic|seaview|coast)\b", full_text, re.I):
        view_cat = "Sea"
    elif re.search(r"\b(?:mountain|table mountain|peak)\b", full_text, re.I):
        view_cat = "Mountain"

    # Canonical Link
    if link.startswith("/"):
        link = f"https://www.property24.com{link}"

    platform_str = "Property24 (Direct Landlord)" if is_landlord else "Property24"

    return RentalListing(
        title=title or f"{p_type} in {clean_address}",
        price=price,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        address=clean_address,
        source_url=link,
        platform=platform_str,
        property_type=p_type,
        property_sub_type=sub_type,
        rental_type=rental_type,
        lease_period=lease_period,
        is_direct_landlord=is_landlord,
        view_category=view_cat,
        is_furnished=is_furnished,
        is_pet_friendly=is_pet_friendly,
        sqm=sqm,
        is_looking_for=False,
        description=excerpt or title
    )
