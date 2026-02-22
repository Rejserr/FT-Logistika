"""
Logistics models - LogistickaPravila
"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime, Index, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class LogistickaPravila(Base):
    """Logistička pravila za određivanje tipa vozila"""
    __tablename__ = "LogistickaPravila"
    
    pravilo_id = Column(Integer, primary_key=True, autoincrement=True)
    naziv_pravila = Column(String(100), nullable=True)
    regija_id = Column(Integer, ForeignKey("Regije.regija_id"), nullable=True)
    grupa_artikla_uid = Column(String(50), ForeignKey("GrupeArtikala.grupa_artikla_uid"), nullable=True)
    min_masa = Column(Numeric(18, 6), nullable=True)
    max_masa = Column(Numeric(18, 6), nullable=True)
    min_volumen = Column(Numeric(18, 6), nullable=True)
    max_volumen = Column(Numeric(18, 6), nullable=True)
    vozilo_tip = Column(String(20), nullable=False)
    kapacitet = Column(Numeric(18, 6), nullable=True)
    prioritet = Column(Integer, default=100, nullable=False)
    aktivan = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    regija = relationship("Regije", back_populates="logisticka_pravila")
    grupa_artikla = relationship("GrupeArtikala", back_populates="logisticka_pravila")
    
    __table_args__ = (
        CheckConstraint("vozilo_tip IN ('KAMION', 'KOMBI')", name="CK_LogistickaPravila_VoziloTip"),
        Index("IX_LogistickaPravila_Regija", "regija_id"),
        Index("IX_LogistickaPravila_Grupa", "grupa_artikla_uid"),
        Index("IX_LogistickaPravila_Aktivan", "aktivan", "prioritet"),
    )
    
    def __repr__(self):
        return f"<LogistickaPravila(pravilo_id={self.pravilo_id}, naziv='{self.naziv_pravila}', vozilo_tip='{self.vozilo_tip}')>"
