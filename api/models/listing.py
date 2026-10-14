from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import datetime as dt

class RentalListing(BaseModel):
    # Core Data
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = Field(description="The catchy title of the rental listing")
    price: Optional[int] = Field(default=None, description="The monthly rental price in ZAR")
    address: Optional[str] = Field(default=None, description="The full address or area of the property")
    bedrooms: Optional[float] = Field(default=None, description="Number of bedrooms")
    bathrooms: Optional[float] = Field(default=None, description="Number of bathrooms")
    
    # Professional Metadata
    property_type: Optional[str] = Field(None, description="Apartment, House, Studio, etc.")
    property_sub_type: str = Field("Whole", description="Whole vs Shared")
    rental_type: Optional[str] = Field("long-term", description="long-term, short-term, or pet-sitting")
    lease_period: Optional[str] = Field(None, description="Lease duration, e.g. '6 months renewable'")
    is_direct_landlord: bool = Field(False, description="True if listed by private owner/landlord")
    agency_name: Optional[str] = Field(None, description="Managing real estate agency (e.g. Watchprop, Rawson)")
    agency_rating: Optional[float] = Field(None, description="Average Google review rating (e.g. 2.7, 4.0)")
    agency_review_count: Optional[int] = Field(None, description="Total Google review count")
    google_reviews_url: Optional[str] = Field(None, description="Direct URL to Google Reviews")
    hellopeter_rating: Optional[float] = Field(None, description="Hello Peter rating out of 5")
    hellopeter_review_count: Optional[int] = Field(None, description="Total reviews on Hello Peter")
    hellopeter_url: Optional[str] = Field(None, description="Direct URL to Hello Peter agency profile")
    web_reviews: List[dict] = Field(default_factory=list, description="Aggregated 'Reviews from the web' (e.g. Facebook, HelloPeter)")
    agency_risk_level: Optional[str] = Field("neutral", description="Tenant risk classification: low, moderate, high, neutral")
    agency_flags: List[str] = Field(default_factory=list, description="Common tenant complaints or reputation red flags")
    agency_complaint_sample: Optional[str] = Field(None, description="Representative tenant review snippet")
    is_furnished: Optional[bool] = Field(None)
    amenities: List[str] = Field(default_factory=list)
    parking_slots: Optional[int] = Field(None)
    view_category: Optional[str] = Field(None, description="Sea, Mountain, or Other")
    sqm: Optional[int] = Field(None, description="Square meterage")
    available_date: Optional[str] = Field(None, description="Immediate, 1 May, etc.")
    contact_info: Optional[str] = Field(None, description="Extracted contact details")
    published_at: Optional[str] = Field(None, description="When it was posted")
    
    # Privacy & Autonomy Dimensions
    dwelling_privacy: Optional[str] = Field("independent", description="independent, garden_cottage, attached_flatlet, room_shared")
    has_shared_entrance: Optional[bool] = Field(False)
    has_shared_garden: Optional[bool] = Field(False)
    has_shared_pool: Optional[bool] = Field(False)
    is_landlord_on_site: Optional[bool] = Field(False)
    
    # Flags & Scoring
    is_pet_friendly: Optional[bool] = Field(description="Whether pets are allowed (True/False/null)")
    is_looking_for: bool = Field(description="True if 'Wanted' ad")
    description: Optional[str] = Field(None, description="Short summary")
    source_url: str = Field(description="The original URL")
    image_urls: List[str] = Field(default_factory=list, description="Property images")
    platform: str = Field(description="P24, Facebook, etc.")
    
    # Internal Tracking
    user_id: Optional[str] = Field(None)
    match_score: Optional[int] = Field(None)
    match_reason: Optional[str] = Field(None)
    task_id: Optional[str] = Field(None)

class ExtractionResult(BaseModel):
    listings: List[RentalListing]
    confidence_score: float
    raw_summary: str
    cached_hashes: List[str] = Field(default_factory=list)
