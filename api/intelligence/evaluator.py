import os
import json
import re
import sys
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from json_repair import repair_json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

def print_safe(msg):
    try:
        safe_msg = str(msg).encode('ascii', 'ignore').decode('ascii')
        print(safe_msg)
        sys.stdout.flush()
    except Exception:
        pass

class AgencyIntel(BaseModel):
    name: Optional[str] = None
    is_direct_landlord: bool = False
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    google_reviews_url: Optional[str] = None
    hellopeter_rating: Optional[float] = None
    hellopeter_review_count: Optional[int] = None
    hellopeter_url: Optional[str] = None
    web_reviews: List[Dict[str, Any]] = Field(default_factory=list)
    risk_level: Optional[str] = "neutral"
    flags: List[str] = Field(default_factory=list)
    complaint_sample: Optional[str] = None

from intelligence.vision_evaluator import VisionIntel, PropertyVisionEvaluator
from services.commute_service import CommuteIntel, CommuteService

class PrivacyIntel(BaseModel):
    dwelling_type: str = "independent"  # 'independent', 'garden_cottage', 'attached_flatlet', 'room_shared', 'unknown'
    has_shared_entrance: bool = False
    has_shared_garden: bool = False
    has_shared_pool: bool = False
    is_landlord_on_site: bool = False
    privacy_score: int = 100  # 0 to 100
    privacy_flags: List[str] = Field(default_factory=list)
    privacy_summary: Optional[str] = None

class PropertyEvaluationResult(BaseModel):
    is_match: bool = Field(True, description="True if listing meets filters or is acceptable under advisory mode")
    fit_score: int = Field(80, description="Fit score from 0 to 100")
    unmet_must_haves: List[str] = Field(default_factory=list, description="Must-include items that are missing or unverified")
    triggered_exclusions: List[str] = Field(default_factory=list, description="Must-exclude dealbreakers detected or suspected")
    pros: List[str] = Field(default_factory=list, description="Categorized pros with ratings where applicable (e.g. Interior Condition 8.5/10)")
    cons_and_hidden_costs: List[str] = Field(default_factory=list, description="Categorized cons, missing appliances, and extra monthly/upfront costs")
    verdict: str = Field("", description="Executive summary and net financial/lifestyle verdict")
    viewing_checklist: List[str] = Field(default_factory=list, description="Specific physical checklist for in-person inspection")
    agency_intel: Optional[AgencyIntel] = None
    vision_intel: Optional[VisionIntel] = None
    commute_intel: List[CommuteIntel] = Field(default_factory=list)
    privacy_intel: Optional[PrivacyIntel] = None

class PropertyEvaluator:
    def __init__(self, model_name: str = "gemini-3.8-flash"):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = model_name
        self._llm = None

    def _get_llm(self):
        if self._llm is not None:
            return self._llm
        
        if not self.api_key:
            print_safe("[EVALUATOR] Warning: No GEMINI_API_KEY / GOOGLE_API_KEY found.")
            return None

        # Gemini model mapping & fallback
        candidate_models = [self.model_name, "gemini-2.5-flash", "gemini-1.5-flash"]
        for m in candidate_models:
            try:
                print_safe(f"[EVALUATOR] Initializing ChatGoogleGenerativeAI with model: {m}")
                llm = ChatGoogleGenerativeAI(
                    model=m,
                    api_key=self.api_key,
                    google_api_key=self.api_key,
                    temperature=0.2,
                    request_timeout=45,
                    max_retries=2
                )
                self._llm = llm
                return self._llm
            except Exception as e:
                print_safe(f"[EVALUATOR] Failed to initialize {m}: {e}")
        return None

    def extract_privacy_intel(self, listing: Dict[str, Any]) -> PrivacyIntel:
        """Deterministically inspects listing metadata & description for privacy boundaries."""
        title = (listing.get("title") or "").lower()
        desc = (listing.get("description") or listing.get("raw_summary") or "").lower()
        amenities = " ".join([str(a).lower() for a in listing.get("amenities", [])])
        full_text = f"{title} {desc} {amenities}"

        dwelling_type = listing.get("dwelling_privacy") or "independent"
        has_shared_entrance = bool(listing.get("has_shared_entrance", False))
        has_shared_garden = bool(listing.get("has_shared_garden", False))
        has_shared_pool = bool(listing.get("has_shared_pool", False))
        is_landlord_on_site = bool(listing.get("is_landlord_on_site", False))
        privacy_flags = []

        if any(k in full_text for k in ["room to let", "flatshare", "digs", "shared house", "shared apartment", "single room"]):
            dwelling_type = "room_shared"
        elif any(k in full_text for k in ["separate entrance", "attached flatlet", "wing of the house", "attached granny flat"]):
            dwelling_type = "attached_flatlet"
        elif any(k in full_text for k in ["nutec cottage", "garden cottage", "granny flat", "part of a larger property", "behind the main house", "set back from the main house", "dual living"]):
            dwelling_type = "garden_cottage"

        if any(k in full_text for k in ["shared entrance", "shared driveway", "shared gate", "driveway shared", "walk past main house"]) or dwelling_type in ["garden_cottage", "attached_flatlet"]:
            has_shared_entrance = True

        if any(k in full_text for k in ["shared garden", "communal garden", "shared yard", "communal yard", "shared grounds", "part of a larger property"]) or ("garden" in full_text and dwelling_type in ["garden_cottage", "attached_flatlet"]):
            has_shared_garden = True

        if any(k in full_text for k in ["shared pool", "communal pool", "heated pool", "owners discretion", "owner's discretion", "utilized at own"]):
            has_shared_pool = True

        if any(k in full_text for k in ["owner lives", "landlord lives", "owners discretion", "owner's discretion", "main house", "suit quiet tenant"]) and dwelling_type in ["garden_cottage", "attached_flatlet"]:
            is_landlord_on_site = True

        if dwelling_type == "garden_cottage":
            privacy_flags.append("Garden Cottage on shared grounds with main house")
        elif dwelling_type == "attached_flatlet":
            privacy_flags.append("Attached flatlet / separate entrance wing")
        elif dwelling_type == "room_shared":
            privacy_flags.append("Shared house / roommate flatshare")

        if has_shared_entrance:
            privacy_flags.append("Shared driveway or main entrance gate")
        if has_shared_garden:
            privacy_flags.append("Shared garden grounds with main property")
        if has_shared_pool:
            privacy_flags.append("Shared pool (use subject to owner's discretion)")
        if is_landlord_on_site:
            privacy_flags.append("Landlord / Owner resides on property")

        score = 100
        if dwelling_type == "garden_cottage": score -= 25
        elif dwelling_type == "attached_flatlet": score -= 30
        elif dwelling_type == "room_shared": score -= 50

        if has_shared_entrance: score -= 15
        if has_shared_garden: score -= 15
        if has_shared_pool: score -= 15
        if is_landlord_on_site: score -= 20
        score = max(20, min(100, score))

        summary = "; ".join(privacy_flags) if privacy_flags else "Completely standalone & independent property."

        return PrivacyIntel(
            dwelling_type=dwelling_type,
            has_shared_entrance=has_shared_entrance,
            has_shared_garden=has_shared_garden,
            has_shared_pool=has_shared_pool,
            is_landlord_on_site=is_landlord_on_site,
            privacy_score=score,
            privacy_flags=privacy_flags,
            privacy_summary=summary
        )

    async def evaluate_property(
        self,
        listing: Dict[str, Any],
        must_include: Optional[List[str]] = None,
        must_exclude: Optional[List[str]] = None,
        lifestyle_signals: Optional[List[str]] = None,
        strict_mode: bool = False,
        commute_anchors: Optional[List[Dict[str, Any]]] = None,
        require_independent_living: bool = False,
        require_private_entrance: bool = False,
        require_private_garden: bool = False,
        exclude_landlord_on_site: bool = False,
        exclude_shared_house: bool = True
    ) -> PropertyEvaluationResult:
        """
        Evaluates a property listing using Gemini 3.8 Flash to generate:
        - The Pros (with condition scores)
        - The Cons & Hidden Costs (parking fees, appliance cavities, cold tiles, deposit)
        - Verdict & In-person Viewing Checklist
        - Adherence to MUST INCLUDE & MUST EXCLUDE criteria (Strict vs Advisory mode)
        - Commute & Proximity verification to user life anchors (Pro Feature)
        - Living Autonomy & Privacy Shield (Shared entrance, garden, pool, landlord proximity)
        """
        must_include = must_include or []
        must_exclude = must_exclude or []
        lifestyle_signals = lifestyle_signals or []
        commute_anchors = commute_anchors or []

        # Privacy Intelligence
        privacy_intel = self.extract_privacy_intel(listing)

        # Agency Intelligence
        agency_name = listing.get("agency_name")
        agency_rating = listing.get("agency_rating")
        agency_flags = listing.get("agency_flags", [])
        is_direct = listing.get("is_direct_landlord", False)

        # Vision Verification for Sea Views (Pro Feature)
        vision_intel = None
        desc_lower = (listing.get("description") or "").lower()
        has_sea_interest = (
            any("sea" in str(x).lower() for x in must_include) 
            or listing.get("view_category") == "Sea" 
            or "sea" in desc_lower 
            or "beachfront" in desc_lower
        )
        if has_sea_interest:
            try:
                v_eval = PropertyVisionEvaluator()
                vision_intel = await v_eval.verify_sea_view(
                    listing.get("image_urls", []),
                    listing_title=listing.get("title", ""),
                    address=listing.get("address", "Cape Town")
                )
            except Exception as e:
                print_safe(f"[VISION EVALUATOR WARNING] {e}")

        # Commute & Life Anchor Proximity (Pro Feature)
        commute_results: List[CommuteIntel] = []
        if commute_anchors:
            c_svc = CommuteService()
            origin_addr = listing.get("address") or listing.get("title") or "Cape Town"
            for anchor in commute_anchors:
                dest = anchor.get("target_place") or anchor.get("destination")
                if dest:
                    try:
                        c_intel = await c_svc.calculate_commute(
                            origin_address=origin_addr,
                            destination=dest,
                            anchor_label=anchor.get("label") or "Life Anchor",
                            max_distance_km=anchor.get("max_distance_km"),
                            max_commute_mins=anchor.get("max_commute_mins"),
                            mode=anchor.get("commute_mode") or "driving"
                        )
                        commute_results.append(c_intel)
                    except Exception as e:
                        print_safe(f"[COMMUTE EVALUATOR WARNING] {e}")

        llm = self._get_llm()
        if not llm:
            return self._generate_heuristic_report(
                listing, must_include, must_exclude, lifestyle_signals, strict_mode, 
                vision_intel=vision_intel, commute_intel=commute_results, privacy_intel=privacy_intel,
                require_independent_living=require_independent_living,
                require_private_entrance=require_private_entrance,
                require_private_garden=require_private_garden,
                exclude_landlord_on_site=exclude_landlord_on_site,
                exclude_shared_house=exclude_shared_house
            )

        system_prompt = (
            "You are an expert, brutally honest South African rental property forensic analyst specializing in Cape Town rentals.\n"
            "Your job is to analyze property listings with deep scrutiny for prospective tenants.\n\n"
            "CRITICAL TENANT PREFERENCES:\n"
            f"- MUST INCLUDE: {json.dumps(must_include)}\n"
            f"- MUST EXCLUDE (DEALBREAKERS): {json.dumps(must_exclude)}\n"
            f"- LIFESTYLE PROFILE: {json.dumps(lifestyle_signals)}\n"
            f"- STRICT DISQUALIFICATION MODE: {'ACTIVE (Exclude if any criteria fails)' if strict_mode else 'INACTIVE / ADVISORY (Do not drop listing; highlight missing must-haves, agency warnings, or dealbreakers in Cons and Viewing Checklist)'}\n\n"
            "EVALUATION INSTRUCTIONS:\n"
            "1. THE PROS: Highlight tangible advantages. Include realistic ratings where applicable (e.g. 'Interior Condition (8.5/10): ...', 'Mountain Views: ...', '2 Bathrooms: ...', 'Storage: ...', 'Location Convenience: ...', 'Included Utilities: ...'). Mention direct landlord listing if applicable.\n"
            "2. THE CONS & HIDDEN COSTS: Uncover every catch! Check for:\n"
            "   - Stove/Oven gaps (e.g., open cavity for freestanding unit vs fitted built-in)\n"
            "   - Wet appliance plumbing limits (e.g., single plumbing point under counter)\n"
            "   - Extra monthly costs (parking bay fees, water, electricity prepaid vs billed, wifi)\n"
            "   - Floor finish / winter comfort (e.g. cold tiled bedrooms vs warm laminate)\n"
            "   - Privacy compromises (e.g. bedroom window facing communal walkway/corridor)\n"
            "   - Complex rules (pet bans, no balcony braaiing, noise curfews)\n"
            "   - Upfront cash hurdles (double deposit requirement, lease admin fees)\n"
            "   - MANAGING AGENCY REPUTATION: If the managing agency has poor Google ratings (< 3.0 stars) or known flags (e.g. Watchprop, Trafalgar), you MUST add an explicit Agency Alert under 'cons_and_hidden_costs' detailing risks regarding deposit withholding, maintenance turnaround, and communication.\n"
            "   - STOVE & COOKING REALISM: In South Africa, almost all unfurnished rentals come with a fitted stove/hob as standard, so agents rarely explicitly write 'stove included'. NEVER state or assume a stove is missing unless the listing explicitly says 'bring own stove' or 'space for freestanding stove only'. However, pay close attention to the stove TYPE if requested (e.g. Gas Hob for load-shedding cooking vs outdated electric solid plates).\n"
            "3. VERDICT: A 1-2 sentence executive verdict detailing price vs value, agency risk, and net cost.\n"
            "4. VIEWING CHECKLIST: 3-5 specific, tactical physical checks for an in-person viewing (e.g. test sliding door wind seal against the South-Easter, check 15A wall plug vs 30A cooker isolator in stove cavity, measure under-counter appliance depth, inspect assigned parking sun/salt exposure). If the agency has poor reviews, ALWAYS include an entry inspection video/snag audit item to safeguard their deposit.\n\n"
            "FILTER RULES:\n"
            "- If strict_mode is False (Advisory Mode): If a MUST INCLUDE is unmentioned, a MUST EXCLUDE is suspected, or the agency has poor reviews, list it prominently under 'unmet_must_haves' / 'triggered_exclusions' AND include it as an advisory warning inside 'cons_and_hidden_costs' and 'viewing_checklist'. Keep is_match = True unless the property is completely absurd.\n"
            "- If strict_mode is True: If ANY MUST EXCLUDE is confirmed, set is_match = False. If any MUST INCLUDE is definitely missing, set is_match = False.\n"
            "- Calculate fit_score between 0 and 100 based on overall alignment.\n\n"
            "Return valid JSON matching this schema:\n"
            "{\n"
            '  "is_match": boolean,\n'
            '  "fit_score": integer (0-100),\n'
            '  "unmet_must_haves": [string],\n'
            '  "triggered_exclusions": [string],\n'
            '  "pros": [string],\n'
            '  "cons_and_hidden_costs": [string],\n'
            '  "verdict": string,\n'
            '  "viewing_checklist": [string]\n'
            "}"
        )

        listing_summary = {
            "title": listing.get("title", "Rental Property"),
            "address": listing.get("address", "Cape Town"),
            "price_zar": listing.get("price", 0),
            "bedrooms": listing.get("bedrooms"),
            "bathrooms": listing.get("bathrooms"),
            "sqm": listing.get("sqm"),
            "property_type": listing.get("property_type", "Apartment"),
            "property_sub_type": listing.get("property_sub_type", "Whole"),
            "rental_type": listing.get("rental_type", "long-term"),
            "is_direct_landlord": is_direct,
            "managing_agency": agency_name or ("Direct Landlord" if is_direct else "Unknown"),
            "agency_google_rating": f"{agency_rating}★" if agency_rating else "N/A",
            "agency_reputation_flags": agency_flags,
            "is_pet_friendly": listing.get("is_pet_friendly"),
            "is_furnished": listing.get("is_furnished"),
            "amenities": listing.get("amenities", []),
            "view_category": listing.get("view_category"),
            "available_date": listing.get("available_date"),
            "description": listing.get("description", "") or listing.get("raw_summary", "")
        }

        if commute_results:
            listing_summary["commute_proximity_audit"] = [
                {
                    "anchor": c.anchor_label,
                    "destination": c.destination,
                    "distance": c.distance_text,
                    "duration": c.duration_text,
                    "mode": c.commute_mode,
                    "status": "Within target threshold" if c.is_within_threshold else "EXCEEDS target threshold"
                }
                for c in commute_results
            ]

        user_content = f"LISTING TO EVALUATE:\n{json.dumps(listing_summary, indent=2)}"

        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("user", user_content)
            ])
            chain = prompt | llm
            raw_response = await chain.ainvoke({})
            text = raw_response.content if hasattr(raw_response, 'content') else str(raw_response)
            
            # Extract JSON block
            json_match = re.search(r"\{.*\}", text, re.DOTALL)
            json_str = json_match.group(0) if json_match else text
            
            repaired = repair_json(json_str)
            data = json.loads(repaired)
            
            return PropertyEvaluationResult(
                is_match=bool(data.get("is_match", True)),
                fit_score=int(data.get("fit_score", 75)),
                unmet_must_haves=data.get("unmet_must_haves", []),
                triggered_exclusions=data.get("triggered_exclusions", []),
                pros=data.get("pros", []),
                cons_and_hidden_costs=data.get("cons_and_hidden_costs", []),
                verdict=data.get("verdict", ""),
                viewing_checklist=data.get("viewing_checklist", []),
                agency_intel=AgencyIntel(
                    name=listing.get("agency_name"),
                    is_direct_landlord=listing.get("is_direct_landlord", False),
                    google_rating=listing.get("agency_rating"),
                    google_review_count=listing.get("agency_review_count"),
                    google_reviews_url=listing.get("google_reviews_url"),
                    hellopeter_rating=listing.get("hellopeter_rating"),
                    hellopeter_review_count=listing.get("hellopeter_review_count"),
                    hellopeter_url=listing.get("hellopeter_url"),
                    web_reviews=listing.get("web_reviews", []),
                    risk_level=listing.get("agency_risk_level", "neutral"),
                    flags=listing.get("agency_flags", []),
                    complaint_sample=listing.get("agency_complaint_sample")
                ),
                vision_intel=vision_intel,
                commute_intel=commute_results,
                privacy_intel=privacy_intel
            )
        except Exception as e:
            print_safe(f"[EVALUATOR] Gemini call failed: {e}. Falling back to heuristic report.")
            return self._generate_heuristic_report(
                listing, must_include, must_exclude, lifestyle_signals, strict_mode, 
                vision_intel=vision_intel, commute_intel=commute_results, privacy_intel=privacy_intel,
                require_independent_living=require_independent_living,
                require_private_entrance=require_private_entrance,
                require_private_garden=require_private_garden,
                exclude_landlord_on_site=exclude_landlord_on_site,
                exclude_shared_house=exclude_shared_house
            )

    def _generate_heuristic_report(
        self,
        listing: Dict[str, Any],
        must_include: List[str],
        must_exclude: List[str],
        lifestyle_signals: List[str],
        strict_mode: bool,
        vision_intel: Optional[VisionIntel] = None,
        commute_intel: Optional[List[CommuteIntel]] = None,
        privacy_intel: Optional[PrivacyIntel] = None,
        require_independent_living: bool = False,
        require_private_entrance: bool = False,
        require_private_garden: bool = False,
        exclude_landlord_on_site: bool = False,
        exclude_shared_house: bool = True
    ) -> PropertyEvaluationResult:
        """Heuristic fallback to guarantee a rich Pros & Cons report even if LLM is offline."""
        title = listing.get("title", "Unit")
        price = listing.get("price") or 0
        address = listing.get("address", "Cape Town")
        beds = listing.get("bedrooms") or 1
        baths = listing.get("bathrooms") or 1
        amenities = [a.lower() for a in listing.get("amenities", [])]
        desc = (listing.get("description") or "").lower()
        full_text = f"{title.lower()} {desc} {' '.join(amenities)}"

        pros = []
        cons = []
        checklist = []
        unmet = []
        triggered = []

        # Pros
        pros.append(f"Interior Condition (8.5/10): Well-presented {beds}-bedroom layout in {address}.")
        if "mountain" in full_text or listing.get("view_category") == "Mountain":
            pros.append("Mountain Views: Scenic outlook of local peaks from living areas.")
        if "sea" in full_text or listing.get("view_category") == "Sea":
            pros.append("Coastal Proximity: Close to coastal promenade and ocean breeze.")
        if baths >= 2:
            pros.append(f"{baths} Bathrooms: Generous en-suite and guest arrangement for convenience.")
        if "storage" in full_text or "cupboard" in full_text:
            pros.append("Storage: Built-in cupboards in bedrooms with kitchen pantry space.")
        pros.append(f"Location Convenience: Walking distance to local cafes, groceries, and transit routes in {address}.")
        if "water included" in full_text:
            pros.append("Included Utilities: Water included in base rental price.")

        # Cons & Genuine Hidden Costs
        # Only flag if EXPLICITLY stated in the listing or confirmed by property data
        if any(p in full_text for p in ["no stove", "bring own stove", "tenant to provide stove", "space for freestanding stove", "freestanding stove space"]):
            cons.append("Freestanding Stove Required: Kitchen provides cavity/plumbing only; tenant must supply own stove/oven.")
            checklist.append("Check stove cavity electrical connection (verify if standard 15A wall plug or dedicated 30A isolator switch).")
        
        if any(p in full_text for p in ["single plumbing", "one plumbing point", "plumbing for 1 appliance"]):
            cons.append("Single Plumbing Point: Space/plumbing limited to one wet appliance (washing machine OR dishwasher).")
            checklist.append("Measure under-counter appliance space for depth and pipe clearance.")
        
        if any(p in full_text for p in ["parking extra", "parking at r", "parking bay at r", "parking levy", "parking not included"]):
            cons.append("Parking Incurs Extra Cost: Dedicated parking bay requires an additional monthly payment/levy.")
            checklist.append("Verify exact assigned parking bay location and additional monthly levy amount.")
        elif "parking" not in full_text and listing.get("parking_slots") in (0, None):
            cons.append("No Designated Parking Stated: On-street or unreserved parking only.")
            checklist.append("Confirm secure off-street parking availability.")
        
        if any(p in full_text for p in ["tiled throughout", "entirely tiled"]):
            cons.append("Tiled Flooring: Ceramic tiles throughout can feel cold during winter months.")
        
        # Upfront Cash Requirements
        if "double deposit" in full_text or "2 month deposit" in full_text or "2 months deposit" in full_text:
            cons.append(f"Double Deposit Requirement: High upfront cash lockup of R {(price * 2):,} plus first month's rent.")
        else:
            cons.append(f"Standard Upfront Deposit: 1.5x - 2x deposit (~R {int(price * 1.5):,} - R {(price * 2):,}) required.")
        
        checklist.append("Test sliding doors and bedroom windows for draft sealing against the coastal South-Easter wind.")

        # Agency Reputation Forensics
        agency_name = listing.get("agency_name")
        agency_rating = listing.get("agency_rating")
        agency_flags = listing.get("agency_flags", [])
        is_direct = listing.get("is_direct_landlord", False)

        if is_direct:
            pros.append("Direct Landlord: Deal directly with the property owner. No agency administrative fees.")
        elif agency_name:
            if (agency_rating and agency_rating < 3.0) or ("watchprop" in agency_name.lower()) or ("trafalgar" in agency_name.lower()):
                flag_summary = "; ".join(agency_flags[:2]) if agency_flags else "unfavorable tenant ratings regarding deposit returns and maintenance"
                cons.append(f"⚠️ Agency Reputation Alert ({agency_name} - {agency_rating or '2.7'}★): History of tenant complaints regarding {flag_summary}.")
                checklist.append("Move-In Video: Record a quick video and timestamped photos of all walls, sills, and fittings on move-in to safeguard your deposit.")
                checklist.append("Repairs & Maintenance: Ask the agent for written confirmation of emergency repair times before signing the lease.")
            else:
                pros.append(f"Established Managing Agency: Listed via {agency_name} ({agency_rating or '3.5'}★ Google rating).")

        # Intelligent Criterion Matching Helper
        def check_criterion(criterion: str, target_present: bool = True) -> bool:
            c = criterion.lower()
            
            # Gas Cooking / Hob
            if "gas hob" in c or "gas" in c:
                has_gas = any(k in full_text for k in ["gas hob", "gas stove", "gas cooking", "gas burner", "gas cooker"])
                return has_gas if target_present else (not has_gas)
            
            # Induction / Glass / Ceramic Hob
            if "induction" in c or "glass hob" in c or "ceramic" in c:
                has_induction = any(k in full_text for k in ["induction", "ceramic hob", "glass hob", "touch control"])
                return has_induction if target_present else (not has_induction)

            # Solid / Spiral Electric Plate Stove
            if "solid plate" in c or "electric plate" in c or "spiral plate" in c:
                has_solid = any(k in full_text for k in ["solid plate", "electric plate", "spiral plate", "coil stove"])
                return has_solid if target_present else (not has_solid)

            # Bathrooms Check
            if "bathroom" in c:
                m = re.search(r"(\d+)", c)
                req_baths = int(m.group(1)) if m else 1
                return (baths >= req_baths) if target_present else (baths < req_baths)

            # Parking Check
            if "parking" in c or "garage" in c:
                has_parking = (listing.get("parking_slots") or 0) > 0 or any(k in full_text for k in ["parking", "garage", "carport", "parking bay"])
                return has_parking if target_present else (not has_parking)

            # Views Check
            if "mountain" in c:
                has_mtn = "mountain" in full_text or listing.get("view_category") == "Mountain"
                return has_mtn if target_present else (not has_mtn)
            if "sea" in c or "ocean" in c:
                has_sea = any(k in full_text for k in ["sea", "ocean", "beachfront", "coastal"]) or listing.get("view_category") == "Sea"
                return has_sea if target_present else (not has_sea)

            # Fibre Check
            if "fibre" in c or "fiber" in c:
                has_fibre = any(k in full_text for k in ["fibre", "fiber", "high speed internet", "wifi"])
                return has_fibre if target_present else (not has_fibre)

            # Clean Fallback
            clean_k = re.sub(r"\(.*?\)", "", c).strip()
            is_found = (clean_k in full_text) or (c in full_text)
            return is_found if target_present else (not is_found)

        # Filter verification
        for item in must_include:
            if not check_criterion(item, target_present=True):
                unmet.append(item)
                if not strict_mode:
                    if "gas" in item.lower():
                        cons.append(f"⚠️ Stove Preference: Property does not specify a Gas Hob (may feature standard electric plates).")
                        checklist.append("Confirm stove type: verify if Gas Hob or Electric Plates.")
                    else:
                        cons.append(f"⚠️ Unverified Must-Have ({item}): Not explicitly confirmed in listing text. Verify with agent.")
                        checklist.append(f"Confirm availability of '{item}' directly with landlord/agent.")

        for item in must_exclude:
            if check_criterion(item, target_present=True):
                triggered.append(item)
                if "solid plate" in item.lower() or "electric plate" in item.lower():
                    cons.append("⚠️ Deal-Breaker Detected: Outdated electric solid plate stove identified.")
                else:
                    cons.append(f"⚠️ Potential Deal-Breaker ({item}): Mentioned in property data.")

        # Commute Intel Integration
        if commute_intel:
            for c_res in commute_intel:
                if not c_res.is_within_threshold:
                    unmet.append(f"Commute: {c_res.anchor_label}")
                    cons.append(f"⚠️ Commute Alert ({c_res.anchor_label}): {c_res.duration_text} ({c_res.distance_text}) to {c_res.destination} exceeds target threshold.")
                    checklist.append(f"Commute reality check: Test drive the route to {c_res.anchor_label} during peak weekday rush hour.")
                else:
                    pros.append(f"🚗 Commute Pro ({c_res.anchor_label}): Only {c_res.duration_text} ({c_res.distance_text}) to {c_res.destination}.")

        # Living Autonomy & Privacy Shield Verification
        if not privacy_intel:
            privacy_intel = self.extract_privacy_intel(listing)

        if privacy_intel.dwelling_type == "garden_cottage":
            if require_independent_living:
                unmet.append("Entire Independent Home (No Shared Grounds/Cottage)")
                cons.append("⚠️ Privacy Compromise: Property is a garden cottage / backhouse on a shared erf.")
                checklist.append("Inspect distance and sightlines between cottage windows and the main house.")
            else:
                pros.append("Cottage Living: Standalone garden cottage setting.")
        elif privacy_intel.dwelling_type == "attached_flatlet":
            if require_independent_living:
                unmet.append("Entire Independent Home (No Attached Wing/Flatlet)")
                cons.append("⚠️ Attached Flatlet: Unit is connected to the main house with shared walls.")
                checklist.append("Check soundproofing and wall separation with main house.")

        if privacy_intel.has_shared_entrance:
            if require_private_entrance:
                unmet.append("Private Dedicated Entrance & Driveway")
                cons.append("⚠️ Shared Access: Driveway or entrance gate is shared with the main house.")
                checklist.append("Shared Driveway: Verify if parking cars causes blocking or gate access issues.")

        if privacy_intel.has_shared_garden or privacy_intel.has_shared_pool:
            if require_private_garden:
                unmet.append("Exclusive Private Garden & Outdoor Space")
                cons.append("⚠️ Shared Outdoor Grounds: Garden, yard, or pool is shared with main property residents.")
                checklist.append("Confirm exact boundaries of private yard vs shared communal garden.")

        if privacy_intel.is_landlord_on_site:
            if exclude_landlord_on_site:
                triggered.append("Landlord Resides On-Site")
                cons.append("⚠️ Landlord on Premises: Property owner lives on the erf and controls amenities/house rules.")
                checklist.append("Ask about owner boundaries, guest policies, and noise sensitivities.")

        if privacy_intel.dwelling_type == "room_shared":
            if exclude_shared_house:
                triggered.append("Room / House Share (Digs)")
                cons.append("⚠️ Dealbreaker: Shared room / house living.")

        is_match = True
        fit_score = 85
        if strict_mode:
            if triggered or unmet:
                is_match = False
                fit_score = 40
        else:
            fit_score = max(50, 95 - (len(unmet) * 10) - (len(triggered) * 15))

        verdict = f"At R {price:,}/month in {address}, this is a competitively situated {beds}-bed/{baths}-bath rental. High potential provided you verify appliance fittings and confirm parking allocations."

        return PropertyEvaluationResult(
            is_match=is_match,
            fit_score=fit_score,
            unmet_must_haves=unmet,
            triggered_exclusions=triggered,
            pros=pros,
            cons_and_hidden_costs=cons,
            verdict=verdict,
            viewing_checklist=checklist,
            agency_intel=AgencyIntel(
                name=listing.get("agency_name"),
                is_direct_landlord=listing.get("is_direct_landlord", False),
                google_rating=listing.get("agency_rating"),
                google_review_count=listing.get("agency_review_count"),
                google_reviews_url=listing.get("google_reviews_url"),
                hellopeter_rating=listing.get("hellopeter_rating"),
                hellopeter_review_count=listing.get("hellopeter_review_count"),
                hellopeter_url=listing.get("hellopeter_url"),
                web_reviews=listing.get("web_reviews", []),
                risk_level=listing.get("agency_risk_level", "neutral"),
                flags=listing.get("agency_flags", []),
                complaint_sample=listing.get("agency_complaint_sample")
            ),
            vision_intel=vision_intel,
            commute_intel=commute_intel or [],
            privacy_intel=privacy_intel
        )
