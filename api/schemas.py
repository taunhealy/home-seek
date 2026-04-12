from pydantic import BaseModel, Field
from typing import List, Optional

class RentalListing(BaseModel):
    title: str = Field(description="The catchy title of the rental listing")
    price: int = Field(description="The monthly rental price in ZAR")
    address: str = Field(description="The full address or area of the property")
    bedrooms: Optional[float] = Field(description="Number of bedrooms")
    bathrooms: Optional[float] = Field(description="Number of bathrooms")
    is_pet_friendly: bool = Field(description="Whether the property allows pets")
    has_solar: bool = Field(description="Whether the property has solar power or inverter system")
    has_borehole: bool = Field(description="Whether the property has a borehole or backup water")
    description: str = Field(description="Short summary of the property from the description")
    source_url: str = Field(description="The original URL of the listing")
    image_urls: List[str] = Field(default_factory=list, description="List of URLs for property images")
    platform: str = Field(description="The platform where the listing was found (e.g., Property24, Facebook)")
    user_id: Optional[str] = Field(None, description="The user this listing was found for")
    match_score: Optional[int] = Field(None, description="Score from 0-100 on how well it fits user requirements")
    match_reason: Optional[str] = Field(None, description="AI explanation of why this property is a match")

class ExtractionResult(BaseModel):
    listings: List[RentalListing]
    confidence_score: float
    raw_summary: str
