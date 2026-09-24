"""
Payment Pydantic schemas - request/response validation.
"""

from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class PaymentCreate(BaseModel):
    """Schema for recording a payment."""
    transaction_id: int = Field(..., gt=0, description="Transaction to pay against")
    amount: float = Field(..., gt=0, description="Payment amount in INR")
    payment_date: date = Field(..., description="Date of payment")
    payment_mode: str = Field(
        ...,
        description="Payment mode: cash, bank_transfer, upi, cheque"
    )
    reference_number: str | None = Field(None, max_length=100, description="Bank/UPI/Cheque reference")
    notes: str | None = Field(None, description="Optional payment notes")

    @field_validator("payment_date")
    @classmethod
    def date_not_in_future(cls, v: date) -> date:
        from datetime import date as date_type
        if v > date_type.today():
            raise ValueError("Payment date cannot be in the future")
        return v

    @field_validator("payment_mode")
    @classmethod
    def valid_payment_mode(cls, v: str) -> str:
        valid_modes = {"cash", "bank_transfer", "upi", "cheque"}
        if v.lower() not in valid_modes:
            raise ValueError(f"Invalid payment mode '{v}'. Must be one of: {valid_modes}")
        return v.lower()


class PaymentResponse(BaseModel):
    """Response schema for a payment record."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int
    amount: float
    payment_date: date
    payment_mode: str
    reference_number: str | None
    notes: str | None
    created_at: datetime


class PaymentListResponse(BaseModel):
    """List of payments."""
    items: list[PaymentResponse]
    total: int
