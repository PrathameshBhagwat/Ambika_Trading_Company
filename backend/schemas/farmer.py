"""
Farmer Pydantic schemas - request/response validation.
"""

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class FarmerBase(BaseModel):
    """Shared fields for farmer create/update."""
    name: str = Field(..., min_length=1, max_length=200, description="Farmer's full name")
    mobile: str | None = Field(None, max_length=15, description="Mobile phone number")
    village: str | None = Field(None, max_length=200, description="Village name")
    address: str | None = Field(None, description="Full address")
    notes: str | None = Field(None, description="Optional notes")


class FarmerCreate(FarmerBase):
    """Schema for creating a new farmer."""
    pass


class FarmerUpdate(BaseModel):
    """Schema for updating a farmer. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=200)
    mobile: str | None = Field(None, max_length=15)
    village: str | None = Field(None, max_length=200)
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class FarmerResponse(FarmerBase):
    """Schema for farmer API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class FarmerListResponse(BaseModel):
    """Paginated list of farmers."""
    items: list[FarmerResponse]
    total: int


class DuplicateFarmerMatch(BaseModel):
    id: int
    name: str
    mobile: str | None = None
    village: str | None = None
    match_reason: str


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    matches: list[DuplicateFarmerMatch]
    message: str | None = None
