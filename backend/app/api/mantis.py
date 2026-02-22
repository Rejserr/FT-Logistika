"""
API endpointi za Mantis WMS SSCC podatke.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db, SessionLocal
from app.db.mantis_session import get_mantis_db, MantisSessionLocal
from app.services.mantis_service import mantis_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------- Schemas ----------

class SyncRequest(BaseModel):
    nalog_uids: list[str] | None = None


class BulkRequest(BaseModel):
    nalog_uids: list[str]


# ---------- Endpoints ----------

@router.post("/mantis/sync")
def sync_wms_data(
    payload: SyncRequest | None = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Pokreni WMS sync.  Ako su navedeni nalog_uids, sincaju se samo ti nalozi.
    Inače se sinc svi nalozi u statusu 103 / 30.
    """
    if MantisSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mantis WMS konekcija nije konfigurirana",
        )

    uids = payload.nalog_uids if payload else None

    # Sync u pozadini tako da ne blokira response
    def _run_sync():
        with SessionLocal() as local_db, MantisSessionLocal() as wms_db:
            try:
                mantis_service.sync_orders_from_wms(local_db, wms_db, nalog_uids=uids)
            except Exception as exc:
                logger.error("Background WMS sync greška: %s", exc)

    if background_tasks is not None:
        background_tasks.add_task(_run_sync)
        return {"status": "started", "message": "WMS sync pokrenut u pozadini"}

    # Fallback: sinkroni sync
    with MantisSessionLocal() as wms_db:
        stats = mantis_service.sync_orders_from_wms(db, wms_db, nalog_uids=uids)
    return {"status": "completed", **stats}


@router.get("/mantis/order/{nalog_uid}")
def get_mantis_order(
    nalog_uid: str,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Dohvati SSCC podatke za jedan nalog.
    Implementira lazy refresh — ako su podaci stari, automatski ih osvježava.
    """
    mantis_db = None
    if MantisSessionLocal is not None:
        mantis_db = MantisSessionLocal()

    try:
        result = mantis_service.get_sscc_for_order(
            db,
            nalog_uid,
            mantis_db=mantis_db,
            force_refresh=force_refresh,
        )
        return result
    finally:
        if mantis_db is not None:
            mantis_db.close()


@router.post("/mantis/orders/bulk")
def get_mantis_orders_bulk(
    payload: BulkRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Bulk dohvat SSCC sažetaka za više naloga (npr. za RoutingPage).
    Automatski sincira naloge koji nemaju cache ili im je cache star."""
    mantis_db = None
    if MantisSessionLocal is not None:
        mantis_db = MantisSessionLocal()
    try:
        return mantis_service.get_sscc_summary_for_orders(
            db, payload.nalog_uids, mantis_db=mantis_db,
        )
    finally:
        if mantis_db is not None:
            mantis_db.close()


@router.get("/mantis/route/{ruta_id}/pallets")
def get_route_pallets(
    ruta_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Dohvati ukupan broj paleta (WMS) za rutu."""
    return mantis_service.get_pallet_count_for_route(db, ruta_id)
