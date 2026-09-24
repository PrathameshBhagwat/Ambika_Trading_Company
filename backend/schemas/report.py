"""
Report Pydantic schemas - response models for reporting endpoints.
"""

from datetime import date
from pydantic import BaseModel, Field


class VegetableSummaryItem(BaseModel):
    """Summary for one vegetable within a report period."""
    vegetable_id: int
    vegetable_name: str
    total_weight_kg: float
    total_amount: float
    avg_rate_per_10kg: float


class DailySummaryResponse(BaseModel):
    """Daily or date-range summary report."""
    report_date_from: date
    report_date_to: date
    total_transactions: int
    total_farmers_served: int
    vegetable_breakdown: list[VegetableSummaryItem]
    total_gross_amount: float
    total_deductions: float
    total_net_payable: float
    total_payments_received: float
    total_outstanding: float


class FarmerOutstandingItem(BaseModel):
    """Outstanding balance for a single farmer."""
    farmer_id: int
    farmer_name: str
    village: str | None
    total_transactions: int
    total_net_payable: float
    total_paid: float
    total_outstanding: float


class FarmerOutstandingReport(BaseModel):
    """Report of all farmers with outstanding balances."""
    items: list[FarmerOutstandingItem]
    grand_total_outstanding: float


class PaymentSummaryItem(BaseModel):
    """Payments summary by mode."""
    payment_mode: str
    count: int
    total_amount: float


class PaymentSummaryReport(BaseModel):
    """Payment summary for a date range."""
    report_date_from: date
    report_date_to: date
    mode_breakdown: list[PaymentSummaryItem]
    grand_total: float
