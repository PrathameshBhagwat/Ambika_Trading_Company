"""
Reports API router - daily summary, date-range, farmer outstanding, payment summary.
"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from database import get_db
from models.transaction import Transaction, TransactionStatus
from models.transaction_item import TransactionItem
from models.vegetable import Vegetable
from models.payment import Payment
from schemas.report import (
    DailySummaryResponse,
    VegetableSummaryItem,
    FarmerOutstandingItem,
    FarmerOutstandingReport,
    PaymentSummaryItem,
    PaymentSummaryReport,
)
from models.farmer import Farmer

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/daily-summary", response_model=DailySummaryResponse)
def daily_summary(
    date_from: date = Query(..., description="Start date"),
    date_to: date | None = Query(None, description="End date (defaults to date_from)"),
    db: Session = Depends(get_db),
):
    """
    Generate a daily or date-range summary report.
    Includes transaction counts, vegetable breakdown, and financial totals.
    """
    if date_to is None:
        date_to = date_from

    # Only include non-cancelled transactions
    active_statuses = [
        TransactionStatus.SAVED,
        TransactionStatus.PARTIALLY_PAID,
        TransactionStatus.FULLY_PAID,
    ]

    base_query = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
            Transaction.status.in_(active_statuses),
        )
    )

    # Transaction counts
    total_transactions = base_query.count()
    total_farmers = base_query.with_entities(
        func.count(distinct(Transaction.farmer_id))
    ).scalar()

    # Financial totals
    totals = base_query.with_entities(
        func.coalesce(func.sum(Transaction.gross_amount), 0),
        func.coalesce(func.sum(Transaction.total_deductions), 0),
        func.coalesce(func.sum(Transaction.net_payable), 0),
    ).first()

    total_gross = float(totals[0])
    total_ded = float(totals[1])
    total_net = float(totals[2])

    # Payments received in this date range (excluding cancelled transactions)
    total_payments = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .join(Transaction, Payment.transaction_id == Transaction.id)
        .filter(
            Payment.payment_date >= date_from,
            Payment.payment_date <= date_to,
            Transaction.status.in_(active_statuses),
        )
        .scalar()
    )
    total_payments = float(total_payments)

    # Vegetable breakdown
    veg_breakdown = (
        db.query(
            TransactionItem.vegetable_id,
            Vegetable.name_local,
            func.sum(TransactionItem.weight_kg),
            func.sum(TransactionItem.item_amount),
        )
        .join(Transaction, TransactionItem.transaction_id == Transaction.id)
        .join(Vegetable, TransactionItem.vegetable_id == Vegetable.id)
        .filter(
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
            Transaction.status.in_(active_statuses),
        )
        .group_by(TransactionItem.vegetable_id, Vegetable.name_local)
        .all()
    )

    veg_items = []
    for veg_id, veg_name, total_weight, total_amount in veg_breakdown:
        tw = float(total_weight)
        ta = float(total_amount)
        avg_rate = (ta / (tw / 10)) if tw > 0 else 0
        veg_items.append(VegetableSummaryItem(
            vegetable_id=veg_id,
            vegetable_name=veg_name,
            total_weight_kg=tw,
            total_amount=ta,
            avg_rate_per_10kg=round(avg_rate, 2),
        ))

    return DailySummaryResponse(
        report_date_from=date_from,
        report_date_to=date_to,
        total_transactions=total_transactions,
        total_farmers_served=total_farmers or 0,
        vegetable_breakdown=veg_items,
        total_gross_amount=total_gross,
        total_deductions=total_ded,
        total_net_payable=total_net,
        total_payments_received=total_payments,
        total_outstanding=total_net - total_payments,
    )


@router.get("/farmer-outstanding", response_model=FarmerOutstandingReport)
def farmer_outstanding(db: Session = Depends(get_db)):
    """Report of all farmers with outstanding (unpaid) balances."""
    active_statuses = [
        TransactionStatus.SAVED,
        TransactionStatus.PARTIALLY_PAID,
    ]

    results = (
        db.query(
            Farmer.id,
            Farmer.name,
            Farmer.village,
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.net_payable), 0),
            func.coalesce(func.sum(Transaction.total_paid), 0),
            func.coalesce(func.sum(Transaction.balance_due), 0),
        )
        .join(Transaction, Farmer.id == Transaction.farmer_id)
        .filter(Transaction.status.in_(active_statuses))
        .group_by(Farmer.id, Farmer.name, Farmer.village)
        .having(func.sum(Transaction.balance_due) > 0)
        .order_by(func.sum(Transaction.balance_due).desc())
        .all()
    )

    items = []
    grand_total = 0.0
    for fid, fname, village, txn_count, net, paid, outstanding in results:
        outstanding_val = float(outstanding)
        grand_total += outstanding_val
        items.append(FarmerOutstandingItem(
            farmer_id=fid,
            farmer_name=fname,
            village=village,
            total_transactions=txn_count,
            total_net_payable=float(net),
            total_paid=float(paid),
            total_outstanding=outstanding_val,
        ))

    return FarmerOutstandingReport(
        items=items,
        grand_total_outstanding=round(grand_total, 2),
    )


@router.get("/payment-summary", response_model=PaymentSummaryReport)
def payment_summary(
    date_from: date = Query(..., description="Start date"),
    date_to: date | None = Query(None, description="End date"),
    db: Session = Depends(get_db),
):
    """Payment summary grouped by payment mode."""
    if date_to is None:
        date_to = date_from

    active_statuses = [
        TransactionStatus.SAVED,
        TransactionStatus.PARTIALLY_PAID,
        TransactionStatus.FULLY_PAID,
    ]

    results = (
        db.query(
            Payment.payment_mode,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .join(Transaction, Payment.transaction_id == Transaction.id)
        .filter(
            Payment.payment_date >= date_from,
            Payment.payment_date <= date_to,
            Transaction.status.in_(active_statuses),
        )
        .group_by(Payment.payment_mode)
        .all()
    )

    mode_items = []
    grand_total = 0.0
    for mode, count, total in results:
        total_val = float(total)
        grand_total += total_val
        mode_items.append(PaymentSummaryItem(
            payment_mode=mode.value if hasattr(mode, 'value') else str(mode),
            count=count,
            total_amount=total_val,
        ))

    return PaymentSummaryReport(
        report_date_from=date_from,
        report_date_to=date_to,
        mode_breakdown=mode_items,
        grand_total=round(grand_total, 2),
    )
