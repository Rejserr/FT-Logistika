from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, DateTime, func, Text, UniqueConstraint

from app.db.base import Base


class Regija(Base):
    __tablename__ = "regije"

    id = Column(Integer, primary_key=True, autoincrement=True)
    naziv = Column(String(100), nullable=False)
    opis = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("regije.id"), nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class PostanskiBroj(Base):
    __tablename__ = "postanski_brojevi"

    id = Column(Integer, primary_key=True, autoincrement=True)
    postanski_broj = Column(String(10), nullable=False)
    naziv_mjesta = Column(String(100), nullable=False, server_default="")
    regija_id = Column(Integer, ForeignKey("regije.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())

    __table_args__ = (
        UniqueConstraint("postanski_broj", "naziv_mjesta", name="uq_postanski_brojevi_broj_mjesto"),
    )


class Zona(Base):
    __tablename__ = "zone"

    id = Column(Integer, primary_key=True, autoincrement=True)
    naziv = Column(String(100), nullable=False)
    opis = Column(Text, nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class ZonaIzvor(Base):
    __tablename__ = "zone_izvori"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zona_id = Column(Integer, ForeignKey("zone.id"), nullable=False)
    izvor_tip = Column(String(20), nullable=False)  # depot / store
    izvor_id = Column(Integer, nullable=False)
