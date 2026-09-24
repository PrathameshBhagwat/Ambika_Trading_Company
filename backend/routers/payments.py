"""
Payments API router - record payments against transactions.

Payments are append-only. Supports partial payments.
Auto-updates transaction status on payment.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date

from database import get_db
from models.transaction import Transaction, TransactionStatus
from models.payment import Payment, PaymentMode
from schemas.payment import PaymentCreate, PaymentResponse, PaymentListResponse
from utils.calculations import validate_payment_amount, calculate_balance_due
from utils.logger import logger
from services.audit_service import log_audit

router = APIRouter(prefix="/api/payments", tags=["Payments"])


def _build_payment_response(payment: Payment) -> PaymentResponse:
    """Build PaymentResponse including transaction status and bill number."""
    txn_status = payment.transaction.status.value if payment.transaction else None
    txn_bill = payment.transaction.bill_number if payment.transaction else None
    mode = payment.payment_mode.value if hasattr(payment.payment_mode, "value") else str(payment.payment_mode)
    return PaymentResponse(
        id=payment.id,
        transaction_id=payment.transaction_id,
        amount=float(payment.amount),
        payment_date=payment.payment_date,
        payment_mode=mode,
        reference_number=payment.reference_number,
        notes=payment.notes,
        created_at=payment.created_at,
        transaction_status=txn_status,
        transaction_bill_number=txn_bill,
    )


@router.post("/", response_model=PaymentResponse, status_code=201)
def create_payment(data: PaymentCreate, db: Session = Depends(get_db)):
    """
    Record a payment to a farmer against a transaction.

    Rules enforced:
    - Cannot pay against a cancelled transaction
    - Cannot pay against a fully paid transaction
    - Payment amount cannot exceed remaining balance (no overpayment)
    - Auto-updates transaction status to PARTIALLY_PAID or FULLY_PAID
    """
    # Get transaction
    txn = db.query(Transaction).filter(Transaction.id == data.transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.status == TransactionStatus.CANCELLED:
        raise HTTPException(
            status_code=400,
            detail="Cannot record payment against a cancelled transaction"
        )

    if txn.status == TransactionStatus.FULLY_PAID:
        raise HTTPException(
            status_code=400,
            detail="Transaction is already fully paid"
        )

    # Validate payment amount
    try:
        validated_amount = validate_payment_amount(data.amount, float(txn.balance_due))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate payment mode enum
    try:
        payment_mode = PaymentMode(data.payment_mode)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment mode: {data.payment_mode}"
        )

    # Create payment record
    payment = Payment(
        transaction_id=data.transaction_id,
        amount=float(validated_amount),
        payment_date=data.payment_date,
        payment_mode=payment_mode,
        reference_number=data.reference_number,
        notes=data.notes,
    )
    db.add(payment)

    # Update transaction totals
    new_total_paid = float(txn.total_paid) + float(validated_amount)
    new_balance = float(txn.net_payable) - new_total_paid

    txn.total_paid = new_total_paid
    txn.balance_due = new_balance

    # Update status
    if new_balance <= 0:
        txn.status = TransactionStatus.FULLY_PAID
        txn.balance_due = 0.00
    else:
        txn.status = TransactionStatus.PARTIALLY_PAID

    db.flush()

    log_audit(
        db=db,
        entity_type="Payment",
        entity_id=payment.id,
        action="CREATE",
        old_values=None,
        new_values={
            "transaction_id": payment.transaction_id,
            "amount": float(payment.amount),
            "payment_date": payment.payment_date,
            "payment_mode": payment.payment_mode.value,
            "reference_number": payment.reference_number,
            "transaction_balance_due": float(txn.balance_due),
            "transaction_status": txn.status.value,
        },
        performed_by="operator",
    )

    db.commit()
    db.refresh(payment)

    logger.info(
        f"Payment recorded: ₹{validated_amount} against {txn.bill_number} "
        f"via {payment_mode.value} | Balance: ₹{txn.balance_due}"
    )

    return _build_payment_response(payment)


@router.get("/transaction/{transaction_id}", response_model=PaymentListResponse)
def list_payments_for_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
):
    """List all payments for a specific transaction."""
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    payments = (
        db.query(Payment)
        .options(joinedload(Payment.transaction))
        .filter(Payment.transaction_id == transaction_id)
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
        .all()
    )

    return PaymentListResponse(
        items=[_build_payment_response(p) for p in payments],
        total=len(payments),
    )


@router.get("/farmer/{farmer_id}", response_model=PaymentListResponse)
def list_payments_for_farmer(
    farmer_id: int,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    exclude_cancelled: bool = Query(False, description="Exclude payments for cancelled transactions"),
    db: Session = Depends(get_db),
):
    """List all payments made to a farmer across all transactions."""
    query = (
        db.query(Payment)
        .join(Transaction)
        .options(joinedload(Payment.transaction))
        .filter(Transaction.farmer_id == farmer_id)
    )

    if exclude_cancelled:
        query = query.filter(Transaction.status != TransactionStatus.CANCELLED)

    if date_from:
        query = query.filter(Payment.payment_date >= date_from)
    if date_to:
        query = query.filter(Payment.payment_date <= date_to)

    payments = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).all()

    return PaymentListResponse(
        items=[_build_payment_response(p) for p in payments],
        total=len(payments),
    )
