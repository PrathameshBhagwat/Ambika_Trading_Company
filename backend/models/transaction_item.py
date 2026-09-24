"""
TransactionItem model - a single vegetable line item within a transaction.

Each item records: vegetable, bags count, weight in KG, rate per 10 KG,
and the computed item_amount = (weight_kg / 10) × rate_per_10kg.
"""

from datetime import datetime
from sqlalchemy import Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id"), nullable=False, index=True
    )
    vegetable_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("vegetables.id"), nullable=False
    )
    bags_count: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    rate_per_10kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    item_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    transaction: Mapped["Transaction"] = relationship(
        "Transaction", back_populates="items", lazy="select"
    )
    vegetable: Mapped["Vegetable"] = relationship(
        "Vegetable", back_populates="transaction_items", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<TransactionItem(id={self.id}, veg_id={self.vegetable_id}, "
            f"weight={self.weight_kg}kg, amount={self.item_amount})>"
        )
