"""
Audit Log API router - view-only access to the immutable audit trail.
"""

from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from database import get_db
from models.audit_log import AuditLog

router = APIRouter(prefix="/api/audit", tags=["Audit"])


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_id: int
    action: str
    old_values: str | None
    new_values: str | None
    performed_by: str
    performed_at: str


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int


@router.get("/", response_model=AuditLogListResponse)
def list_audit_logs(
    entity_type: str | None = Query(None, description="Filter by entity type"),
    entity_id: int | None = Query(None, description="Filter by entity ID"),
    action: str | None = Query(None, description="Filter by action (CREATE, UPDATE, DELETE)"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    List audit log entries. Read-only — no create/update/delete endpoints.
    Audit records are created internally by service layer operations.
    """
    query = db.query(AuditLog)

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditLog.entity_id == entity_id)
    if action:
        query = query.filter(AuditLog.action == action.upper())
    if date_from:
        query = query.filter(AuditLog.performed_at >= str(date_from))
    if date_to:
        query = query.filter(AuditLog.performed_at <= str(date_to) + "T23:59:59")

    total = query.count()
    logs = (
        query.order_by(AuditLog.performed_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    items = []
    for log in logs:
        items.append(AuditLogResponse(
            id=log.id,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            action=log.action,
            old_values=log.old_values,
            new_values=log.new_values,
            performed_by=log.performed_by,
            performed_at=log.performed_at.isoformat() if log.performed_at else "",
        ))

    return AuditLogListResponse(items=items, total=total)
