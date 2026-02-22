"""
POD (Proof of Delivery) management API.

Provides search, detail view, and manual Luceed DocumentManager upload.
"""

import base64
import json
import logging
import os
from datetime import datetime

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.db.session import get_db
from app.models.driver_models import DeliveryProof
from app.models.erp_models import NalogHeader, NalogDetail, Partner, Artikl
from app.models.routing_models import Ruta, RutaStop
from app.models.routing_order_models import NalogHeaderRutiranje, NalogHeaderArhiva
from app.models.user_models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pod", tags=["pod"])


def _find_nalog_header(db: Session, uid: str):
    """Look up a nalog header across all three tables (original, rutiranje, arhiva)."""
    h = db.get(NalogHeader, uid)
    if h:
        return h
    h = db.get(NalogHeaderRutiranje, uid)
    if h:
        return h
    return db.get(NalogHeaderArhiva, uid)

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads", "pod",
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PodListItem(BaseModel):
    id: int
    stop_id: int
    nalog_prodaje_uid: str | None
    nalog_broj: int | None = None
    skladiste: str | None = None
    partner_naziv: str | None = None
    recipient_name: str | None = None
    has_signature: bool = False
    has_photos: bool = False
    photo_count: int = 0
    gps_lat: float | None = None
    gps_lng: float | None = None
    created_at: str | None = None
    ruta_id: int | None = None
    driver_name: str | None = None
    sent_to_luceed: bool = False
    luceed_sent_at: str | None = None

    class Config:
        from_attributes = True


class PodDetail(PodListItem):
    comment: str | None = None
    signature_path: str | None = None
    photo_paths: list[str] = []
    signature_url: str | None = None
    photo_urls: list[str] = []
    nalog_header: dict | None = None
    nalog_details: list[dict] = []
    partner: dict | None = None


class LuceedSendResult(BaseModel):
    success: bool
    message: str
    file_uids: list[str] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_file_url(relative_path: str) -> str:
    """Turn relative path like 'pod/12345.jpg' into API-relative URL."""
    filename = os.path.basename(relative_path)
    return f"/pod/image/{filename}"


def _pod_to_list_item(pod: DeliveryProof, db: Session) -> dict:
    photo_paths = json.loads(pod.photo_paths) if pod.photo_paths else []

    nalog = None
    partner_naziv = None
    ruta_id = None
    driver_name = None

    if pod.nalog_prodaje_uid:
        nalog = _find_nalog_header(db, pod.nalog_prodaje_uid)
        if nalog and nalog.partner_uid:
            partner = db.get(Partner, nalog.partner_uid)
            if partner:
                partner_naziv = partner.naziv

    stop = db.get(RutaStop, pod.stop_id)
    if stop:
        ruta_id = stop.ruta_id
        ruta = db.get(Ruta, stop.ruta_id)
        if ruta:
            driver_name = ruta.driver_name

    driver = db.get(User, pod.driver_user_id)

    return {
        "id": pod.id,
        "stop_id": pod.stop_id,
        "nalog_prodaje_uid": pod.nalog_prodaje_uid,
        "nalog_broj": nalog.broj if nalog else None,
        "skladiste": nalog.skladiste if nalog else None,
        "partner_naziv": partner_naziv,
        "recipient_name": pod.recipient_name,
        "has_signature": bool(pod.signature_path),
        "has_photos": bool(photo_paths),
        "photo_count": len(photo_paths),
        "gps_lat": float(pod.gps_lat) if pod.gps_lat else None,
        "gps_lng": float(pod.gps_lng) if pod.gps_lng else None,
        "created_at": pod.created_at.isoformat() if pod.created_at else None,
        "ruta_id": ruta_id,
        "driver_name": driver_name or (f"{driver.ime} {driver.prezime}" if driver and driver.ime else None),
        "sent_to_luceed": bool(getattr(pod, "luceed_sent_at", None)),
        "luceed_sent_at": getattr(pod, "luceed_sent_at", None),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/list")
def list_pods(
    q: str = Query(None, description="Search by nalog_prodaje_uid or broj-skladiste"),
    ruta_id: int = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all PODs with optional search."""
    query = select(DeliveryProof).order_by(DeliveryProof.created_at.desc())

    if q:
        q = q.strip()
        query = query.where(
            or_(
                DeliveryProof.nalog_prodaje_uid.contains(q),
                DeliveryProof.nalog_prodaje_uid == q,
            )
        )

    if ruta_id:
        stop_ids = db.execute(
            select(RutaStop.id).where(RutaStop.ruta_id == ruta_id)
        ).scalars().all()
        if stop_ids:
            query = query.where(DeliveryProof.stop_id.in_(stop_ids))
        else:
            return []

    pods = db.execute(query.offset(offset).limit(limit)).scalars().all()
    return [_pod_to_list_item(p, db) for p in pods]


@router.get("/detail/{pod_id}")
def get_pod_detail(
    pod_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get full POD detail including order header, details, partner info, and image URLs."""
    pod = db.get(DeliveryProof, pod_id)
    if not pod:
        raise HTTPException(404, "POD nije pronađen.")

    photo_paths = json.loads(pod.photo_paths) if pod.photo_paths else []
    base = _pod_to_list_item(pod, db)

    # Build image URLs
    signature_url = _build_file_url(pod.signature_path) if pod.signature_path else None
    photo_urls = [_build_file_url(p) for p in photo_paths]

    # Order header + details
    nalog_header_dict = None
    nalog_details_list = []
    partner_dict = None

    if pod.nalog_prodaje_uid:
        nalog = _find_nalog_header(db, pod.nalog_prodaje_uid)
        if nalog:
            nalog_header_dict = {
                "nalog_prodaje_uid": nalog.nalog_prodaje_uid,
                "broj": nalog.broj,
                "datum": nalog.datum.isoformat() if nalog.datum else None,
                "raspored": nalog.raspored.isoformat() if nalog.raspored else None,
                "skladiste": nalog.skladiste,
                "status": nalog.status,
                "partner_uid": nalog.partner_uid,
                "vrsta_isporuke": nalog.vrsta_isporuke,
                "napomena": nalog.napomena,
                "poruka_gore": nalog.poruka_gore,
                "poruka_dolje": nalog.poruka_dolje,
                "za_naplatu": float(nalog.za_naplatu) if nalog.za_naplatu else None,
                "kreirao__radnik_ime": nalog.kreirao__radnik_ime,
                "total_weight": float(nalog.total_weight) if nalog.total_weight else None,
                "total_volume": float(nalog.total_volume) if nalog.total_volume else None,
            }

            if nalog.partner_uid:
                partner = db.get(Partner, nalog.partner_uid)
                if partner:
                    partner_dict = {
                        "partner_uid": partner.partner_uid,
                        "naziv": partner.naziv,
                        "ime": partner.ime,
                        "prezime": partner.prezime,
                        "adresa": partner.adresa,
                        "naziv_mjesta": partner.naziv_mjesta,
                        "postanski_broj": partner.postanski_broj,
                        "mobitel": partner.mobitel,
                        "telefon": partner.telefon,
                        "e_mail": partner.e_mail,
                        "kontakt_osoba": partner.kontakt_osoba,
                        "oib": partner.oib,
                    }

        details = db.execute(
            select(NalogDetail)
            .where(NalogDetail.nalog_prodaje_uid == pod.nalog_prodaje_uid)
            .order_by(NalogDetail.redoslijed)
        ).scalars().all()

        for d in details:
            artikl = db.get(Artikl, d.artikl_uid) if d.artikl_uid else None
            nalog_details_list.append({
                "stavka_uid": d.stavka_uid,
                "artikl": d.artikl,
                "artikl_uid": d.artikl_uid,
                "opis": d.opis,
                "kolicina": float(d.kolicina) if d.kolicina else None,
                "pakiranja": float(d.pakiranja) if d.pakiranja else None,
                "cijena": float(d.cijena) if d.cijena else None,
                "rabat": float(d.rabat) if d.rabat else None,
                "redoslijed": d.redoslijed,
                "artikl_naziv": artikl.naziv_kratki or artikl.naziv if artikl else None,
                "artikl_jm": artikl.jm if artikl else None,
                "artikl_masa": float(artikl.masa) if artikl and artikl.masa else None,
            })

    return {
        **base,
        "comment": pod.comment,
        "signature_path": pod.signature_path,
        "photo_paths": photo_paths,
        "signature_url": signature_url,
        "photo_urls": photo_urls,
        "nalog_header": nalog_header_dict,
        "nalog_details": nalog_details_list,
        "partner": partner_dict,
    }


@router.get("/image/{filename}")
def serve_pod_image(filename: str):
    """Serve a POD image file."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(404, "Slika nije pronađena.")
    return FileResponse(file_path)


# ---------------------------------------------------------------------------
# Luceed DocumentManager upload
# ---------------------------------------------------------------------------

@router.post("/send-to-luceed/{pod_id}")
async def send_pod_to_luceed(
    pod_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Manually send POD document(s) to Luceed DocumentManager.

    POST http://{ERP_BASE_URL}/datasnap/rest/DocumentManager/snimi/
    Body: { "documents": [{ "luceed_doc_uid": ..., "tip_veze": "NalogProdaje",
                            "content": base64, "filename": "...", "naziv": "..." }] }
    """
    pod = db.get(DeliveryProof, pod_id)
    if not pod:
        raise HTTPException(404, "POD nije pronađen.")

    nalog_uid = pod.nalog_prodaje_uid
    if not nalog_uid:
        raise HTTPException(400, "POD nema povezani nalog_prodaje_uid.")

    nalog = _find_nalog_header(db, nalog_uid)
    file_b2b = nalog.nalog_prodaje_b2b if nalog and nalog.nalog_prodaje_b2b else nalog_uid

    documents = []

    # Collect all files to send (photos + signature)
    photo_paths = json.loads(pod.photo_paths) if pod.photo_paths else []
    all_files = []

    for pp in photo_paths:
        fname = os.path.basename(pp)
        fpath = os.path.join(UPLOAD_DIR, fname)
        if os.path.isfile(fpath):
            all_files.append((fpath, fname))

    if pod.signature_path:
        fname = os.path.basename(pod.signature_path)
        fpath = os.path.join(UPLOAD_DIR, fname)
        if os.path.isfile(fpath):
            all_files.append((fpath, fname))

    if not all_files:
        raise HTTPException(400, "Nema datoteka za slanje.")

    for fpath, fname in all_files:
        with open(fpath, "rb") as f:
            content_b64 = base64.b64encode(f.read()).decode("ascii")

        documents.append({
            "file_b2b": file_b2b,
            "luceed_doc_uid": nalog_uid,
            "tip_veze": "NalogProdaje",
            "content": content_b64,
            "filename": fname,
            "naziv": f"POD {fname}",
        })

    url = f"{settings.ERP_BASE_URL.rstrip('/')}/datasnap/rest/DocumentManager/snimi/"
    auth = aiohttp.BasicAuth(settings.ERP_USERNAME, settings.ERP_PASSWORD)
    payload = {"documents": documents}

    payload_preview = [{k: (v[:30] + "..." if k == "content" and len(v) > 30 else v) for k, v in d.items()} for d in documents]
    logger.info(
        "[POD->LUCEED] Sending %d document(s) for nalog %s to %s | payload: %s",
        len(documents), nalog_uid, url, json.dumps(payload_preview, ensure_ascii=False),
    )

    try:
        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(auth=auth) as session:
            async with session.post(url, json=payload, timeout=timeout) as resp:
                resp_text = await resp.text()
                logger.info("[POD->LUCEED] Response %d: %s", resp.status, resp_text[:500])

                if resp.status >= 400:
                    raise HTTPException(
                        502,
                        f"Luceed DocumentManager vratio grešku {resp.status}: {resp_text[:300]}",
                    )

                try:
                    resp_json = json.loads(resp_text)
                    file_uids = resp_json.get("result", [])
                except Exception:
                    file_uids = []

    except aiohttp.ClientError as e:
        logger.error("[POD->LUCEED] Connection error: %s", e)
        raise HTTPException(502, f"Greška pri spajanju na Luceed: {e}")

    # Mark as sent
    if not hasattr(pod, "luceed_sent_at") or pod.luceed_sent_at is None:
        try:
            pod.luceed_sent_at = datetime.utcnow()
            db.commit()
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Uspješno poslano {len(documents)} dokument(a) u Luceed.",
        "file_uids": file_uids if isinstance(file_uids, list) else [],
        "nalog_prodaje_uid": nalog_uid,
    }
