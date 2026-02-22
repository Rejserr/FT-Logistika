"""API endpoints za upravljanje skladištima."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit_log
from app.core.deps import get_current_active_user
from app.core.logging_config import correlation_id_var
from app.core.warehouse_scope import is_admin
from app.db.session import get_db
from app.models.erp_models import Skladiste
from app.models.user_models import User

router = APIRouter(prefix="/warehouses")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class WarehouseOut(BaseModel):
    id: int
    code: str | None = None
    naziv: str
    adresa: str | None = None
    mjesto: str | None = None
    postanski_broj: str | None = None
    drzava: str | None = None
    lat: float | None = None
    lng: float | None = None
    tip: str
    is_central: bool = False
    radno_vrijeme_od: str | None = None
    radno_vrijeme_do: str | None = None
    kontakt_telefon: str | None = None
    kontakt_email: str | None = None
    max_vozila: int | None = None
    aktivan: bool = True

    class Config:
        from_attributes = True


class WarehouseCreate(BaseModel):
    code: str | None = None
    naziv: str
    adresa: str | None = None
    mjesto: str | None = None
    postanski_broj: str | None = None
    drzava: str | None = None
    lat: float | None = None
    lng: float | None = None
    tip: str = "store"
    is_central: bool = False
    radno_vrijeme_od: str | None = None
    radno_vrijeme_do: str | None = None
    kontakt_telefon: str | None = None
    kontakt_email: str | None = None
    max_vozila: int | None = None


class WarehouseUpdate(BaseModel):
    code: str | None = None
    naziv: str | None = None
    adresa: str | None = None
    mjesto: str | None = None
    postanski_broj: str | None = None
    drzava: str | None = None
    lat: float | None = None
    lng: float | None = None
    tip: str | None = None
    is_central: bool | None = None
    radno_vrijeme_od: str | None = None
    radno_vrijeme_do: str | None = None
    kontakt_telefon: str | None = None
    kontakt_email: str | None = None
    max_vozila: int | None = None
    aktivan: bool | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[WarehouseOut])
def list_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[WarehouseOut]:
    query = select(Skladiste).order_by(Skladiste.naziv)
    if not is_admin(current_user) and current_user.warehouse_id:
        query = query.where(Skladiste.id == current_user.warehouse_id)
    whs = db.execute(query).scalars().all()
    return [WarehouseOut.model_validate(w) for w in whs]


@router.get("/{wh_id}", response_model=WarehouseOut)
def get_warehouse(wh_id: int, db: Session = Depends(get_db)) -> WarehouseOut:
    wh = db.get(Skladiste, wh_id)
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skladište nije pronađeno.")
    return WarehouseOut.model_validate(wh)


@router.post("", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> WarehouseOut:
    if payload.code:
        existing = db.execute(select(Skladiste).where(Skladiste.code == payload.code)).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Skladište s kodom '{payload.code}' već postoji.")
    wh = Skladiste(**payload.model_dump())
    db.add(wh)
    db.flush()
    audit_log(
        db, current_user, "CREATE", "Warehouse", str(wh.id),
        new_values={"naziv": wh.naziv, "code": wh.code},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(wh)
    return WarehouseOut.model_validate(wh)


@router.put("/{wh_id}", response_model=WarehouseOut)
def update_warehouse(
    wh_id: int, payload: WarehouseUpdate, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> WarehouseOut:
    wh = db.get(Skladiste, wh_id)
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skladište nije pronađeno.")
    data = payload.model_dump(exclude_unset=True)
    old_vals = {k: getattr(wh, k) for k in data}
    for field, value in data.items():
        setattr(wh, field, value)
    audit_log(
        db, current_user, "UPDATE", "Warehouse", str(wh.id),
        old_values=old_vals, new_values=data,
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(wh)
    return WarehouseOut.model_validate(wh)


@router.delete("/{wh_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(
    wh_id: int, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    wh = db.get(Skladiste, wh_id)
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skladište nije pronađeno.")
    wh.aktivan = False
    audit_log(
        db, current_user, "DEACTIVATE", "Warehouse", str(wh.id),
        old_values={"aktivan": True}, new_values={"aktivan": False},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
