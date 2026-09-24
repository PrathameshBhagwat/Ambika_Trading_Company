"""
Transactions API router - complete transaction lifecycle management.

Handles: create, view, list, update, cancel.
All amounts are computed server-side using the calculations module.
"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.farmer import Farmer
from models.vegetable import Vegetable
from models.transaction import Transaction, TransactionStatus
from models.transaction_item import TransactionItem
from models.deduction import Deduction
from schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionCancelRequest,
    TransactionResponse,
    TransactionListItem,
    TransactionListResponse,
    TransactionItemResponse,
    DeductionResponse,
)
from utils.calculations import (
    calculate_item_amount,
    calculate_gross_amount,
    calculate_total_deductions,
    calculate_net_payable,
)
from utils.bill_generator import generate_bill_number
from utils.logger import logger
from services.audit_service import log_audit

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def _build_transaction_response(txn: Transaction) -> TransactionResponse:
    """Build a full TransactionResponse from an ORM model with eager-loaded relations."""
    items = []
    for item in txn.items:
        veg_name = item.vegetable.name_local if item.vegetable else None
        items.append(TransactionItemResponse(
            id=item.id,
            vegetable_id=item.vegetable_id,
            vegetable_name=veg_name,
            bags_count=item.bags_count,
            weight_kg=float(item.weight_kg),
            rate_per_10kg=float(item.rate_per_10kg),
            item_amount=float(item.item_amount),
        ))

    deduction_resp = None
    if txn.deduction:
        deduction_resp = DeductionResponse.model_validate(txn.deduction)

    farmer_name = txn.farmer.name if txn.farmer else None
    farmer_mobile = txn.farmer.mobile if txn.farmer else None
    farmer_village = txn.farmer.village if txn.farmer else None

    return TransactionResponse(
        id=txn.id,
        bill_number=txn.bill_number,
        transaction_date=txn.transaction_date,
        farmer_id=txn.farmer_id,
        farmer_name=farmer_name,
        farmer_mobile=farmer_mobile,
        farmer_village=farmer_village,
        gross_amount=float(txn.gross_amount),
        total_deductions=float(txn.total_deductions),
        net_payable=float(txn.net_payable),
        total_paid=float(txn.total_paid),
        balance_due=float(txn.balance_due),
        status=txn.status.value,
        cancel_reason=txn.cancel_reason,
        print_count=getattr(txn, "print_count", 0) or 0,
        items=items,
        deduction=deduction_resp,
        created_at=txn.created_at,
        updated_at=txn.updated_at,
    )


@router.get("/", response_model=TransactionListResponse)
def list_transactions(
    date_from: date | None = Query(None, description="Filter from date"),
    date_to: date | None = Query(None, description="Filter to date"),
    farmer_id: int | None = Query(None, description="Filter by farmer"),
    status: str | None = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List transactions with filters and pagination."""
    query = db.query(Transaction).options(joinedload(Transaction.farmer))

    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)
    if farmer_id:
        query = query.filter(Transaction.farmer_id == farmer_id)
    if status:
        try:
            status_enum = TransactionStatus(status)
            query = query.filter(Transaction.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    total = query.count()
    transactions = (
        query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    items = []
    for txn in transactions:
        farmer_name = txn.farmer.name if txn.farmer else None
        farmer_mobile = txn.farmer.mobile if txn.farmer else None
        farmer_village = txn.farmer.village if txn.farmer else None
        items.append(TransactionListItem(
            id=txn.id,
            bill_number=txn.bill_number,
            transaction_date=txn.transaction_date,
            farmer_id=txn.farmer_id,
            farmer_name=farmer_name,
            farmer_mobile=farmer_mobile,
            farmer_village=farmer_village,
            gross_amount=float(txn.gross_amount),
            total_deductions=float(txn.total_deductions),
            net_payable=float(txn.net_payable),
            total_paid=float(txn.total_paid),
            balance_due=float(txn.balance_due),
            status=txn.status.value,
            print_count=getattr(txn, "print_count", 0) or 0,
            created_at=txn.created_at,
        ))

    return TransactionListResponse(items=items, total=total)


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Get full transaction details by ID."""
    txn = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.farmer),
            joinedload(Transaction.items).joinedload(TransactionItem.vegetable),
            joinedload(Transaction.deduction),
        )
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return _build_transaction_response(txn)


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    """
    Create a new farmer settlement transaction.

    The system:
    1. Validates farmer and vegetables exist
    2. Calculates each item amount: (weight_kg / 10) × rate_per_10kg
    3. Calculates gross amount: sum of all item amounts
    4. Calculates total deductions
    5. Calculates net payable: gross - deductions (ALWAYS subtracted)
    6. Generates a unique bill number
    7. Saves the complete transaction
    """
    # Validate farmer exists
    farmer = db.query(Farmer).filter(Farmer.id == data.farmer_id, Farmer.is_active == True).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found or inactive")

    # Validate all vegetables exist
    veg_ids = [item.vegetable_id for item in data.items]
    existing_vegs = db.query(Vegetable.id).filter(Vegetable.id.in_(veg_ids)).all()
    existing_veg_ids = {v[0] for v in existing_vegs}
    missing = set(veg_ids) - existing_veg_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Vegetable(s) not found: {missing}")

    # Calculate item amounts
    item_amounts = []
    transaction_items = []
    for item_data in data.items:
        amount = calculate_item_amount(item_data.weight_kg, item_data.rate_per_10kg)
        item_amounts.append(amount)
        transaction_items.append(TransactionItem(
            vegetable_id=item_data.vegetable_id,
            bags_count=item_data.bags_count,
            weight_kg=item_data.weight_kg,
            rate_per_10kg=item_data.rate_per_10kg,
            item_amount=float(amount),
        ))

    # Calculate totals
    gross = calculate_gross_amount(item_amounts)
    total_ded = calculate_total_deductions(
        hamali=data.deductions.hamali,
        bharai=data.deductions.bharai,
        tolai=data.deductions.tolai,
        mapai=data.deductions.mapai,
        lekki=data.deductions.lekki,
        motor_bhada=data.deductions.motor_bhada,
        other_deductions=data.deductions.other_deductions,
    )

    try:
        net = calculate_net_payable(gross, total_ded)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate bill number
    bill_number = generate_bill_number(db, data.transaction_date)

    # Create transaction
    txn = Transaction(
        bill_number=bill_number,
        transaction_date=data.transaction_date,
        farmer_id=data.farmer_id,
        gross_amount=float(gross),
        total_deductions=float(total_ded),
        net_payable=float(net),
        total_paid=0.00,
        balance_due=float(net),
        status=TransactionStatus.SAVED,
    )
    db.add(txn)
    db.flush()  # Get the transaction ID

    # Add items
    for item in transaction_items:
        item.transaction_id = txn.id
        db.add(item)

    # Add deductions record
    deduction = Deduction(
        transaction_id=txn.id,
        hamali=data.deductions.hamali,
        bharai=data.deductions.bharai,
        tolai=data.deductions.tolai,
        mapai=data.deductions.mapai,
        lekki=data.deductions.lekki,
        motor_bhada=data.deductions.motor_bhada,
        other_deductions=data.deductions.other_deductions,
        other_deductions_note=data.deductions.other_deductions_note,
        total_deductions=float(total_ded),
    )
    db.add(deduction)

    log_audit(
        db=db,
        entity_type="Transaction",
        entity_id=txn.id,
        action="CREATE",
        old_values=None,
        new_values={
            "bill_number": txn.bill_number,
            "farmer_id": txn.farmer_id,
            "transaction_date": txn.transaction_date,
            "gross_amount": float(txn.gross_amount),
            "total_deductions": float(txn.total_deductions),
            "net_payable": float(txn.net_payable),
            "items_count": len(transaction_items),
        },
        performed_by="operator",
    )

    db.commit()
    db.refresh(txn)

    logger.info(f"Created transaction {bill_number} for farmer {farmer.name} | Net: {net}")

    # Reload with relations
    txn = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.farmer),
            joinedload(Transaction.items).joinedload(TransactionItem.vegetable),
            joinedload(Transaction.deduction),
        )
        .filter(Transaction.id == txn.id)
        .first()
    )

    return _build_transaction_response(txn)


@router.post("/{transaction_id}/cancel", response_model=TransactionResponse)
def cancel_transaction(
    transaction_id: int,
    data: TransactionCancelRequest,
    db: Session = Depends(get_db),
):
    """
    Cancel a transaction. Requires a mandatory reason.
    Cancelled transactions cannot be edited or receive payments.
    """
    txn = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.farmer),
            joinedload(Transaction.items).joinedload(TransactionItem.vegetable),
            joinedload(Transaction.deduction),
        )
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.status == TransactionStatus.FULLY_PAID:
        raise HTTPException(status_code=400, detail="Cannot cancel a fully paid transaction")

    if txn.status == TransactionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Transaction is already cancelled")

    old_status = txn.status.value
    txn.status = TransactionStatus.CANCELLED
    txn.cancel_reason = data.cancel_reason

    log_audit(
        db=db,
        entity_type="Transaction",
        entity_id=txn.id,
        action="CANCEL",
        old_values={"status": old_status},
        new_values={"status": txn.status.value, "cancel_reason": data.cancel_reason},
        performed_by="operator",
    )

    db.commit()
    db.refresh(txn)

    logger.info(f"Cancelled transaction {txn.bill_number}: {data.cancel_reason}")

    return _build_transaction_response(txn)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
):
    """
    Update an existing transaction (FR-TX-10).
    Only permitted when transaction status is SAVED (unpaid).
    Rejected if PARTIALLY_PAID, FULLY_PAID, or CANCELLED.
    Bill number is preserved.
    All financial totals are recalculated server-side.
    Creates an UPDATE audit log entry.
    """
    txn = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.farmer),
            joinedload(Transaction.items).joinedload(TransactionItem.vegetable),
            joinedload(Transaction.deduction),
        )
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.status == TransactionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot edit a cancelled transaction")
    if txn.status == TransactionStatus.FULLY_PAID:
        raise HTTPException(status_code=400, detail="Cannot edit a fully paid transaction")
    if txn.status == TransactionStatus.PARTIALLY_PAID:
        raise HTTPException(status_code=400, detail="Cannot edit a partially paid transaction")
    if float(txn.total_paid) > 0:
        raise HTTPException(status_code=400, detail="Cannot edit a transaction with payments recorded")

    # Capture old values for audit
    old_values = {
        "bill_number": txn.bill_number,
        "farmer_id": txn.farmer_id,
        "transaction_date": str(txn.transaction_date),
        "gross_amount": float(txn.gross_amount),
        "total_deductions": float(txn.total_deductions),
        "net_payable": float(txn.net_payable),
        "items": [
            {
                "vegetable_id": item.vegetable_id,
                "bags_count": item.bags_count,
                "weight_kg": float(item.weight_kg),
                "rate_per_10kg": float(item.rate_per_10kg),
                "item_amount": float(item.item_amount),
            }
            for item in txn.items
        ],
        "deductions": {
            "hamali": float(txn.deduction.hamali),
            "bharai": float(txn.deduction.bharai),
            "tolai": float(txn.deduction.tolai),
            "mapai": float(txn.deduction.mapai),
            "lekki": float(txn.deduction.lekki),
            "motor_bhada": float(txn.deduction.motor_bhada),
            "other_deductions": float(txn.deduction.other_deductions),
            "other_deductions_note": txn.deduction.other_deductions_note,
        } if txn.deduction else None,
    }

    # Update farmer if specified
    if data.farmer_id is not None and data.farmer_id != txn.farmer_id:
        farmer = db.query(Farmer).filter(Farmer.id == data.farmer_id, Farmer.is_active == True).first()
        if not farmer:
            raise HTTPException(status_code=404, detail="Farmer not found or inactive")
        txn.farmer_id = data.farmer_id

    # Update date if specified
    if data.transaction_date is not None:
        if data.transaction_date > date.today():
            raise HTTPException(status_code=400, detail="Transaction date cannot be in the future")
        txn.transaction_date = data.transaction_date

    # Update items and recalculate gross
    if data.items is not None:
        if len(data.items) == 0:
            raise HTTPException(status_code=400, detail="Transaction must have at least one vegetable item")

        veg_ids = [item.vegetable_id for item in data.items]
        existing_vegs = db.query(Vegetable.id).filter(Vegetable.id.in_(veg_ids)).all()
        existing_veg_ids = {v[0] for v in existing_vegs}
        missing = set(veg_ids) - existing_veg_ids
        if missing:
            raise HTTPException(status_code=404, detail=f"Vegetable(s) not found: {missing}")

        # Delete existing items
        db.query(TransactionItem).filter(TransactionItem.transaction_id == txn.id).delete()

        item_amounts = []
        for item_data in data.items:
            amount = calculate_item_amount(item_data.weight_kg, item_data.rate_per_10kg)
            item_amounts.append(amount)
            db.add(TransactionItem(
                transaction_id=txn.id,
                vegetable_id=item_data.vegetable_id,
                bags_count=item_data.bags_count,
                weight_kg=item_data.weight_kg,
                rate_per_10kg=item_data.rate_per_10kg,
                item_amount=float(amount),
            ))
        gross = calculate_gross_amount(item_amounts)
        txn.gross_amount = float(gross)
    else:
        gross = float(txn.gross_amount)

    # Update deductions
    if data.deductions is not None:
        total_ded = calculate_total_deductions(
            hamali=data.deductions.hamali,
            bharai=data.deductions.bharai,
            tolai=data.deductions.tolai,
            mapai=data.deductions.mapai,
            lekki=data.deductions.lekki,
            motor_bhada=data.deductions.motor_bhada,
            other_deductions=data.deductions.other_deductions,
        )
        if txn.deduction:
            txn.deduction.hamali = data.deductions.hamali
            txn.deduction.bharai = data.deductions.bharai
            txn.deduction.tolai = data.deductions.tolai
            txn.deduction.mapai = data.deductions.mapai
            txn.deduction.lekki = data.deductions.lekki
            txn.deduction.motor_bhada = data.deductions.motor_bhada
            txn.deduction.other_deductions = data.deductions.other_deductions
            txn.deduction.other_deductions_note = data.deductions.other_deductions_note
            txn.deduction.total_deductions = float(total_ded)
        else:
            deduction = Deduction(
                transaction_id=txn.id,
                hamali=data.deductions.hamali,
                bharai=data.deductions.bharai,
                tolai=data.deductions.tolai,
                mapai=data.deductions.mapai,
                lekki=data.deductions.lekki,
                motor_bhada=data.deductions.motor_bhada,
                other_deductions=data.deductions.other_deductions,
                other_deductions_note=data.deductions.other_deductions_note,
                total_deductions=float(total_ded),
            )
            db.add(deduction)
        txn.total_deductions = float(total_ded)
    else:
        total_ded = float(txn.total_deductions)

    # Server-side net payable calculation
    try:
        net = calculate_net_payable(gross, total_ded)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    txn.net_payable = float(net)
    txn.balance_due = float(net)  # Unpaid, total_paid is 0

    new_values = {
        "bill_number": txn.bill_number,
        "farmer_id": txn.farmer_id,
        "transaction_date": str(txn.transaction_date),
        "gross_amount": float(txn.gross_amount),
        "total_deductions": float(txn.total_deductions),
        "net_payable": float(txn.net_payable),
    }

    log_audit(
        db=db,
        entity_type="Transaction",
        entity_id=txn.id,
        action="UPDATE",
        old_values=old_values,
        new_values=new_values,
        performed_by="operator",
    )

    db.commit()
    db.refresh(txn)

    logger.info(f"Updated transaction {txn.bill_number}: Net {txn.net_payable}")

    # Reload with relations
    txn = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.farmer),
            joinedload(Transaction.items).joinedload(TransactionItem.vegetable),
            joinedload(Transaction.deduction),
        )
        .filter(Transaction.id == txn.id)
        .first()
    )

    return _build_transaction_response(txn)


@router.post("/{transaction_id}/print", response_model=TransactionResponse)
def record_transaction_print(transaction_id: int, db: Session = Depends(get_db)):
    """
    Record that a transaction bill was printed.
    Increments print_count. First print -> 1, Subsequent prints -> >= 2 (Duplicate watermark).
    """
    txn = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.farmer),
            joinedload(Transaction.items).joinedload(TransactionItem.vegetable),
            joinedload(Transaction.deduction),
        )
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn.print_count = (getattr(txn, "print_count", 0) or 0) + 1
    db.commit()
    db.refresh(txn)

    logger.info(f"Transaction {txn.bill_number} printed (print_count={txn.print_count})")
    return _build_transaction_response(txn)
