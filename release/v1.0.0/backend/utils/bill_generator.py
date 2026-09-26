"""
Ambika Trading - Bill Number Generator

Generates unique sequential bill numbers in the format: AT-YYYYMMDD-XXXX
where XXXX is a zero-padded daily sequence starting from 0001.
"""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from config import settings


def generate_bill_number(db: Session, transaction_date: date) -> str:
    """
    Generate the next sequential bill number for a given date.

    Format: AT-YYYYMMDD-XXXX

    Args:
        db: Database session
        transaction_date: The date of the transaction

    Returns:
        A unique bill number string
    """
    from models.transaction import Transaction

    date_str = transaction_date.strftime("%Y%m%d")
    prefix = f"{settings.BILL_NUMBER_PREFIX}-{date_str}-"

    # Find the highest sequence number for this date
    last_bill = (
        db.query(Transaction.bill_number)
        .filter(Transaction.bill_number.like(f"{prefix}%"))
        .order_by(Transaction.bill_number.desc())
        .first()
    )

    if last_bill:
        # Extract the sequence number from the last bill number
        last_seq = int(last_bill[0].split("-")[-1])
        next_seq = last_seq + 1
    else:
        next_seq = 1

    return f"{prefix}{next_seq:04d}"
