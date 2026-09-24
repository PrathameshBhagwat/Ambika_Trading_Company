"""
Deduction model - deductions applied to a farmer transaction.

Each transaction has exactly one deduction record. Individual deduction fields
default to 0.00. Total deductions is the sum of all fields.

Deduction types (regional trade terms):
  - Hamali:      Loading/unloading labor charge
  - Bharai:      Bag filling/packing charge
  - Tolai:       Weighing charge
  - Mapai:       Measurement/counting charge
  - Lekki:       Commission / brokerage charge
  - Motor Bhada: Transportation / vehicle charge
  - Other:       Miscellaneous (with optional note)
"""

from datetime import datetime
from sqlalchemy import Integer, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Deduction(Base):
    __tablename__ = "deductions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id"), unique=True, nullable=False
    )

    # Individual deduction fields (all default to 0.00)
    hamali: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    bharai: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    tolai: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    mapai: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    lekki: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    motor_bhada: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    other_deductions: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    other_deductions_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Computed total
    total_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    transaction: Mapped["Transaction"] = relationship(
        "Transaction", back_populates="deduction", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Deduction(id={self.id}, txn_id={self.transaction_id}, total={self.total_deductions})>"
