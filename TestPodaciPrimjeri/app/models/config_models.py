"""
Configuration models - AllowedDeliveryTypes, GrupeArtikalaConfig
"""
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class AllowedDeliveryTypes(Base):
    """Dozvoljene vrste isporuke za filtriranje naloga"""
    __tablename__ = "AllowedDeliveryTypes"
    
    vrsta_isporuke = Column(String(50), primary_key=True)
    opis = Column(String(255), nullable=True)
    aktivan = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<AllowedDeliveryTypes(vrsta_isporuke='{self.vrsta_isporuke}', aktivan={self.aktivan})>"


class GrupeArtikalaConfig(Base):
    """Konfiguracija grupa artikala - kriteriji za slanje u OptimoRoute"""
    __tablename__ = "GrupeArtikalaConfig"
    
    grupa_artikla_naziv = Column(String(255), primary_key=True)
    salje_se_u_optimo = Column(Boolean, default=True, nullable=False)
    opis = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<GrupeArtikalaConfig(grupa_artikla_naziv='{self.grupa_artikla_naziv}', salje_se_u_optimo={self.salje_se_u_optimo})>"
