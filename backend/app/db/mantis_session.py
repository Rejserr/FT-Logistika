"""
Read-only konekcija prema Mantis WMS (LVision) SQL Serveru.

Koristi se iskljucivo za citanje podataka iz WMS view-a
v_CST_OrderProgress.  Nikada ne pisemo u Mantis bazu.
"""
from __future__ import annotations

import logging
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_mantis_database_url() -> URL:
    """Kreiraj SQLAlchemy URL za Mantis DB konekciju."""
    query = {
        "driver": settings.MANTIS_DB_DRIVER,
        "Encrypt": "no",
        "TrustServerCertificate": "yes",
    }
    return URL.create(
        "mssql+pyodbc",
        username=settings.MANTIS_DB_USERNAME,
        password=settings.MANTIS_DB_PASSWORD,
        host=settings.MANTIS_DB_SERVER,
        database=settings.MANTIS_DB_NAME,
        query=query,
    )


def _create_mantis_engine():
    """Lazy kreiranje engine-a — ne pada ako Mantis server nije dostupan."""
    if not settings.MANTIS_DB_SERVER:
        logger.warning("MANTIS_DB_SERVER nije konfiguriran — WMS integracija nedostupna")
        return None
    try:
        eng = create_engine(
            get_mantis_database_url(),
            pool_pre_ping=True,
            pool_size=3,
            max_overflow=2,
            pool_recycle=300,
            future=True,
        )
        return eng
    except Exception as exc:
        logger.error("Greška pri kreiranju Mantis engine-a: %s", exc)
        return None


mantis_engine = _create_mantis_engine()

MantisSessionLocal = (
    sessionmaker(bind=mantis_engine, autoflush=False, autocommit=False, future=True)
    if mantis_engine
    else None
)


def get_mantis_db() -> Generator[Session, None, None]:
    """FastAPI dependency za Mantis DB sesiju (read-only)."""
    if MantisSessionLocal is None:
        raise RuntimeError("Mantis WMS konekcija nije konfigurirana")
    db = MantisSessionLocal()
    try:
        yield db
    finally:
        db.close()
