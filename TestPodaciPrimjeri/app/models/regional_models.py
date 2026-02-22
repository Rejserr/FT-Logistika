"""
Regional models - Regije, PostanskiBrojevi
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Regije(Base):
    """Regije za logističko planiranje"""
    __tablename__ = "Regije"
    
    regija_id = Column(Integer, primary_key=True, autoincrement=True)
    naziv_regije = Column(String(100), unique=True, nullable=False)
    opis = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    postanski_brojevi = relationship("PostanskiBrojevi", back_populates="regija")
    nalozi = relationship("NaloziHeader", back_populates="regija")
    logisticka_pravila = relationship("LogistickaPravila", back_populates="regija")
    vozila = relationship(
        "Vozila",
        secondary="VozilaRegije",
        back_populates="regije"
    )
    
    def __repr__(self):
        return f"<Regije(regija_id={self.regija_id}, naziv='{self.naziv_regije}')>"


class PostanskiBrojevi(Base):
    """Poštanski brojevi s mapiranjem na regije"""
    __tablename__ = "PostanskiBrojevi"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    postanski_broj = Column(String(20), nullable=False)
    mjesto = Column(String(255), nullable=True)
    regija_id = Column(Integer, ForeignKey("Regije.regija_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    regija = relationship("Regije", back_populates="postanski_brojevi")
    
    __table_args__ = (
        Index("IX_PostanskiBrojevi_Regija", "regija_id"),
        Index("IX_PostanskiBrojevi_PostanskiBroj", "postanski_broj"),
        Index("IX_PostanskiBrojevi_Unique", "postanski_broj", "mjesto", unique=True),
    )
    
    def __repr__(self):
        return f"<PostanskiBrojevi(id={self.id}, postanski_broj='{self.postanski_broj}', mjesto='{self.mjesto}')>"
