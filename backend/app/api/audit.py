"""API endpoints za audit log — pregled promjena u sustavu."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user_models import AuditLog, User

router = APIRouter(prefix="/audit")


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None = None
    username: str | None = None
    action: str
    entity: str | None = None
    entity_id: str | None = None
    old_values: str | None = None
    new_values: str | None = None
    ip_address: str | None = None
    warehouse_id: int | None = None
    correlation_id: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    user_id: int | None = Query(default=None),
    action: str | None = Query(default=None),
    entity: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[AuditLogOut]:
    query = (
        select(AuditLog, User.username.label("username"))
        .outerjoin(User, AuditLog.user_id == User.id)
    )

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity:
        query = query.where(AuditLog.entity.ilike(f"%{entity}%"))
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at <= date_to + timedelta(days=1))

    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    rows = db.execute(query).all()

    return [
        AuditLogOut(
            id=log.id,
            user_id=log.user_id,
            username=uname,
            action=log.action,
            entity=log.entity,
            entity_id=log.entity_id,
            old_values=log.old_values,
            new_values=log.new_values,
            ip_address=log.ip_address,
            warehouse_id=log.warehouse_id,
            correlation_id=log.correlation_id,
            created_at=str(log.created_at) if log.created_at else None,
        )
        for log, uname in rows
    ]


@router.get("/stats")
def audit_stats(db: Session = Depends(get_db)) -> dict:
    total = db.execute(select(func.count(AuditLog.id))).scalar() or 0
    today = db.execute(
        select(func.count(AuditLog.id)).where(
            func.cast(AuditLog.created_at, func.date()) == date.today()  # type: ignore
        )
    ).scalar() or 0
    return {"total": total, "today": today}
