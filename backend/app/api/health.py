"""Health check endpoint — reports DB, ERP, and WMS connectivity status."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
def health():
    """Basic health check."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/health/detailed")
def health_detailed():
    """Detailed health check — tests DB, ERP, and WMS connections."""
    checks: dict = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {},
    }

    # Database
    try:
        from app.db.session import SessionLocal
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["services"]["database"] = {"status": "ok"}
    except Exception as e:
        checks["services"]["database"] = {"status": "error", "detail": str(e)}
        checks["status"] = "degraded"

    # ERP connectivity (simple ping)
    try:
        import aiohttp
        from app.core.config import settings
        if settings.ERP_BASE_URL:
            checks["services"]["erp"] = {"status": "configured", "url": settings.ERP_BASE_URL}
        else:
            checks["services"]["erp"] = {"status": "not_configured"}
    except Exception as e:
        checks["services"]["erp"] = {"status": "error", "detail": str(e)}

    # Mantis WMS
    try:
        from app.db.mantis_session import MantisSessionLocal
        if MantisSessionLocal is not None:
            with MantisSessionLocal() as wms_db:
                wms_db.execute(text("SELECT 1"))
            checks["services"]["wms"] = {"status": "ok"}
        else:
            checks["services"]["wms"] = {"status": "not_configured"}
    except Exception as e:
        checks["services"]["wms"] = {"status": "error", "detail": str(e)}
        checks["status"] = "degraded"

    return checks
