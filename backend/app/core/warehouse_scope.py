"""Warehouse data scoping — automatic filtering by user's warehouse assignment."""

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.erp_models import Skladiste
from app.models.user_models import User


def is_admin(user: User) -> bool:
    """Check if user has Admin role (sees everything, no filters)."""
    return bool(user.role and user.role.name == "Admin")


def get_user_warehouse(db: Session, user: User) -> Skladiste | None:
    """Returns the warehouse assigned to a user, or None."""
    if not user.warehouse_id:
        return None
    return db.get(Skladiste, user.warehouse_id)


def get_warehouse_codes(db: Session, user: User) -> list[str] | None:
    """
    Returns list of warehouse codes the user can access, or None if admin (no filter).
    """
    if is_admin(user):
        return None

    wh = get_user_warehouse(db, user)
    if not wh or not wh.code:
        return []

    return [wh.code]


def apply_warehouse_filter(query, model, user: User, db: Session):
    """
    Apply warehouse filter to a SQLAlchemy query based on user's role.
    
    For NalogHeader / NalogHeaderRutiranje:
        WHERE sa__skladiste = warehouse.code OR (sa__skladiste IS NULL/empty AND skladiste = warehouse.code)
    
    Admin: no filter applied.
    """
    codes = get_warehouse_codes(db, user)
    if codes is None:
        return query  # Admin

    if not codes:
        return query.where(model.nalog_prodaje_uid == "__NO_ACCESS__")

    sa_skl = getattr(model, "sa__skladiste", None)
    skl = getattr(model, "skladiste", None)

    if sa_skl is not None and skl is not None:
        return query.where(
            or_(
                sa_skl.in_(codes),
                (sa_skl.is_(None) | (sa_skl == "")) & skl.in_(codes),
            )
        )
    elif skl is not None:
        return query.where(skl.in_(codes))

    return query
