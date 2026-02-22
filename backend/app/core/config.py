from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DB_SERVER: str = "localhost"
    DB_NAME: str = "FTLogistika"
    DB_USERNAME: str = "sa"
    DB_PASSWORD: str = ""
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_ENCRYPT: bool = True
    DB_TRUST_SERVER_CERTIFICATE: bool = True

    # ERP
    ERP_BASE_URL: str = "http://10.10.2.203:3616"
    ERP_USERNAME: str = ""
    ERP_PASSWORD: str = ""

    # App
    SECRET_KEY: str = "change-me"
    DEBUG: bool = False

    # JWT Auth
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REMEMBER_ME_EXPIRE_DAYS: int = 30
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Cache
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # Sync
    SYNC_CONCURRENCY: int = 10
    SYNC_INTERVAL_MINUTES: int = 20
    ARTIKLI_SYNC_HOUR: int = 2
    ARTIKLI_SYNC_MINUTE: int = 0

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = ""

    # OpenRouteService
    ORS_API_KEY: str = ""

    # Routing
    DEFAULT_SERVICE_TIME_MINUTES: int = 10
    MAX_STOPS_PER_ROUTE: int = 30

    # TomTom
    TOMTOM_API_KEY: str = ""

    # Mantis WMS (LVision) Database
    MANTIS_DB_SERVER: str = ""
    MANTIS_DB_NAME: str = "LVision"
    MANTIS_DB_USERNAME: str = "mantis"
    MANTIS_DB_PASSWORD: str = ""
    MANTIS_DB_DRIVER: str = "ODBC Driver 17 for SQL Server"


settings = Settings()
