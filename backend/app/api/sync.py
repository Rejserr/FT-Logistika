"""
Sync API endpointi.

Pokreću async ERP sinkronizaciju u backgroundu (fire-and-forget).
"""
import asyncio
import logging
from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from sqlalchemy import select

from app.db.session import get_db
from app.models.config_models import Setting, SyncStatus
from app.models.sync_models import SyncLog
from app.schemas.sync import RefreshOrdersRequest, SyncByRasporedRequest, SyncOrdersRequest, SyncResponse
from app.services.sync_service import (
    refresh_orders as do_refresh_orders,
    sync_artikli as do_sync_artikli,
    sync_orders as do_sync_orders,
    sync_orders_by_raspored as do_sync_by_raspored,
    sync_partners as do_sync_partners,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _run_async(coro):
    """Helper za pokretanje async funkcije u novom event loopu (background task)."""
    import sys as _sys
    print(f"[_run_async] Pokrećem background task (platform={_sys.platform})", flush=True)
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(coro)
        finally:
            loop.close()
    except Exception as exc:
        print(f"[_run_async] GREŠKA: {exc}", flush=True)
        logger.exception("Background sync task error: %s", exc)


def _get_active_sync_statusi(db: Session) -> list[str]:
    """Dohvati aktivne statuse za sinkronizaciju iz tablice sync_statusi."""
    rows = db.execute(
        select(SyncStatus.status_id).where(SyncStatus.aktivan == True)
    ).scalars().all()
    return list(rows) if rows else ["08", "101", "102", "103"]


def _get_sync_require_raspored(db: Session) -> bool:
    """Provjeri da li je uključen filter po rasporedu."""
    row = db.execute(
        select(Setting.value).where(Setting.key == "SYNC_REQUIRE_RASPORED")
    ).scalar_one_or_none()
    return row is not None and row.lower() in ("1", "true", "da")


@router.post("/sync/orders", response_model=SyncResponse, status_code=status.HTTP_202_ACCEPTED)
def sync_orders_endpoint(
    payload: SyncOrdersRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    Pokreće sinkronizaciju naloga iz ERP-a.

    - `statusi`: ako nisu navedeni, koriste se aktivni statusi iz tablice sync_statusi
    - `datum_od`: početni datum (default: danas - 30 dana)
    - `datum_do`: krajnji datum (default: danas)
    """
    datum_od = payload.datum_od or (date.today() - timedelta(days=30))
    datum_do = payload.datum_do or date.today()

    statusi = payload.statusi if payload.statusi else _get_active_sync_statusi(db)
    require_raspored = _get_sync_require_raspored(db)

    log = SyncLog(entity="orders", status="QUEUED", message="Sinkronizacija pokrenuta...")
    db.add(log)
    db.commit()
    db.refresh(log)

    from app.db.session import SessionLocal

    def run_sync():
        print(f"[run_sync] START sync orders datum_od={datum_od} datum_do={datum_do} statusi={statusi}", flush=True)
        try:
            with SessionLocal() as bg_db:
                bg_log = bg_db.get(SyncLog, log.id)
                if bg_log:
                    _run_async(do_sync_orders(
                        bg_db, bg_log, statusi, datum_od, datum_do,
                        require_raspored=require_raspored,
                    ))
                else:
                    print(f"[run_sync] GREŠKA: SyncLog {log.id} nije pronađen!", flush=True)
        except Exception as exc:
            print(f"[run_sync] GREŠKA: {exc}", flush=True)
            logger.exception("run_sync failed: %s", exc)
        print("[run_sync] GOTOVO", flush=True)

    background_tasks.add_task(run_sync)

    return SyncResponse(sync_id=log.id, status=log.status, message=log.message)


@router.post("/sync/refresh-orders", response_model=SyncResponse, status_code=status.HTTP_202_ACCEPTED)
def refresh_orders_endpoint(
    payload: RefreshOrdersRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    Osvježava naloge u statusu '08' s najnovijim podacima iz ERP-a.

    Koristi ERP endpoint IzmjenaStatus za dohvat promjena od zadanog datuma.
    Ažurira header i partner podatke za naloge koji su u našoj bazi u statusu '08'.
    """
    datum_od = payload.datum_od or (date.today() - timedelta(days=7))

    log = SyncLog(entity="refresh_orders", status="QUEUED", message="Osvježavanje naloga pokrenuto...")
    db.add(log)
    db.commit()
    db.refresh(log)

    from app.db.session import SessionLocal

    def run_refresh():
        with SessionLocal() as bg_db:
            bg_log = bg_db.get(SyncLog, log.id)
            if bg_log:
                _run_async(do_refresh_orders(bg_db, bg_log, datum_od))

    background_tasks.add_task(run_refresh)

    return SyncResponse(sync_id=log.id, status=log.status, message=log.message)


@router.post("/sync/partners", response_model=SyncResponse, status_code=status.HTTP_202_ACCEPTED)
def sync_partners_endpoint(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    Pokreće sinkronizaciju partnera.
    Napomena: partneri se sinkroniziraju zajedno s nalozima.
    """
    log = SyncLog(entity="partners", status="QUEUED", message="Sinkronizacija pokrenuta...")
    db.add(log)
    db.commit()
    db.refresh(log)

    from app.db.session import SessionLocal

    def run_sync():
        with SessionLocal() as bg_db:
            bg_log = bg_db.get(SyncLog, log.id)
            if bg_log:
                _run_async(do_sync_partners(bg_db, bg_log))

    background_tasks.add_task(run_sync)

    return SyncResponse(sync_id=log.id, status=log.status, message=log.message)


@router.post("/sync/artikli", response_model=SyncResponse, status_code=status.HTTP_202_ACCEPTED)
def sync_artikli_endpoint(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    Pokreće sinkronizaciju artikala iz ERP-a.
    Iterira kroz sve stranice artikala i upserta u bazu.
    """
    log = SyncLog(entity="artikli", status="QUEUED", message="Sinkronizacija pokrenuta...")
    db.add(log)
    db.commit()
    db.refresh(log)

    from app.db.session import SessionLocal

    def run_sync():
        with SessionLocal() as bg_db:
            bg_log = bg_db.get(SyncLog, log.id)
            if bg_log:
                _run_async(do_sync_artikli(bg_db, bg_log))

    background_tasks.add_task(run_sync)

    return SyncResponse(sync_id=log.id, status=log.status, message=log.message)


@router.post("/sync/orders-by-raspored", response_model=SyncResponse, status_code=status.HTTP_202_ACCEPTED)
def sync_orders_by_raspored_endpoint(
    payload: SyncByRasporedRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    Sinkronizira naloge po datumu rasporeda (isporuke).

    Gleda ERP naloge unazad 7 dana od zadanog datuma, filtrira samo one
    čiji raspored odgovara tom datumu, te importira one koji još ne postoje
    u našim tablicama.
    """
    log = SyncLog(
        entity="orders_by_raspored",
        status="QUEUED",
        message=f"Sync po rasporedu {payload.raspored_datum.strftime('%d.%m.%Y')} pokrenut...",
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    raspored_datum = payload.raspored_datum

    from app.db.session import SessionLocal

    def run_sync():
        print(f"[run_sync] START sync by raspored {raspored_datum}", flush=True)
        try:
            with SessionLocal() as bg_db:
                bg_log = bg_db.get(SyncLog, log.id)
                if bg_log:
                    _run_async(do_sync_by_raspored(bg_db, bg_log, raspored_datum))
        except Exception as exc:
            print(f"[run_sync] GREŠKA: {exc}", flush=True)
            logger.exception("run_sync (raspored) failed: %s", exc)
        print("[run_sync] GOTOVO (raspored)", flush=True)

    background_tasks.add_task(run_sync)

    return SyncResponse(sync_id=log.id, status=log.status, message=log.message)


@router.get("/sync/status/{sync_id}", response_model=SyncResponse)
def get_sync_status(sync_id: int, db: Session = Depends(get_db)) -> SyncResponse:
    """Dohvati status sinkronizacije po ID-u."""
    log = db.get(SyncLog, sync_id)
    if not log:
        return SyncResponse(sync_id=sync_id, status="NOT_FOUND", message="Sync log nije pronađen.")
    return SyncResponse(sync_id=log.id, status=log.status, message=log.message)
