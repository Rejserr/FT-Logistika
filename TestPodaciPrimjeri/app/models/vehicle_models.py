"""
Vehicle models - Vozila, VozilaRegije
"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime, Table, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# Many-to-many relationship table
vozila_regije = Table(
    'VozilaRegije',
    Base.metadata,
    Column('vozilo_id', Integer, ForeignKey('Vozila.vozilo_id', ondelete='CASCADE'), primary_key=True),
    Column('regija_id', Integer, ForeignKey('Regije.regija_id', ondelete='CASCADE'), primary_key=True),
    Index('IX_VozilaRegije_Vozilo', 'vozilo_id'),
    Index('IX_VozilaRegije_Regija', 'regija_id'),
)


class Vozila(Base):
    """Vozila (kamioni/kombiji) za logističko planiranje"""
    __tablename__ = "Vozila"
    
    vozilo_id = Column(Integer, primary_key=True, autoincrement=True)
    registracija = Column(String(20), unique=True, nullable=False)
    oznaka = Column(String(20), nullable=True)
    tip = Column(String(20), nullable=False)  # KAMION ili KOMBI
    profil_rutiranja = Column(String(50), default='Default', nullable=True)
    masa_kg = Column(Numeric(18, 6), nullable=True)  # Nosivost u kg
    volumen_m3 = Column(Numeric(18, 6), nullable=True)  # Volumen u m³
    paleta = Column(Integer, nullable=True)  # Broj paleta
    aktivan = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    regije = relationship(
        "Regije",
        secondary=vozila_regije,
        back_populates="vozila"
    )
    
    __table_args__ = (
        Index("IX_Vozila_Tip", "tip"),
        Index("IX_Vozila_Aktivan", "aktivan"),
    )
    
    def __repr__(self):
        return f"<Vozila(vozilo_id={self.vozilo_id}, registracija='{self.registracija}', tip='{self.tip}')>"
