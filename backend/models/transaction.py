"""
Transaction model - a single farmer settlement event.

Represents one visit by a farmer, identified by a unique bill number.
Contains computed totals: gross_amount, total_deductions, net_payable.
Tracks payment status: total_paid, balance_due, and lifecycle status.
"""

import enum
from datetime import datetime, date
from sqlalchemy import (
    String, Date, DateTime, Integer, Numeric, Text, Enum, ForeignKey
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class TransactionStatus(str, enum.Enum):
    """Lifecycle states of a transaction."""
    DRAFT = "draft"
    SAVED = "saved"
    PARTIALLY_PAID = "partially_paid"
    FULLY_PAID = "fully_paid"
    CANCELLED = "cancelled"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bill_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    farmer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("farmers.id"), nullable=False, index=True
    )

    # Computed totals (stored for performance and audit trail)
    gross_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    net_payable: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance_due: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Status
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus), default=TransactionStatus.DRAFT, nullable=False, index=True
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    print_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="transactions", lazy="select")
    items: Mapped[list["TransactionItem"]] = relationship(
        "TransactionItem", back_populates="transaction",
        cascade="all, delete-orphan", lazy="select"
    )
    deduction: Mapped["Deduction | None"] = relationship(
        "Deduction", back_populates="transaction",
        uselist=False, cascade="all, delete-orphan", lazy="select"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="transaction", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Transaction(id={self.id}, bill='{self.bill_number}', "
            f"farmer_id={self.farmer_id}, status='{self.status.value}')>"
        )
