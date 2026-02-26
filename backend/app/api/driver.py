"""
Driver API endpoints — backend for mobile driver app.

Provides driver login (with vehicle registration), route retrieval,
stop status updates, proof of delivery upload (with file upload),
GPS location tracking, and on_duty toggle.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.core.deps import get_current_active_user
from app.db.session import get_db
from app.models.driver_models import DeliveryProof, DriverLocation, DriverSession
from app.models.erp_models import NalogHeader, Partner
from app.models.routing_models import Ruta, RutaStop, RutaPolyline
from app.models.routing_order_models import NalogHeaderArhiva, NalogHeaderRutiranje
from app.models.user_models import User
from app.models.vehicle_models import Vozilo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/driver")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "pod")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DriverLoginRequest(BaseModel):
    username: str
    password: str
    registration_plate: str = ""


class DriverRouteStopOut(BaseModel):
    id: int
    redoslijed: int
    nalog_uid: str
    partner_naziv: str | None = None
    adresa: str | None = None
    mjesto: str | None = None
    lat: float | None = None
    lng: float | None = None
    eta: str | None = None
    status: str = "PENDING"


class DriverRouteOut(BaseModel):
    id: int
    datum: str | None = None
    raspored: str | None = None
    status: str | None = None
    distance_km: float | None = None
    duration_min: int | None = None
    vozilo_oznaka: str | None = None
    vozilo_registracija: str | None = None
    stops: list[DriverRouteStopOut] = []
    polyline: list[list[float]] | None = None


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    accuracy: float | None = None
    speed: float | None = None
    heading: float | None = None


class LocationBatch(BaseModel):
    locations: list[LocationUpdate]


# ---------------------------------------------------------------------------
# Helper: enrich stop with partner data
# ---------------------------------------------------------------------------

def _enrich_stop(db: Session, stop: RutaStop) -> DriverRouteStopOut:
    """Look up partner name, address, lat/lng for a route stop via nalog tables."""
    from app.services.geocoding_service import geocoding_service

    nalog = db.get(NalogHeaderRutiranje, stop.nalog_uid)
    if not nalog:
        nalog = db.get(NalogHeader, stop.nalog_uid)

    arhiv_header = None
    if not nalog:
        arhiv_header = db.execute(
            select(NalogHeaderArhiva).where(
                NalogHeaderArhiva.nalog_prodaje_uid == stop.nalog_uid
            )
        ).scalars().first()

    partner = None
    lat = None
    lng = None
    partner_naziv = None
    partner_adresa = None
    partner_mjesto = None

    source = nalog or arhiv_header
    if source and source.partner_uid:
        partner = db.get(Partner, source.partner_uid)

    if partner:
        if partner.ime and partner.prezime:
            partner_naziv = f"{partner.ime} {partner.prezime}"
        elif partner.naziv:
            partner_naziv = partner.naziv
        else:
            partner_naziv = partner.partner

        partner_adresa = partner.adresa
        partner_mjesto = getattr(partner, "naziv_mjesta", None)

        # Build address the same way as routing_service._geocode_order
        address_parts = [partner.adresa or ""]
        if getattr(partner, "naziv_mjesta", None):
            address_parts.append(partner.naziv_mjesta)
        if getattr(partner, "postanski_broj", None):
            address_parts.append(partner.postanski_broj)
        drzava = getattr(partner, "drzava", "") or ""
        drzava_map = {"HR": "Hrvatska", "SI": "Slovenija", "BA": "Bosna i Hercegovina", "RS": "Srbija", "HU": "Mađarska", "AT": "Austrija"}
        drzava_full = drzava_map.get(drzava.strip().upper(), drzava) if drzava else "Hrvatska"
        address_parts.append(drzava_full)
        full_address = ", ".join(p for p in address_parts if p)

        result = geocoding_service.geocode(db, full_address)
        if result.lat is not None:
            lat = float(result.lat)
            lng = float(result.lng)

    return DriverRouteStopOut(
        id=stop.id,
        redoslijed=stop.redoslijed,
        nalog_uid=stop.nalog_uid,
        partner_naziv=partner_naziv,
        adresa=partner_adresa,
        mjesto=partner_mjesto,
        lat=lat,
        lng=lng,
        eta=str(stop.eta) if stop.eta else None,
        status=stop.status or "PENDING",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/login")
def driver_login(
    body: DriverLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Driver login — authenticates and creates a driver session linked to a vehicle."""
    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Pogrešno korisničko ime ili lozinka.")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Pogrešno korisničko ime ili lozinka.")

    if not user.aktivan or user.locked:
        raise HTTPException(status_code=403, detail="Korisnički račun nije dostupan.")

    # Find vehicle — by plate if provided, otherwise from assigned routes
    plate_input = (body.registration_plate or "").strip().upper()
    vozilo = None

    if plate_input:
        logger.info("[DRIVER LOGIN] Looking up vehicle with plate='%s'", plate_input)
        vozilo = db.execute(
            select(Vozilo).where(Vozilo.registracija == plate_input)
        ).scalar_one_or_none()

        if not vozilo:
            vozilo = db.execute(
                select(Vozilo).where(Vozilo.oznaka == plate_input)
            ).scalar_one_or_none()
            if vozilo:
                logger.info("[DRIVER LOGIN] Vehicle found by oznaka: id=%s", vozilo.id)

        if not vozilo:
            logger.warning("[DRIVER LOGIN] Vehicle NOT found for plate='%s'", plate_input)
    else:
        # No plate — look for vehicle from routes assigned to this driver
        assigned_ruta = db.execute(
            select(Ruta).where(
                Ruta.driver_user_id == user.id,
                Ruta.status.in_(["PLANNED", "IN_PROGRESS"]),
            ).order_by(Ruta.datum.desc()).limit(1)
        ).scalar_one_or_none()

        if assigned_ruta and assigned_ruta.vozilo_id:
            vozilo = db.get(Vozilo, assigned_ruta.vozilo_id)
            if vozilo:
                plate_input = vozilo.oznaka or vozilo.registracija or ""
                logger.info(
                    "[DRIVER LOGIN] No plate entered — using vehicle from assigned route #%d: %s",
                    assigned_ruta.id, plate_input,
                )

        if not vozilo:
            logger.info("[DRIVER LOGIN] No plate entered and no assigned routes with vehicle found")

    if vozilo:
        logger.info("[DRIVER LOGIN] Vehicle: id=%s oznaka='%s' reg='%s'", vozilo.id, vozilo.oznaka, vozilo.registracija)

    vozilo_id = vozilo.id if vozilo else None

    # Close any existing active session for this user
    existing = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalars().all()
    for s in existing:
        s.is_active = False
        s.ended_at = datetime.now(timezone.utc)

    # Create new session
    session = DriverSession(
        user_id=user.id,
        vozilo_id=vozilo_id,
        registration_plate=plate_input,
        on_duty=True,
    )
    db.add(session)
    db.commit()

    role_name = user.role.name if user.role else "Vozac"
    perms = [p.name for p in user.role.permissions] if user.role else []
    access = create_access_token(user.id, role_name, user.warehouse_id, perms)
    refresh = create_refresh_token(user.id)

    logger.info("[DRIVER LOGIN] User=%s plate=%s vozilo_id=%s session=%s", user.username, plate_input, vozilo_id, session.id)

    # Count routes/stops for summary
    route_count = 0
    stop_count = 0
    total_km = 0.0
    total_min = 0

    # Collect routes: by vehicle + by direct driver assignment
    routes: list[Ruta] = []
    if vozilo_id:
        routes = list(db.execute(
            select(Ruta).where(
                Ruta.vozilo_id == vozilo_id,
                Ruta.status.in_(["PLANNED", "IN_PROGRESS"]),
            )
        ).scalars().all())

    assigned_routes = db.execute(
        select(Ruta).where(
            Ruta.driver_user_id == user.id,
            Ruta.status.in_(["PLANNED", "IN_PROGRESS"]),
        )
    ).scalars().all()
    existing_ids = {r.id for r in routes}
    routes.extend([r for r in assigned_routes if r.id not in existing_ids])

    logger.info("[DRIVER LOGIN] Matching routes (PLANNED/IN_PROGRESS): %d", len(routes))

    for r in routes:
        route_count += 1
        total_km += float(r.distance_km) if r.distance_km else 0
        total_min += r.duration_min or 0
        stops = db.execute(
            select(RutaStop).where(RutaStop.ruta_id == r.id)
        ).scalars().all()
        stop_count += len(stops)

    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=False,
        samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=False,
        samesite="lax", max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/auth",
    )

    return {
        "message": "Uspješna prijava vozača.",
        "access_token": access,
        "token_type": "bearer",
        "session_id": session.id,
        "vozilo_id": vozilo_id,
        "vozilo_found": vozilo_id is not None,
        "force_password_change": bool(user.force_password_change),
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": role_name,
            "warehouse_id": user.warehouse_id,
        },
        "summary": {
            "route_count": route_count,
            "stop_count": stop_count,
            "total_km": round(total_km, 1),
            "total_min": total_min,
        },
    }


class DriverChangePasswordRequest(BaseModel):
    new_password: str


@router.post("/change-password")
def driver_change_password(
    body: DriverChangePasswordRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Driver forced password change — does not require current password."""
    from app.core.security import hash_password

    if len(body.new_password) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lozinka mora imati najmanje 5 znakova.",
        )

    user.password_hash = hash_password(body.new_password)
    user.force_password_change = False
    db.commit()
    logger.info("[DRIVER] Password changed for user=%s", user.username)
    return {"message": "Lozinka je uspješno promijenjena."}


@router.get("/routes", response_model=list[DriverRouteOut])
def get_driver_routes(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get routes assigned to the current driver (via active session vehicle).
    Automatically transitions PLANNED routes to IN_PROGRESS when the driver loads them."""
    routes: list[Ruta] = []

    active_session = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    if active_session and active_session.vozilo_id:
        routes = list(db.execute(
            select(Ruta).where(
                Ruta.vozilo_id == active_session.vozilo_id,
                Ruta.status.in_(["PLANNED", "IN_PROGRESS"]),
            ).order_by(Ruta.datum.desc())
        ).scalars().all())

    # Also find routes assigned to this user via web app (driver_user_id)
    assigned_routes = db.execute(
        select(Ruta).where(
            Ruta.driver_user_id == user.id,
            Ruta.status.in_(["PLANNED", "IN_PROGRESS"]),
        ).order_by(Ruta.datum.desc())
    ).scalars().all()
    existing_ids = {r.id for r in routes}
    routes.extend([r for r in assigned_routes if r.id not in existing_ids])

    if user.vozac_id:
        vozac_routes = db.execute(
            select(Ruta).where(
                Ruta.vozac_id == user.vozac_id,
                Ruta.status.in_(["PLANNED", "IN_PROGRESS"]),
            ).order_by(Ruta.datum.desc())
        ).scalars().all()
        existing_ids = {r.id for r in routes}
        routes.extend([r for r in vozac_routes if r.id not in existing_ids])

    # Auto-transition PLANNED → IN_PROGRESS and assign driver to route
    for ruta in routes:
        if ruta.status == "PLANNED":
            ruta.status = "IN_PROGRESS"
            logger.info("Route %d status changed PLANNED -> IN_PROGRESS (driver: %s)", ruta.id, user.username)
        if not ruta.driver_user_id:
            ruta.driver_user_id = user.id
            ruta.driver_name = user.full_name or user.username
            logger.info("Route %d assigned to driver: %s (user_id=%d)", ruta.id, ruta.driver_name, user.id)
    db.commit()

    result = []
    for ruta in routes:
        stops = db.execute(
            select(RutaStop).where(RutaStop.ruta_id == ruta.id).order_by(RutaStop.redoslijed)
        ).scalars().all()

        vozilo = db.get(Vozilo, ruta.vozilo_id) if ruta.vozilo_id else None

        # Load polyline
        polyline: list[list[float]] | None = None
        polyline_obj = db.execute(
            select(RutaPolyline).where(RutaPolyline.ruta_id == ruta.id)
        ).scalar_one_or_none()
        if polyline_obj and polyline_obj.polyline:
            try:
                polyline = json.loads(polyline_obj.polyline)
            except (json.JSONDecodeError, TypeError):
                pass

        result.append(DriverRouteOut(
            id=ruta.id,
            datum=str(ruta.datum) if ruta.datum else None,
            raspored=str(ruta.raspored) if ruta.raspored else None,
            status=ruta.status,
            distance_km=float(ruta.distance_km) if ruta.distance_km else None,
            duration_min=ruta.duration_min,
            vozilo_oznaka=vozilo.oznaka if vozilo else None,
            vozilo_registracija=vozilo.registracija if vozilo else None,
            stops=[_enrich_stop(db, s) for s in stops],
            polyline=polyline,
        ))

    return result


@router.get("/route/{route_id}/stops", response_model=list[DriverRouteStopOut])
def get_route_stops(
    route_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get stops for a specific route with navigation data."""
    ruta = db.get(Ruta, route_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta nije pronađena.")

    stops = db.execute(
        select(RutaStop).where(RutaStop.ruta_id == route_id).order_by(RutaStop.redoslijed)
    ).scalars().all()

    return [_enrich_stop(db, s) for s in stops]


def _auto_complete_route_if_done(db: Session, ruta_id: int) -> bool:
    """Check all stops for a route; if every stop is DELIVERED/FAILED/SKIPPED, mark the route COMPLETED."""
    ruta = db.get(Ruta, ruta_id)
    if not ruta or ruta.status == "COMPLETED":
        return False

    stops = db.execute(
        select(RutaStop).where(RutaStop.ruta_id == ruta_id)
    ).scalars().all()

    if not stops:
        return False

    all_done = all(s.status in ("DELIVERED", "FAILED", "SKIPPED") for s in stops)
    if all_done:
        ruta.status = "COMPLETED"
        db.commit()
        logger.info("[AUTO-COMPLETE] Route #%d completed — all %d stops done.", ruta_id, len(stops))
        return True
    return False


@router.put("/stop/{stop_id}/status")
def update_driver_stop_status(
    stop_id: int,
    new_status: str,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update stop status from mobile app. Valid: ARRIVED, DELIVERED, FAILED, SKIPPED."""
    valid = {"ARRIVED", "DELIVERED", "FAILED", "SKIPPED"}
    if new_status not in valid:
        raise HTTPException(400, f"Nevažeći status. Dozvoljeni: {valid}")

    stop = db.get(RutaStop, stop_id)
    if not stop:
        raise HTTPException(404, "Stop nije pronađen.")

    stop.status = new_status
    db.commit()

    route_completed = _auto_complete_route_if_done(db, stop.ruta_id)

    return {"stop_id": stop.id, "status": stop.status, "route_completed": route_completed}


@router.post("/stop/{stop_id}/pod")
async def submit_proof_of_delivery(
    stop_id: int,
    recipient_name: str = Form(None),
    comment: str = Form(None),
    gps_lat: float = Form(None),
    gps_lng: float = Form(None),
    signature: UploadFile = File(None),
    photos: list[UploadFile] = File(None),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Submit proof of delivery for a stop with optional file uploads."""
    stop = db.get(RutaStop, stop_id)
    if not stop:
        raise HTTPException(404, "Stop nije pronađen.")

    nalog_uid = stop.nalog_uid

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Save signature — flat: {nalog_uid}_potpis.png
    signature_path = None
    if signature and signature.filename:
        ext = os.path.splitext(signature.filename)[1] or ".png"
        sig_filename = f"{nalog_uid}_potpis{ext}"
        sig_path = os.path.join(UPLOAD_DIR, sig_filename)
        content = await signature.read()
        with open(sig_path, "wb") as f:
            f.write(content)
        signature_path = f"pod/{sig_filename}"

    # Save photos — flat: {nalog_uid}.jpg (first), {nalog_uid}_2.jpg, {nalog_uid}_3.jpg ...
    saved_photos: list[str] = []
    if photos:
        for i, photo in enumerate(photos):
            if not photo.filename:
                continue
            ext = os.path.splitext(photo.filename)[1] or ".jpg"
            photo_filename = f"{nalog_uid}{ext}" if i == 0 else f"{nalog_uid}_{i + 1}{ext}"
            photo_path = os.path.join(UPLOAD_DIR, photo_filename)
            content = await photo.read()
            with open(photo_path, "wb") as f:
                f.write(content)
            saved_photos.append(f"pod/{photo_filename}")

    pod = DeliveryProof(
        stop_id=stop_id,
        driver_user_id=user.id,
        nalog_prodaje_uid=nalog_uid,
        recipient_name=recipient_name,
        comment=comment,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        signature_path=signature_path,
        photo_path=saved_photos[0] if saved_photos else None,
        photo_paths=json.dumps(saved_photos) if saved_photos else None,
    )
    db.add(pod)

    # Auto-mark as delivered if not already
    if stop.status not in ("DELIVERED", "FAILED"):
        stop.status = "DELIVERED"

    db.commit()
    db.refresh(pod)

    route_completed = _auto_complete_route_if_done(db, stop.ruta_id)

    return {
        "pod_id": pod.id,
        "stop_id": stop_id,
        "nalog_uid": nalog_uid,
        "status": stop.status,
        "route_completed": route_completed,
        "signature_path": signature_path,
        "photo_paths": saved_photos,
        "message": "Proof of delivery zabilježen.",
    }


@router.get("/pod/image/{filename}")
def get_pod_image(filename: str):
    """Serve a POD image file (flat structure: {nalog_uid}_signature.png / {nalog_uid}_photo_0.jpg)."""
    from fastapi.responses import FileResponse

    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(404, "Slika nije pronađena.")

    return FileResponse(file_path)


# ---------------------------------------------------------------------------
# GPS Location tracking
# ---------------------------------------------------------------------------


@router.post("/location")
def update_location(
    body: LocationUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Record a single GPS location update from the driver app."""
    active_session = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    loc = DriverLocation(
        user_id=user.id,
        session_id=active_session.id if active_session else None,
        lat=body.lat,
        lng=body.lng,
        accuracy=body.accuracy,
        speed=body.speed,
        heading=body.heading,
    )
    db.add(loc)
    db.commit()

    return {"status": "ok"}


@router.post("/location/batch")
def update_location_batch(
    body: LocationBatch,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Record a batch of GPS location updates (for offline sync)."""
    active_session = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    session_id = active_session.id if active_session else None

    for loc_data in body.locations:
        loc = DriverLocation(
            user_id=user.id,
            session_id=session_id,
            lat=loc_data.lat,
            lng=loc_data.lng,
            accuracy=loc_data.accuracy,
            speed=loc_data.speed,
            heading=loc_data.heading,
        )
        db.add(loc)

    db.commit()
    return {"status": "ok", "count": len(body.locations)}


@router.get("/location/latest")
def get_latest_location(
    user_id: int | None = None,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get latest location of a driver. If user_id not specified, returns own location."""
    target_id = user_id or user.id
    loc = db.execute(
        select(DriverLocation)
        .where(DriverLocation.user_id == target_id)
        .order_by(DriverLocation.created_at.desc())
    ).scalars().first()

    if not loc:
        return {"found": False}

    return {
        "found": True,
        "lat": float(loc.lat),
        "lng": float(loc.lng),
        "accuracy": float(loc.accuracy) if loc.accuracy else None,
        "speed": float(loc.speed) if loc.speed else None,
        "heading": float(loc.heading) if loc.heading else None,
        "timestamp": str(loc.created_at) if loc.created_at else None,
    }


# ---------------------------------------------------------------------------
# On Duty toggle
# ---------------------------------------------------------------------------


@router.put("/duty")
def toggle_duty(
    on_duty: bool,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Toggle on_duty status for the driver's active session."""
    session = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    if not session:
        raise HTTPException(404, "Nema aktivne sesije. Prijavite se prvo.")

    session.on_duty = on_duty
    db.commit()

    return {"on_duty": session.on_duty, "session_id": session.id}


@router.get("/duty")
def get_duty_status(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get current on_duty status."""
    session = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    if not session:
        return {"on_duty": False, "active_session": False}

    return {
        "on_duty": session.on_duty,
        "active_session": True,
        "session_id": session.id,
    }


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------


@router.get("/session")
def get_active_session(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get current active driver session."""
    session = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    if not session:
        return {"active": False}

    return {
        "active": True,
        "session_id": session.id,
        "vozilo_id": session.vozilo_id,
        "registration_plate": session.registration_plate,
        "on_duty": session.on_duty,
        "started_at": str(session.started_at) if session.started_at else None,
    }


@router.post("/session/end")
def end_driver_session(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """End the current active driver session."""
    sessions = db.execute(
        select(DriverSession).where(
            DriverSession.user_id == user.id,
            DriverSession.is_active == True,  # noqa: E712
        )
    ).scalars().all()

    for s in sessions:
        s.is_active = False
        s.on_duty = False
        s.ended_at = datetime.now(timezone.utc)

    db.commit()
    return {"message": "Sesija završena.", "ended": len(sessions)}


# ---------------------------------------------------------------------------
# Auto-complete route
# ---------------------------------------------------------------------------


@router.post("/route/{route_id}/check-complete")
def check_route_complete(
    route_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Check if all stops are done and auto-complete the route if so."""
    ruta = db.get(Ruta, route_id)
    if not ruta:
        raise HTTPException(404, "Ruta nije pronađena.")

    stops = db.execute(
        select(RutaStop).where(RutaStop.ruta_id == route_id)
    ).scalars().all()

    if not stops:
        return {"completed": False, "reason": "Nema stopova"}

    all_done = all(s.status in ("DELIVERED", "FAILED", "SKIPPED") for s in stops)

    if all_done and ruta.status != "COMPLETED":
        ruta.status = "COMPLETED"
        db.commit()
        return {"completed": True, "route_id": route_id, "message": "Ruta automatski završena."}

    pending = sum(1 for s in stops if s.status in ("PENDING", "ARRIVED"))
    return {
        "completed": False,
        "total_stops": len(stops),
        "pending": pending,
    }
