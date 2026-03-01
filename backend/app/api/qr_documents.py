"""
QR Document endpoints — proxy ERP calls for driver app QR scanning.

GET  /qr/document/{barcode}  — fetch document from ERP by barcode
POST /qr/status              — update order status in ERP
GET  /qr/statusi             — list available statuses from local DB
"""

import json
import logging
from datetime import datetime, timezone

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.db.session import get_db
from app.models.erp_log_models import ErpLog
from app.models.user_models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/qr")


class StatusUpdateRequest(BaseModel):
    nalog_prodaje_uid: str
    status: str
    status_uid: str


class StatusUpdateBatch(BaseModel):
    statusi: list[StatusUpdateRequest]


def _erp_auth():
    return aiohttp.BasicAuth(settings.ERP_USERNAME, settings.ERP_PASSWORD)


def _log_erp(db: Session, user_id: int | None, doc_type: str, doc_uid: str | None,
             action: str, request_payload: str | None, response_payload: str | None,
             success: bool, error_message: str | None = None):
    log = ErpLog(
        user_id=user_id,
        document_type=doc_type,
        document_uid=doc_uid,
        action=action,
        request_payload=request_payload,
        response_payload=response_payload[:8000] if response_payload and len(response_payload) > 8000 else response_payload,
        success=success,
        error_message=error_message,
    )
    db.add(log)
    db.commit()


def _detect_document_type(barcode: str) -> tuple[str, str]:
    if ".LUCEED.04." in barcode:
        path = f"/datasnap/rest/mpracuni/LuceedBarcode/{barcode}"
        return "MP", path
    elif ".LUCEED.01." in barcode:
        path = f"/datasnap/rest/SkladisniDokumenti/LuceedBarcode/{barcode}"
        return "SKL", path
    else:
        raise HTTPException(status_code=400, detail="Vrsta dokumenta nije prepoznata.")


@router.get("/document/{barcode:path}")
async def get_qr_document(
    barcode: str,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    doc_type, erp_path = _detect_document_type(barcode)
    erp_url = f"{settings.ERP_BASE_URL.rstrip('/')}{erp_path}"

    logger.info("[QR] GET %s (user=%s, type=%s)", erp_url, user.username, doc_type)

    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(auth=_erp_auth()) as session:
            async with session.get(erp_url, timeout=timeout) as resp:
                resp_text = await resp.text()
                if resp.status != 200:
                    _log_erp(db, user.id, doc_type, barcode, "GET", None, resp_text, False, f"HTTP {resp.status}")
                    raise HTTPException(status_code=502, detail=f"ERP greška: HTTP {resp.status}")
                resp_json = json.loads(resp_text)
    except aiohttp.ClientError as e:
        _log_erp(db, user.id, doc_type, barcode, "GET", None, None, False, str(e))
        raise HTTPException(status_code=502, detail=f"ERP nedostupan: {e}")
    except json.JSONDecodeError:
        _log_erp(db, user.id, doc_type, barcode, "GET", None, resp_text[:2000], False, "Invalid JSON")
        raise HTTPException(status_code=502, detail="ERP vratio nevažeći JSON.")

    _log_erp(db, user.id, doc_type, barcode, "GET", None, resp_text[:8000], True)

    return {
        "document_type": doc_type,
        "barcode": barcode,
        "data": resp_json,
    }


@router.post("/status")
async def update_document_status(
    body: StatusUpdateBatch,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    erp_url = f"{settings.ERP_BASE_URL.rstrip('/')}/datasnap/rest/NaloziProdaje/Statusi"
    payload = {
        "statusi": [s.model_dump() for s in body.statusi]
    }
    payload_str = json.dumps(payload)

    logger.info("[QR] POST status update (user=%s, count=%d)", user.username, len(body.statusi))

    doc_uid = body.statusi[0].nalog_prodaje_uid if body.statusi else None

    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(auth=_erp_auth()) as session:
            async with session.post(erp_url, json=payload, timeout=timeout) as resp:
                resp_text = await resp.text()
                if resp.status != 200:
                    _log_erp(db, user.id, "STATUS", doc_uid, "POST_STATUS", payload_str, resp_text, False, f"HTTP {resp.status}")
                    raise HTTPException(status_code=502, detail=f"ERP greška: HTTP {resp.status}")
                resp_json = json.loads(resp_text)
    except aiohttp.ClientError as e:
        _log_erp(db, user.id, "STATUS", doc_uid, "POST_STATUS", payload_str, None, False, str(e))
        raise HTTPException(status_code=502, detail=f"ERP nedostupan: {e}")
    except json.JSONDecodeError:
        _log_erp(db, user.id, "STATUS", doc_uid, "POST_STATUS", payload_str, resp_text[:2000], False, "Invalid JSON")
        raise HTTPException(status_code=502, detail="ERP vratio nevažeći JSON.")

    _log_erp(db, user.id, "STATUS", doc_uid, "POST_STATUS", payload_str, resp_text[:8000], True)

    return {
        "success": True,
        "erp_response": resp_json,
    }


@router.get("/statusi")
def get_available_statuses(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    from app.models.config_models import SyncStatus
    rows = db.query(SyncStatus).all()
    return [{"status_id": r.status_id, "naziv": r.naziv} for r in rows]
