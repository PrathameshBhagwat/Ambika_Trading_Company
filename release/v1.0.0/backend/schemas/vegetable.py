"""
Vegetable Pydantic schemas - request/response validation.
"""

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class VegetableBase(BaseModel):
    """Shared fields for vegetable create/update."""
    name_local: str = Field(..., min_length=1, max_length=200, description="Name in Marathi/Hindi")
    name_english: str | None = Field(None, max_length=200, description="Name in English")


class VegetableCreate(VegetableBase):
    """Schema for creating a new vegetable."""
    pass


class VegetableUpdate(BaseModel):
    """Schema for updating a vegetable. All fields optional."""
    name_local: str | None = Field(None, min_length=1, max_length=200)
    name_english: str | None = Field(None, max_length=200)
    is_active: bool | None = None


class VegetableResponse(VegetableBase):
    """Schema for vegetable API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class VegetableListResponse(BaseModel):
    """List of vegetables."""
    items: list[VegetableResponse]
    total: int
