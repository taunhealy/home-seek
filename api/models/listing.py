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
    is_furnished: Optional[bool] = Field(None)
    amenities: List[str] = Field(default_factory=list)
    parking_slots: Optional[int] = Field(None)
    view_category: Optional[str] = Field(None, description="Sea, Mountain, or Other")
    sqm: Optional[int] = Field(None, description="Square meterage")
    available_date: Optional[str] = Field(None, description="Immediate, 1 May, etc.")
    contact_info: Optional[str] = Field(None, description="Extracted contact details")
    published_at: Optional[str] = Field(None, description="When it was posted")
    
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
