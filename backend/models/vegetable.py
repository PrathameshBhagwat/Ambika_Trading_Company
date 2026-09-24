"""
Vegetable model - master list of vegetables traded.

Vegetables are soft-deleted to preserve transaction history references.
Supports both local (Marathi/Hindi) and English names.
"""

from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Vegetable(Base):
    __tablename__ = "vegetables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_local: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    name_english: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    transaction_items: Mapped[list["TransactionItem"]] = relationship(
        "TransactionItem", back_populates="vegetable", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Vegetable(id={self.id}, name='{self.name_local}')>"
