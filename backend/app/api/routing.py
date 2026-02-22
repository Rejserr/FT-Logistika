"""
Routing API endpointi.

CRUD za rute, optimizacija, geocoding, distance matrix.
"""
import logging
from datetime import date, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import delete as sa_delete, func, select, update as sa_update
from sqlalchemy.orm import Session

from pydantic import BaseModel as _BaseModel

from app.db.session import get_db
from app.models.routing_models import Ruta, RutaStop, RutaPolyline
from app.models.routing_order_models import NalogHeaderRutiranje
from app.schemas.routing import (
    CreateRouteRequest,
    DistanceRequest,
    DistanceResponse,
    GeocodeOrderResult,
    GeocodeOrdersRequest,
    GeocodingRequest,
    GeocodingResponse,
    OptimizeRouteRequest,
    ProviderInfoResponse,
    ReorderStopsRequest,
    RouteListOut,
    RouteOut,
    RouteStopOut,
    UpdateRouteStatusRequest,
    UpdateStopStatusRequest,
)
from app.core.config import settings as app_settings
from app.core.deps import get_current_active_user
from app.core.warehouse_scope import is_admin
from app.models.config_models import Setting
from app.models.user_models import User
from app.services.distance_service import distance_service
from app.services.export_service import export_service
from app.services.geocoding_service import geocoding_service
from app.services.routing_service import routing_service

router = APIRouter()


def _get_route_regions(db: Session, ruta_id: int) -> str | None:
    """Dohvati jedinstvene nazive regija za naloge na ruti."""
    from app.models.erp_models import NalogHeader
    from app.models.routing_order_models import NalogHeaderRutiranje, NalogHeaderArhiva
    from app.models.regional_models import Regija

    stop_uids = db.execute(
        select(RutaStop.nalog_uid).where(RutaStop.ruta_id == ruta_id)
    ).scalars().all()
    if not stop_uids:
        return None

    regija_ids: set[int] = set()
    for uid in stop_uids:
        for Model in (NalogHeaderRutiranje, NalogHeader, NalogHeaderArhiva):
            q = select(Model.regija_id).where(Model.nalog_prodaje_uid == uid)
            rid = db.execute(q).scalar_one_or_none()
            if rid is not None:
                regija_ids.add(rid)
                break

    if not regija_ids:
        return None

    names = db.execute(
        select(Regija.naziv).where(Regija.id.in_(regija_ids)).order_by(Regija.naziv)
    ).scalars().all()
    return ", ".join(names) if names else None


# ==============================================================================
# Routes CRUD
# ==============================================================================


@router.get("/routes", response_model=list[RouteListOut])
def list_routes(
    datum_od: date | None = Query(default=None),
    datum_do: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    vozilo_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[RouteListOut]:
    """Lista svih ruta s filterima."""
    query = select(Ruta)

    if not is_admin(current_user) and current_user.warehouse_id:
        query = query.where(Ruta.warehouse_id == current_user.warehouse_id)

    if datum_od:
        query = query.where(Ruta.datum >= datum_od)
    if datum_do:
        query = query.where(Ruta.datum <= datum_do)
    if status_filter:
        query = query.where(Ruta.status == status_filter)
    if vozilo_id:
        query = query.where(Ruta.vozilo_id == vozilo_id)

    query = query.order_by(Ruta.datum.desc(), Ruta.id.desc()).offset(offset).limit(limit)
    routes = db.execute(query).scalars().all()

    # Dodaj broj stopova, vozilo oznaku i WMS palete
    from app.models.vehicle_models import Vozilo
    from app.services.mantis_service import mantis_service
    result = []
    for route in routes:
        stops_count = db.execute(
            select(func.count(RutaStop.id)).where(RutaStop.ruta_id == route.id)
        ).scalar() or 0

        vozilo_oznaka = None
        if route.vozilo_id:
            vozilo = db.get(Vozilo, route.vozilo_id)
            if vozilo:
                vozilo_oznaka = vozilo.oznaka or vozilo.naziv

        # WMS pallet count
        wms_paleta = None
        try:
            pallet_data = mantis_service.get_pallet_count_for_route(db, route.id)
            if pallet_data["total_pallets"] > 0:
                wms_paleta = pallet_data["total_pallets"]
        except Exception:
            pass

        regije = _get_route_regions(db, route.id)

        result.append(
            RouteListOut(
                id=route.id,
                datum=route.datum,
                raspored=route.raspored,
                status=route.status,
                algoritam=route.algoritam,
                vozilo_id=route.vozilo_id,
                vozilo_oznaka=vozilo_oznaka,
                vozac_id=route.vozac_id,
                driver_name=route.driver_name,
                warehouse_id=route.warehouse_id,
                distance_km=float(route.distance_km) if route.distance_km else None,
                duration_min=route.duration_min,
                stops_count=stops_count,
                wms_paleta=wms_paleta,
                regije=regije,
            )
        )

    return result


@router.get("/routes/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: Session = Depends(get_db)) -> RouteOut:
    """Dohvati rutu s detaljima stopova."""
    route_data = routing_service.get_route_with_stops(db, route_id)
    if not route_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ruta nije pronađena."
        )

    stops = [RouteStopOut(**s) for s in route_data.get("stops", [])]

    raspored_raw = route_data.get("raspored")
    raspored_val = None
    if raspored_raw:
        raspored_val = date.fromisoformat(raspored_raw) if isinstance(raspored_raw, str) else raspored_raw

    return RouteOut(
        id=route_data["id"],
        datum=date.fromisoformat(route_data["datum"]) if route_data.get("datum") else None,
        raspored=raspored_val,
        status=route_data.get("status"),
        algoritam=route_data.get("algoritam"),
        vozilo_id=route_data.get("vozilo_id"),
        vozilo_oznaka=route_data.get("vozilo_oznaka"),
        vozac_id=route_data.get("vozac_id"),
        driver_name=route_data.get("driver_name"),
        warehouse_id=route_data.get("warehouse_id"),
        izvor_tip=route_data.get("izvor_tip"),
        izvor_id=route_data.get("izvor_id"),
        distance_km=route_data.get("distance_km"),
        duration_min=route_data.get("duration_min"),
        stops=stops,
        polyline=route_data.get("polyline"),
    )


@router.post("/routes", response_model=RouteOut, status_code=status.HTTP_201_CREATED)
def create_route(
    payload: CreateRouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RouteOut:
    """
    Kreiraj novu rutu.

    Prima listu nalog_uid i opcije (vozilo, vozač, depot, algoritam).
    Optimizira redoslijed stopova prema odabranom algoritmu.
    """
    start_time = None
    if payload.start_time:
        route_date = payload.datum or date.today()
        start_time = datetime.combine(route_date, payload.start_time)

    ruta = routing_service.create_route(
        db=db,
        nalog_uids=payload.nalog_uids,
        vozilo_id=payload.vozilo_id,
        vozac_id=payload.vozac_id,
        izvor_tip=payload.izvor_tip,
        izvor_id=payload.izvor_id,
        datum=payload.datum,
        raspored=payload.raspored,
        start_time=start_time,
        algoritam=payload.algoritam,
        warehouse_id=current_user.warehouse_id,
    )

    if payload.driver_user_id:
        driver = db.get(User, payload.driver_user_id)
        if driver:
            ruta.driver_user_id = driver.id
            ruta.driver_name = driver.full_name or driver.username
            db.commit()

    return get_route(ruta.id, db)


# ---------------------------------------------------------------------------
# Driver assignment
# ---------------------------------------------------------------------------


class _AssignDriverRequest(_BaseModel):
    driver_user_id: int | None = None


@router.get("/available-drivers")
def list_available_drivers(
    warehouse_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List users with role 'Vozac' (drivers), optionally filtered by warehouse."""
    from app.models.user_models import Role

    logger.info("[DRIVERS] current_user=%s warehouse_id_param=%s user_warehouse=%s",
                current_user.username, warehouse_id, current_user.warehouse_id)

    query = (
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(Role.name == "Vozac", User.aktivan == True)  # noqa: E712
    )

    wh = warehouse_id if warehouse_id is not None else current_user.warehouse_id
    if wh:
        query = query.where(User.warehouse_id == wh)

    logger.info("[DRIVERS] warehouse filter: %s", wh)

    drivers = db.execute(query.order_by(User.ime, User.prezime)).unique().scalars().all()

    logger.info("[DRIVERS] found %d drivers", len(drivers))

    result = [
        {
            "id": d.id,
            "username": d.username,
            "full_name": d.full_name,
            "warehouse_id": d.warehouse_id,
        }
        for d in drivers
    ]
    return result


@router.put("/routes/{route_id}/assign-driver")
def assign_driver_to_route(
    route_id: int,
    payload: _AssignDriverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Assign or remove a driver from a route."""
    ruta = db.get(Ruta, route_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta nije pronađena.")

    if payload.driver_user_id is None:
        ruta.driver_user_id = None
        ruta.driver_name = None
    else:
        driver = db.get(User, payload.driver_user_id)
        if not driver:
            raise HTTPException(status_code=404, detail="Vozač nije pronađen.")
        ruta.driver_user_id = driver.id
        ruta.driver_name = driver.full_name or driver.username

    db.commit()
    return {
        "route_id": ruta.id,
        "driver_user_id": ruta.driver_user_id,
        "driver_name": ruta.driver_name,
    }


@router.put("/routes/{route_id}/status", response_model=RouteOut)
def update_route_status(
    route_id: int,
    payload: UpdateRouteStatusRequest,
    db: Session = Depends(get_db),
) -> RouteOut:
    """Promijeni status rute."""
    ruta = db.get(Ruta, route_id)
    if not ruta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ruta nije pronađena."
        )

    ruta.status = payload.status
    db.commit()

    return get_route(route_id, db)


@router.put("/routes/{route_id}/reorder", response_model=RouteOut)
def reorder_route_stops(
    route_id: int,
    payload: ReorderStopsRequest,
    db: Session = Depends(get_db),
) -> RouteOut:
    """Ručna promjena redoslijeda stopova."""
    try:
        routing_service.reorder_stops(db, route_id, payload.new_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return get_route(route_id, db)


@router.post("/routes/{route_id}/optimize", response_model=RouteOut)
def optimize_route(
    route_id: int,
    payload: OptimizeRouteRequest,
    db: Session = Depends(get_db),
) -> RouteOut:
    """
    Re-optimiziraj postojeću rutu.

    Uzima postojeće stopove i ponovno izračunava optimalan redoslijed.
    """
    ruta = db.get(Ruta, route_id)
    if not ruta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ruta nije pronađena."
        )

    # Dohvati postojeće stopove
    stops = db.execute(
        select(RutaStop).where(RutaStop.ruta_id == route_id)
    ).scalars().all()

    nalog_uids = [s.nalog_uid for s in stops]

    # Obriši postojeće stopove
    for stop in stops:
        db.delete(stop)
    db.flush()

    # Kreiraj novu optimiziranu rutu s istim parametrima
    new_ruta = routing_service.create_route(
        db=db,
        nalog_uids=nalog_uids,
        vozilo_id=ruta.vozilo_id,
        vozac_id=ruta.vozac_id,
        izvor_tip=ruta.izvor_tip,
        izvor_id=ruta.izvor_id,
        datum=ruta.datum,
        raspored=ruta.raspored,
        algoritam=payload.algoritam,
    )

    # Obriši polyline i staru rutu
    db.execute(sa_delete(RutaPolyline).where(RutaPolyline.ruta_id == route_id))
    db.delete(ruta)
    db.commit()

    return get_route(new_ruta.id, db)


@router.get("/routes/{route_id}/export/excel")
def export_route_excel(route_id: int, db: Session = Depends(get_db)) -> Response:
    """Export rute u Excel format."""
    try:
        content = export_service.export_route_to_excel(db, route_id)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=ruta_{route_id}.xlsx"},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/routes/{route_id}/export/pdf")
def export_route_pdf(route_id: int, db: Session = Depends(get_db)) -> Response:
    """Export rute u PDF format."""
    try:
        content = export_service.export_route_to_pdf(db, route_id)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=ruta_{route_id}.pdf"},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(route_id: int, db: Session = Depends(get_db)) -> None:
    """Obriši rutu i sve njene stopove, polyline-ove i resetiraj naloge u rutiranju."""
    ruta = db.get(Ruta, route_id)
    if not ruta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ruta nije pronađena."
        )

    # 1. Resetiraj naloge u rutiranju (ukloni referencu na rutu)
    db.execute(
        sa_update(NalogHeaderRutiranje)
        .where(NalogHeaderRutiranje.ruta_id == route_id)
        .values(ruta_id=None, status_rutiranja="CEKA_RUTU")
    )

    # 2. Obriši polyline-ove (FK na rute.id)
    db.execute(sa_delete(RutaPolyline).where(RutaPolyline.ruta_id == route_id))

    # 3. Obriši stopove (FK na rute.id) — OBAVEZNO PRIJE brisanja rute
    db.execute(sa_delete(RutaStop).where(RutaStop.ruta_id == route_id))

    # 4. Flush da se SQL izvrši prije brisanja rute
    db.flush()

    # 5. Obriši rutu
    db.delete(ruta)
    db.commit()


# ==============================================================================
# Stop status
# ==============================================================================


@router.put("/routes/{route_id}/stops/{stop_id}/status")
def update_stop_status(
    route_id: int,
    stop_id: int,
    payload: UpdateStopStatusRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Promijeni status pojedinačnog stopa. Auto-complete rutu ako su svi stopovi obrađeni."""
    stop = db.execute(
        select(RutaStop).where(
            RutaStop.id == stop_id, RutaStop.ruta_id == route_id
        )
    ).scalar_one_or_none()

    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stop nije pronađen."
        )

    route = db.get(Ruta, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Ruta nije pronađena.")

    # Ako ruta nije IN_PROGRESS, automatski je prebaci
    if route.status == "PLANNED" and payload.status in ("DELIVERED", "FAILED", "SKIPPED", "ARRIVED"):
        route.status = "IN_PROGRESS"

    stop.status = payload.status
    db.flush()

    # Provjeri jesu li svi stopovi obrađeni (DELIVERED, FAILED, SKIPPED)
    all_stops = db.execute(
        select(RutaStop).where(RutaStop.ruta_id == route_id)
    ).scalars().all()

    total = len(all_stops)
    completed_statuses = {"DELIVERED", "FAILED", "SKIPPED"}
    done = sum(1 for s in all_stops if s.status in completed_statuses)
    delivered = sum(1 for s in all_stops if s.status == "DELIVERED")
    failed = sum(1 for s in all_stops if s.status == "FAILED")
    skipped = sum(1 for s in all_stops if s.status == "SKIPPED")
    pending = total - done

    route_auto_completed = False
    auto_archived = 0
    if done == total and total > 0 and route.status == "IN_PROGRESS":
        route.status = "COMPLETED"
        route_auto_completed = True

        # Ako su SVI stopovi DELIVERED (nema neuspjelih), automatski arhiviraj
        if delivered == total:
            from app.api.routing_orders import _archive_delivered_stops
            auto_archived = _archive_delivered_stops(db, route)

    db.commit()

    return {
        "stop": {
            "id": stop.id,
            "nalog_uid": stop.nalog_uid,
            "redoslijed": stop.redoslijed,
            "eta": str(stop.eta) if stop.eta else None,
            "status": stop.status,
        },
        "route_status": route.status,
        "route_auto_completed": route_auto_completed,
        "auto_archived": auto_archived,
        "summary": {
            "total": total,
            "delivered": delivered,
            "failed": failed,
            "skipped": skipped,
            "pending": pending,
        },
    }


# ==============================================================================
# Geocoding & Distance Matrix
# ==============================================================================


@router.post("/geocode", response_model=GeocodingResponse)
def geocode_address(
    payload: GeocodingRequest, db: Session = Depends(get_db)
) -> GeocodingResponse:
    """Geocodiraj adresu."""
    result = geocoding_service.geocode(db, payload.address)
    return GeocodingResponse(
        lat=float(result.lat) if result.lat else None,
        lng=float(result.lng) if result.lng else None,
        formatted_address=result.formatted_address,
        from_cache=result.from_cache,
    )


@router.get("/geocode/failed")
def get_failed_geocoding(db: Session = Depends(get_db)) -> list[dict]:
    """Dohvati sve adrese koje nemaju koordinate (geocoding neuspjeh)."""
    from app.models.sync_models import GeocodingCache
    failed = db.execute(
        select(GeocodingCache).where(GeocodingCache.lat.is_(None))
    ).scalars().all()
    return [
        {
            "id": entry.id,
            "address": entry.address,
            "provider": entry.provider,
            "updated_at": str(entry.updated_at) if entry.updated_at else None,
        }
        for entry in failed
    ]


@router.get("/geocode/search")
def search_geocoding_cache(
    q: str = Query("", description="Pojam pretrage (adresa)"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Pretraži geocoding cache po adresi (sve zapise, i uspješne i neuspješne)."""
    from app.models.sync_models import GeocodingCache
    query = select(GeocodingCache).order_by(GeocodingCache.updated_at.desc())
    if q.strip():
        query = query.where(GeocodingCache.address.ilike(f"%{q.strip()}%"))
    query = query.limit(limit)
    entries = db.execute(query).scalars().all()
    return [
        {
            "id": entry.id,
            "address": entry.address,
            "lat": float(entry.lat) if entry.lat else None,
            "lng": float(entry.lng) if entry.lng else None,
            "provider": entry.provider,
            "updated_at": str(entry.updated_at) if entry.updated_at else None,
        }
        for entry in entries
    ]


@router.post("/geocode/retry-failed")
def retry_failed_geocoding(db: Session = Depends(get_db)) -> dict:
    """
    Ponovi geocoding za sve adrese u cache-u koje imaju NULL koordinate.
    Koristi poboljšano čišćenje adresa i multi-provider fallback.
    """
    from app.models.sync_models import GeocodingCache
    failed = db.execute(
        select(GeocodingCache).where(GeocodingCache.lat.is_(None))
    ).scalars().all()

    if not failed:
        return {"message": "Nema neuspjelih geocoding zapisa", "retried": 0, "fixed": 0}

    retried = 0
    fixed = 0
    for entry in failed:
        # Obriši stari zapis da geocode() ponovo pokuša
        db.delete(entry)
        db.flush()

        result = geocoding_service.geocode(db, entry.address)
        retried += 1
        if result.lat is not None:
            fixed += 1

    db.commit()
    return {"retried": retried, "fixed": fixed, "still_failed": retried - fixed}


@router.put("/geocode/manual/{cache_id}")
def set_manual_coordinates(
    cache_id: int,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
) -> dict:
    """Ručno postavi koordinate za bilo koji geocoding cache zapis (i nove i postojeće)."""
    from app.models.sync_models import GeocodingCache
    entry = db.get(GeocodingCache, cache_id)
    if not entry:
        raise HTTPException(404, "Geocoding zapis nije pronađen")
    old_lat = float(entry.lat) if entry.lat else None
    old_lng = float(entry.lng) if entry.lng else None
    entry.lat = Decimal(str(lat))
    entry.lng = Decimal(str(lng))
    entry.provider = "manual"
    db.commit()
    return {
        "id": entry.id,
        "address": entry.address,
        "lat": float(entry.lat),
        "lng": float(entry.lng),
        "old_lat": old_lat,
        "old_lng": old_lng,
        "provider": "manual",
    }


@router.delete("/geocode/cache/{cache_id}")
def delete_geocoding_cache(cache_id: int, db: Session = Depends(get_db)) -> dict:
    """Obriši geocoding cache zapis (sljedeći geocode će ponovo pokušati)."""
    from app.models.sync_models import GeocodingCache
    entry = db.get(GeocodingCache, cache_id)
    if not entry:
        raise HTTPException(404, "Geocoding zapis nije pronađen")
    address = entry.address
    db.delete(entry)
    db.commit()
    return {"deleted": True, "address": address}


@router.post("/distance", response_model=DistanceResponse)
def get_distance(
    payload: DistanceRequest, db: Session = Depends(get_db)
) -> DistanceResponse:
    """Izračunaj udaljenost između dvije točke."""
    result = distance_service.get_distance(
        db, payload.origin_lat, payload.origin_lng, payload.dest_lat, payload.dest_lng
    )
    return DistanceResponse(
        distance_m=result.distance_m,
        duration_s=result.duration_s,
        distance_km=result.distance_m / 1000 if result.distance_m else None,
        duration_min=result.duration_s // 60 if result.duration_s else None,
        from_cache=result.from_cache,
    )


# ==============================================================================
# Preview naloga na karti (geocode orders)
# ==============================================================================


@router.post("/geocode-orders", response_model=list[GeocodeOrderResult])
def geocode_orders(
    payload: GeocodeOrdersRequest, db: Session = Depends(get_db)
) -> list[GeocodeOrderResult]:
    """
    Geocodiraj odabrane naloge za prikaz na karti (preview).
    Koristi aktivni geocoding provider.
    """
    results = routing_service.geocode_orders(db, payload.nalog_uids)
    return [GeocodeOrderResult(**r) for r in results]


# ==============================================================================
# Provider info / switch
# ==============================================================================


@router.get("/provider", response_model=ProviderInfoResponse)
def get_provider_info(db: Session = Depends(get_db)) -> ProviderInfoResponse:
    """Dohvati informacije o aktivnom geocoding/distance provideru."""
    row = db.execute(
        select(Setting).where(Setting.key == "geocoding_provider")
    ).scalar_one_or_none()
    provider = (row.value or "nominatim") if row else "nominatim"
    return ProviderInfoResponse(
        provider=provider.strip().lower(),
        has_google_key=bool(app_settings.GOOGLE_MAPS_API_KEY),
        has_ors_key=bool(app_settings.ORS_API_KEY),
        has_tomtom_key=bool(app_settings.TOMTOM_API_KEY),
        tomtom_map_key=app_settings.TOMTOM_API_KEY or "",
    )


@router.put("/provider")
def set_provider(
    provider: str = Query(..., pattern="^(nominatim|ors|google|osrm|tomtom)$"),
    db: Session = Depends(get_db),
) -> ProviderInfoResponse:
    """Promijeni aktivni geocoding/distance provider."""
    row = db.get(Setting, "geocoding_provider")
    if row:
        row.value = provider
    else:
        db.add(Setting(key="geocoding_provider", value=provider))
    db.commit()
    return ProviderInfoResponse(
        provider=provider,
        has_google_key=bool(app_settings.GOOGLE_MAPS_API_KEY),
        has_ors_key=bool(app_settings.ORS_API_KEY),
        has_tomtom_key=bool(app_settings.TOMTOM_API_KEY),
        tomtom_map_key=app_settings.TOMTOM_API_KEY or "",
    )
