from sqlalchemy import Column, String, Integer, DateTime, Text, Numeric, func

from app.db.base import Base


class SyncLog(Base):
    __tablename__ = "sync_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    message = Column(Text, nullable=True)
    started_at = Column(DateTime, server_default=func.getutcdate())
    finished_at = Column(DateTime, nullable=True)


class GeocodingCache(Base):
    __tablename__ = "geocoding_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    address_hash = Column(String(64), unique=True, nullable=False)
    address = Column(Text, nullable=False)
    lat = Column(Numeric(18, 8), nullable=True)
    lng = Column(Numeric(18, 8), nullable=True)
    provider = Column(String(50), nullable=True)
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class DistanceMatrixCache(Base):
    __tablename__ = "distance_matrix_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    origin_hash = Column(String(64), nullable=False)
    dest_hash = Column(String(64), nullable=False)
    distance_m = Column(Integer, nullable=True)
    duration_s = Column(Integer, nullable=True)
    provider = Column(String(50), nullable=True)
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())
