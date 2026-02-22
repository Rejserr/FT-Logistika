from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, func, Text

from app.db.base import Base


class VoziloTip(Base):
    __tablename__ = "vozila_tip"

    id = Column(Integer, primary_key=True, autoincrement=True)
    naziv = Column(String(100), nullable=False)
    opis = Column(Text, nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class Vozilo(Base):
    __tablename__ = "vozila"

    id = Column(Integer, primary_key=True, autoincrement=True)
    oznaka = Column(String(50), nullable=True)
    naziv = Column(String(100), nullable=True)
    registracija = Column(String(20), nullable=True)
    tip_id = Column(Integer, ForeignKey("vozila_tip.id"), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("skladista.id"), nullable=True)
    nosivost_kg = Column(Numeric(18, 3), nullable=True)
    volumen_m3 = Column(Numeric(18, 6), nullable=True)
    profil_rutiranja = Column(String(200), nullable=True)
    paleta = Column(Integer, nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class Vozac(Base):
    __tablename__ = "vozaci"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ime = Column(String(100), nullable=False)
    prezime = Column(String(100), nullable=False)
    telefon = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("skladista.id"), nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())
