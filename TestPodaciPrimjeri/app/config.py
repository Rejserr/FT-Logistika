"""
Application configuration using Pydantic Settings
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database
    DB_SERVER: str = "localhost"
    DB_NAME: str = "OptimoRout"
    DB_USERNAME: str = "sa"
    DB_PASSWORD: str = ""
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    
    # ERP
    ERP_BASE_URL: str = "http://10.10.2.203:3616"
    ERP_USERNAME: str = "mantis.api"
    ERP_PASSWORD: str = "m&#e;PA$HD"
    
    # Sync
    SYNC_CONCURRENCY: int = 10
    SYNC_INTERVAL_MINUTES: int = 20
    ARTIKLI_SYNC_HOUR: int = 2
    ARTIKLI_SYNC_MINUTE: int = 0
    
    # Application
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # OptimoRoute API
    OPTIMO_API_BASE_URL: str = "https://api.optimoroute.com/v1"
    OPTIMO_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
