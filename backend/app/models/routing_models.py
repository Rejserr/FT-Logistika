from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Numeric, Text, func

from app.db.base import Base


class Ruta(Base):
    __tablename__ = "rute"

    id = Column(Integer, primary_key=True, autoincrement=True)
    datum = Column(Date, nullable=False)
    raspored = Column(Date, nullable=True)
    status = Column(String(30), nullable=True)
    algoritam = Column(String(50), nullable=True)
    vozilo_id = Column(Integer, ForeignKey("vozila.id"), nullable=True)
    vozac_id = Column(Integer, ForeignKey("vozaci.id"), nullable=True)
    driver_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    driver_name = Column(String(200), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("skladista.id"), nullable=True)
    izvor_tip = Column(String(20), nullable=True)
    izvor_id = Column(Integer, nullable=True)
    distance_km = Column(Numeric(18, 3), nullable=True)
    duration_min = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class RutaStop(Base):
    __tablename__ = "rute_stops"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ruta_id = Column(Integer, ForeignKey("rute.id"), nullable=False)
    nalog_uid = Column(String(50), nullable=False)  # FK uklonjen jer se nalozi brisu iz originala
    redoslijed = Column(Integer, nullable=False)
    eta = Column(DateTime, nullable=True)
    status = Column(String(30), nullable=True)


class RutaPolyline(Base):
    __tablename__ = "rute_polylines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ruta_id = Column(Integer, ForeignKey("rute.id"), nullable=False)
    polyline = Column(Text, nullable=False)
    distance_km = Column(Numeric(18, 3), nullable=True)
    duration_min = Column(Integer, nullable=True)
