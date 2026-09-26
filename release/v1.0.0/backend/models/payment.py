"""
Payment model - records payments made to farmers against transactions.

Payments are append-only (immutable once saved). Supports partial payments.
Payment modes: Cash, Bank Transfer, UPI, Cheque.
"""

import enum
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, Integer, Numeric, Text, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PaymentMode(str, enum.Enum):
    """Supported payment modes."""
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    CHEQUE = "cheque"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_mode: Mapped[PaymentMode] = mapped_column(
        Enum(PaymentMode), nullable=False
    )
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps (no updated_at — payments are immutable)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    transaction: Mapped["Transaction"] = relationship(
        "Transaction", back_populates="payments", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Payment(id={self.id}, txn_id={self.transaction_id}, "
            f"amount={self.amount}, mode='{self.payment_mode.value}')>"
        )
