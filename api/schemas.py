from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

class RentalListing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = Field(description="The catchy title of the rental listing")
    price: Optional[int] = Field(default=None, description="The monthly rental price in ZAR")
    address: Optional[str] = Field(default=None, description="The full address or area of the property")
    bedrooms: Optional[float] = Field(default=None, description="Number of bedrooms")
    bathrooms: Optional[float] = Field(default=None, description="Number of bathrooms")
    is_pet_friendly: Optional[bool] = Field(description="Whether the property allows pets (True), does not (False), or is unknown/on-application (null)")
    is_looking_for: bool = Field(description="Whether this is a 'Wanted' ad or a tenant looking for a place (True) vs a property available to rent (False)")
    description: str = Field(description="Short summary of the property from the description")
    source_url: str = Field(description="The original URL of the listing")
    image_urls: List[str] = Field(default_factory=list, description="List of URLs for property images")
    platform: str = Field(description="The platform where the listing was found (e.g., Property24, Facebook)")
    user_id: Optional[str] = Field(None, description="The user this listing was found for")
    match_score: Optional[int] = Field(None, description="Score from 0-100 on how well it fits user requirements")
    match_reason: Optional[str] = Field(None, description="AI explanation of why this property is a match")
    task_id: Optional[str] = Field(None, description="The ID of the sniper task that found this listing")

class ExtractionResult(BaseModel):
    listings: List[RentalListing]
    confidence_score: float
    raw_summary: str
    cached_hashes: List[str] = Field(default_factory=list)
