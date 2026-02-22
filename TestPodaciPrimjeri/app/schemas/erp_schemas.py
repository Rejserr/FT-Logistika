"""
Pydantic schemas for ERP models
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class NalogHeaderBase(BaseModel):
    nalog_prodaje_uid: str
    broj: Optional[int] = None
    datum: Optional[date] = None
    raspored: Optional[date] = None
    partner: Optional[str] = None
    vrsta_isporuke: str
    status: Optional[str] = None
    regija_id: Optional[int] = None
    vozilo_tip: Optional[str] = None
    total_weight: Optional[float] = None
    total_volume: Optional[float] = None


class NalogHeaderResponse(NalogHeaderBase):
    partner_naziv: Optional[str] = None
    partner_mjesto: Optional[str] = None
    partner_postanski_broj: Optional[str] = None
    partner_adresa: Optional[str] = None
    regija_naziv: Optional[str] = None
    skladiste: Optional[str] = None
    narudzba: Optional[str] = None
    valuta: Optional[str] = None
    tecaj: Optional[float] = None
    generalni_rabat: Optional[str] = None
    na_uvid: Optional[str] = None
    referenca_isporuke: Optional[str] = None
    kupac_placa_isporuku: Optional[str] = None
    komercijalist__radnik: Optional[str] = None
    dostavljac__radnik: Optional[str] = None
    kreirao__radnik: Optional[str] = None
    sent_to_optimo: Optional[bool] = False  # Da li je nalog poslan u OptimoRoute
    
    class Config:
        from_attributes = True


class NalogDetailResponse(NalogHeaderResponse):
    stavke: List[dict] = []
    optimo_payload: Optional[dict] = None


class OrderFilter(BaseModel):
    prikazi_poslane: Optional[bool] = False  # Default: sakri poslane naloge
    datum_od: Optional[date] = None
    datum_do: Optional[date] = None
    regija_id: Optional[int] = None
    bez_regije: Optional[bool] = False
    vozilo_tip: Optional[str] = None
    vrsta_isporuke: Optional[str] = None
    partner_search: Optional[str] = None
    sort_by: Optional[str] = None  # Column name for sorting
    sort_order: Optional[str] = "desc"  # "asc" or "desc"
    page: int = 1
    page_size: int = 50
