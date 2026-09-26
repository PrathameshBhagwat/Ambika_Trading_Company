"""
Transaction Pydantic schemas - request/response validation.

Handles the full transaction structure: header + items + deductions.
"""

from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class TransactionItemCreate(BaseModel):
    """Schema for a single line item within a transaction."""
    vegetable_id: int = Field(..., gt=0, description="ID of the vegetable")
    bags_count: int = Field(..., ge=1, description="Number of bags/dag")
    weight_kg: float = Field(..., gt=0, description="Total weight in KG")
    rate_per_10kg: float = Field(..., gt=0, description="Rate per 10 KG in INR")


class TransactionItemResponse(BaseModel):
    """Response schema for a transaction line item."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    vegetable_id: int
    vegetable_name: str | None = None  # Populated from join
    bags_count: int
    weight_kg: float
    rate_per_10kg: float
    item_amount: float


class DeductionCreate(BaseModel):
    """Schema for deduction entry. All fields default to 0."""
    hamali: float = Field(0.00, ge=0, description="Loading/unloading labor charge")
    bharai: float = Field(0.00, ge=0, description="Bag filling/packing charge")
    tolai: float = Field(0.00, ge=0, description="Weighing charge")
    mapai: float = Field(0.00, ge=0, description="Measurement/counting charge")
    lekki: float = Field(0.00, ge=0, description="Commission / brokerage charge")
    motor_bhada: float = Field(0.00, ge=0, description="Transportation charge")
    other_deductions: float = Field(0.00, ge=0, description="Miscellaneous deductions")
    other_deductions_note: str | None = Field(None, description="Note for other deductions")


class DeductionResponse(BaseModel):
    """Response schema for deductions."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    hamali: float
    bharai: float
    tolai: float
    mapai: float
    lekki: float
    motor_bhada: float
    other_deductions: float
    other_deductions_note: str | None
    total_deductions: float


class TransactionCreate(BaseModel):
    """
    Schema for creating a complete transaction.
    Includes items and deductions in a single request.
    """
    transaction_date: date = Field(..., description="Date of the transaction")
    farmer_id: int = Field(..., gt=0, description="ID of the farmer")
    buyer_name: str | None = Field(None, max_length=100, description="Buyer name / खरेदीदाराचे नाव")
    items: list[TransactionItemCreate] = Field(
        ..., min_length=1, description="At least one vegetable item required"
    )
    deductions: DeductionCreate = Field(
        default_factory=DeductionCreate,
        description="Deductions applied to this transaction"
    )

    @field_validator("transaction_date")
    @classmethod
    def date_not_in_future(cls, v: date) -> date:
        from datetime import date as date_type
        if v > date_type.today():
            raise ValueError("Transaction date cannot be in the future")
        return v


class TransactionUpdate(BaseModel):
    """Schema for updating a transaction (limited to unpaid transactions)."""
    farmer_id: int | None = None
    buyer_name: str | None = None
    transaction_date: date | None = None
    items: list[TransactionItemCreate] | None = None
    deductions: DeductionCreate | None = None


class TransactionCancelRequest(BaseModel):
    """Schema for cancelling a transaction."""
    cancel_reason: str = Field(..., min_length=1, description="Reason for cancellation is mandatory")


class TransactionResponse(BaseModel):
    """Full transaction response with items, deductions, and payment summary."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    bill_number: str
    transaction_date: date
    farmer_id: int
    buyer_name: str | None = None
    farmer_name: str | None = None  # Populated from join
    farmer_mobile: str | None = None  # Populated from farmer relation (Phase D)
    farmer_village: str | None = None  # Populated from farmer relation (Phase D)

    # Financial summary
    gross_amount: float
    total_deductions: float
    net_payable: float
    total_paid: float
    balance_due: float

    # Status & Reprint Tracking
    status: str
    cancel_reason: str | None
    print_count: int = 0  # Phase G reprint tracking

    # Details
    items: list[TransactionItemResponse] = []
    deduction: DeductionResponse | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


class TransactionListItem(BaseModel):
    """Lightweight transaction for list views (no nested items/deductions)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    bill_number: str
    transaction_date: date
    farmer_id: int
    buyer_name: str | None = None
    farmer_name: str | None = None
    farmer_mobile: str | None = None
    farmer_village: str | None = None
    gross_amount: float
    total_deductions: float
    net_payable: float
    total_paid: float
    balance_due: float
    status: str
    print_count: int = 0
    created_at: datetime


class TransactionListResponse(BaseModel):
    """Paginated list of transactions."""
    items: list[TransactionListItem]
    total: int
