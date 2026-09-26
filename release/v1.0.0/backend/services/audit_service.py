"""
Audit logging service for tracking all database mutations.
Append-only, immutable audit trail.
"""

import json
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from sqlalchemy.orm import Session

from models.audit_log import AuditLog
from utils.logger import logger


class AuditJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for audit values."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, Enum):
            return obj.value
        return super().default(obj)


def serialize_values(values: dict[str, Any] | None) -> str | None:
    """Serialize a dictionary of values to JSON, safely ignoring None."""
    if values is None:
        return None
    try:
        return json.dumps(values, cls=AuditJSONEncoder, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Failed to serialize audit values: {e}")
        return json.dumps({"raw": str(values)}, ensure_ascii=False)


def log_audit(
    db: Session,
    entity_type: str,
    entity_id: int,
    action: str,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    performed_by: str = "operator",
) -> AuditLog:
    """
    Create and append an AuditLog record in the current database session.

    Args:
        db: Active SQLAlchemy Session
        entity_type: e.g. "Farmer", "Vegetable", "Transaction", "Payment"
        entity_id: Primary key of the entity
        action: e.g. "CREATE", "UPDATE", "DELETE", "CANCEL", "RESTORE"
        old_values: State before mutation (dict)
        new_values: State after mutation (dict)
        performed_by: User or operator identifier

    Returns:
        The instantiated AuditLog record added to db
    """
    audit = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action.upper(),
        old_values=serialize_values(old_values),
        new_values=serialize_values(new_values),
        performed_by=performed_by,
        performed_at=datetime.utcnow(),
    )
    db.add(audit)
    return audit
