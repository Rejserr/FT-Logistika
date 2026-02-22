"""
Pydantic schemas for vehicle models
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VozilaBase(BaseModel):
    registracija: str
    oznaka: Optional[str] = None
    tip: str  # KAMION ili KOMBI
    profil_rutiranja: Optional[str] = "Default"
    masa_kg: Optional[float] = None
    volumen_m3: Optional[float] = None
    paleta: Optional[int] = None
    aktivan: bool = True


class VozilaCreate(VozilaBase):
    regija_ids: Optional[List[int]] = []  # Lista regija za dodjelu


class VozilaUpdate(BaseModel):
    registracija: Optional[str] = None
    oznaka: Optional[str] = None
    tip: Optional[str] = None
    profil_rutiranja: Optional[str] = None
    masa_kg: Optional[float] = None
    volumen_m3: Optional[float] = None
    paleta: Optional[int] = None
    aktivan: Optional[bool] = None
    regija_ids: Optional[List[int]] = None


class VozilaResponse(VozilaBase):
    vozilo_id: int
    regije: List[dict] = []  # Lista regija s kojima je vozilo povezano
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
