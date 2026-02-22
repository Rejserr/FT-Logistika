"""
SQLAlchemy database setup for SQL Server
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import urllib.parse
import logging

logger = logging.getLogger(__name__)

# Build connection string for SQL Server with named instance
# For named instance without Browser service, use TCP/IP protocol
server = settings.DB_SERVER

# Build ODBC connection string with TCP/IP protocol
# This works even when SQL Server Browser is disabled
odbc_params = (
    f"DRIVER={{{settings.DB_DRIVER}}};"
    f"SERVER={server};"
    f"DATABASE={settings.DB_NAME};"
    f"UID={settings.DB_USERNAME};"
    f"PWD={settings.DB_PASSWORD};"
    "TrustServerCertificate=yes;"
    "Network Library=DBMSSOCN;"  # Force TCP/IP instead of Named Pipes
)

# URL encode the connection string
params = urllib.parse.quote_plus(odbc_params)
connection_string = f"mssql+pyodbc:///?odbc_connect={params}"

# Log connection info (without password)
if settings.DEBUG:
    logger.info(f"Connecting to SQL Server: {server}, Database: {settings.DB_NAME}")

# Create engine
try:
    engine = create_engine(
        connection_string,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=settings.DEBUG,
        connect_args={"timeout": 30}
    )
except Exception as e:
    logger.error(f"Error creating database engine: {e}")
    raise

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
