"""
Pydantic schemas for logistics models
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LogistickaPravilaBase(BaseModel):
    naziv_pravila: Optional[str] = None
    regija_id: Optional[int] = None
    grupa_artikla_uid: Optional[str] = None
    min_masa: Optional[float] = None
    max_masa: Optional[float] = None
    min_volumen: Optional[float] = None
    max_volumen: Optional[float] = None
    vozilo_tip: str
    kapacitet: Optional[float] = None
    prioritet: int = 100
    aktivan: bool = True


class LogistickaPravilaCreate(LogistickaPravilaBase):
    pass


class LogistickaPravilaUpdate(BaseModel):
    naziv_pravila: Optional[str] = None
    regija_id: Optional[int] = None
    grupa_artikla_uid: Optional[str] = None
    min_masa: Optional[float] = None
    max_masa: Optional[float] = None
    min_volumen: Optional[float] = None
    max_volumen: Optional[float] = None
    vozilo_tip: Optional[str] = None
    kapacitet: Optional[float] = None
    prioritet: Optional[int] = None
    aktivan: Optional[bool] = None


class LogistickaPravilaResponse(LogistickaPravilaBase):
    pravilo_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
