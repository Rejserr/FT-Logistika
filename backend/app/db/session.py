from sqlalchemy import create_engine
from collections.abc import Generator

from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import URL

from app.core.config import settings


def get_database_url() -> URL:
    query = {"driver": settings.DB_DRIVER}
    query["Encrypt"] = "yes" if settings.DB_ENCRYPT else "no"
    query["TrustServerCertificate"] = "yes" if settings.DB_TRUST_SERVER_CERTIFICATE else "no"
    return URL.create(
        "mssql+pyodbc",
        username=settings.DB_USERNAME,
        password=settings.DB_PASSWORD,
        host=settings.DB_SERVER,
        database=settings.DB_NAME,
        query=query,
    )


engine = create_engine(get_database_url(), pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
