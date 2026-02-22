from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, func

from app.db.base import Base


class Prioritet(Base):
    __tablename__ = "prioriteti"

    id = Column(Integer, primary_key=True, autoincrement=True)
    naziv = Column(String(100), nullable=False)
    tezina = Column(Integer, nullable=False, server_default="0")
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)


class RefreshLog(Base):
    __tablename__ = "refresh_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sync_log_id = Column(Integer, nullable=True)
    nalog_prodaje_uid = Column(String(50), nullable=False)
    partner_uid = Column(String(50), nullable=True)
    tip = Column(String(20), nullable=False)  # 'HEADER' ili 'PARTNER'
    polja_promijenjena = Column(Text, nullable=True)   # JSON
    stare_vrijednosti = Column(Text, nullable=True)     # JSON
    nove_vrijednosti = Column(Text, nullable=True)      # JSON
    created_at = Column(DateTime, server_default=func.getutcdate())


class Status(Base):
    __tablename__ = "statusi"

    id = Column(String(10), primary_key=True)
    naziv = Column(String(100), nullable=False)
    opis = Column(String(500), nullable=True)
    redoslijed = Column(Integer, nullable=False, server_default="0")
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class SyncStatus(Base):
    """Statusi naloga koji se sinkroniziraju iz ERP-a."""
    __tablename__ = "sync_statusi"

    id = Column(Integer, primary_key=True, autoincrement=True)
    status_id = Column(String(10), nullable=False, unique=True)
    naziv = Column(String(100), nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())
