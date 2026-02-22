"""Audit logging helper — records all changes to the audit_log table."""

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.user_models import AuditLog, User

logger = logging.getLogger(__name__)


def audit_log(
    db: Session,
    user: User | None,
    action: str,
    entity: str,
    entity_id: str | None = None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    warehouse_id: int | None = None,
    correlation_id: str | None = None,
) -> AuditLog:
    """Create an audit log entry."""
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id else None,
        old_values=json.dumps(old_values, default=str, ensure_ascii=False) if old_values else None,
        new_values=json.dumps(new_values, default=str, ensure_ascii=False) if new_values else None,
        ip_address=ip_address,
        user_agent=user_agent,
        warehouse_id=warehouse_id or (user.warehouse_id if user else None),
        correlation_id=correlation_id,
    )
    db.add(entry)
    return entry


def diff_values(old_obj: Any, new_data: dict[str, Any], fields: list[str] | None = None) -> tuple[dict, dict]:
    """Compare old object attributes with new data dict and return (old_values, new_values) dicts."""
    old_vals: dict[str, Any] = {}
    new_vals: dict[str, Any] = {}
    check_fields = fields or list(new_data.keys())
    for key in check_fields:
        if key not in new_data:
            continue
        old_val = getattr(old_obj, key, None)
        new_val = new_data[key]
        if str(old_val) != str(new_val):
            old_vals[key] = old_val
            new_vals[key] = new_val
    return old_vals, new_vals
