"""
AuditLog model - immutable log of all data changes.

Records every create, update, and delete operation with old and new values.
This table is append-only — no UI or API to modify or delete records.
"""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # CREATE, UPDATE, DELETE
    old_values: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    new_values: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    performed_by: Mapped[str] = mapped_column(String(100), default="admin", nullable=False)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog(id={self.id}, entity='{self.entity_type}', "
            f"entity_id={self.entity_id}, action='{self.action}')>"
        )
