"""
Regions API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.regional_models import Regije, PostanskiBrojevi
from app.services.region_service import RegionService
from pydantic import BaseModel
from typing import List, Optional
import os

templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir))

def render_template(template_name: str, **kwargs):
    template = jinja_env.get_template(template_name)
    return HTMLResponse(content=template.render(**kwargs))

router = APIRouter()
ui_router = APIRouter()


class RegijaCreate(BaseModel):
    naziv_regije: str
    opis: Optional[str] = None


class RegijaUpdate(BaseModel):
    naziv_regije: Optional[str] = None
    opis: Optional[str] = None


class RegijaResponse(BaseModel):
    regija_id: int
    naziv_regije: str
    opis: Optional[str]
    
    class Config:
        from_attributes = True


class PostanskiBrojResponse(BaseModel):
    postanski_broj: str
    mjesto: Optional[str]
    regija_id: Optional[int]
    regija_naziv: Optional[str] = None
    
    class Config:
        from_attributes = True


class PostanskiBrojUpdate(BaseModel):
    regija_id: Optional[int] = None


class PostanskiBrojCreate(BaseModel):
    postanski_broj: str
    mjesto: Optional[str] = None
    regija_id: Optional[int] = None


@router.get("/", response_model=List[RegijaResponse])
async def get_regions(db: Session = Depends(get_db)):
    """Get all regions"""
    regije = db.query(Regije).all()
    return [RegijaResponse.from_orm(r) for r in regije]


@router.post("/", response_model=RegijaResponse)
async def create_region(
    data: RegijaCreate,
    db: Session = Depends(get_db)
):
    """Create new region"""
    # Check if exists
    existing = db.query(Regije).filter(
        Regije.naziv_regije == data.naziv_regije
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Region already exists")
    
    regija = Regije(
        naziv_regije=data.naziv_regije,
        opis=data.opis
    )
    
    db.add(regija)
    db.commit()
    db.refresh(regija)
    
    return RegijaResponse.from_orm(regija)


@router.put("/{regija_id}", response_model=RegijaResponse)
async def update_region(
    regija_id: int,
    data: RegijaUpdate,
    db: Session = Depends(get_db)
):
    """Update region"""
    regija = db.query(Regije).filter(
        Regije.regija_id == regija_id
    ).first()
    
    if not regija:
        raise HTTPException(status_code=404, detail="Region not found")
    
    if data.naziv_regije is not None:
        regija.naziv_regije = data.naziv_regije
    if data.opis is not None:
        regija.opis = data.opis
    
    db.commit()
    db.refresh(regija)
    
    return RegijaResponse.from_orm(regija)


@router.delete("/{regija_id}")
async def delete_region(
    regija_id: int,
    db: Session = Depends(get_db)
):
    """Delete region"""
    regija = db.query(Regije).filter(
        Regije.regija_id == regija_id
    ).first()
    
    if not regija:
        raise HTTPException(status_code=404, detail="Region not found")
    
    db.delete(regija)
    db.commit()
    
    return {"message": "Region deleted"}


@router.get("/postal-codes", response_model=List[PostanskiBrojResponse])
async def get_postal_codes(
    regija_id: Optional[int] = None,
    only_without_region: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    """Get postal codes, opcionalno filtrirano po regiji ili samo bez regije"""
    # Use JOIN to get postal codes with regija in one query (avoid N+1 problem)
    from sqlalchemy.orm import joinedload
    
    query = db.query(PostanskiBrojevi).options(joinedload(PostanskiBrojevi.regija))
    
    if regija_id:
        query = query.filter(PostanskiBrojevi.regija_id == regija_id)
    elif only_without_region:
        query = query.filter(PostanskiBrojevi.regija_id.is_(None))
    
    postal_codes = query.all()
    result = []
    for postal in postal_codes:
        response = PostanskiBrojResponse.from_orm(postal)
        # Get regija naziv from loaded relationship (no additional query needed)
        if postal.regija:
            response.regija_naziv = postal.regija.naziv_regije
        result.append(response)
    return result


@router.put("/postal-codes/{postanski_broj}")
async def update_postal_code_region(
    postanski_broj: str,
    data: PostanskiBrojUpdate,
    db: Session = Depends(get_db)
):
    """Update postal code region mapping"""
    clean_postal = RegionService.normalize_postal_code(postanski_broj)
    if not clean_postal:
        raise HTTPException(status_code=400, detail="Neispravan poštanski broj")
    postal = db.query(PostanskiBrojevi).filter(
        PostanskiBrojevi.postanski_broj == clean_postal
    ).first()
    
    if not postal:
        raise HTTPException(status_code=404, detail="Postal code not found")
    
    postal.regija_id = data.regija_id
    db.commit()
    
    return {"message": "Postal code updated"}


@router.post("/postal-codes", response_model=PostanskiBrojResponse)
async def create_postal_code(
    data: PostanskiBrojCreate,
    db: Session = Depends(get_db)
):
    """
    Ručni unos novog poštanskog broja i opcionalno dodjeljivanje regije.
    Ako kombinacija (postanski_broj, mjesto) već postoji, vraća 400.
    """
    # Provjeri postoji li već isti poštanski broj + mjesto
    clean_postal = RegionService.normalize_postal_code(data.postanski_broj)
    if not clean_postal:
        raise HTTPException(status_code=400, detail="Neispravan poštanski broj")
    
    existing = db.query(PostanskiBrojevi).filter(
        PostanskiBrojevi.postanski_broj == clean_postal,
        PostanskiBrojevi.mjesto == (data.mjesto.strip() if data.mjesto else None)
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Poštanski broj za to mjesto već postoji")
    
    postal = PostanskiBrojevi(
        postanski_broj=clean_postal,
        mjesto=data.mjesto.strip() if data.mjesto else None,
        regija_id=data.regija_id
    )
    
    db.add(postal)
    db.commit()
    db.refresh(postal)
    
    response = PostanskiBrojResponse.from_orm(postal)
    if postal.regija_id:
        regija = db.query(Regije).filter(Regije.regija_id == postal.regija_id).first()
        if regija:
            response.regija_naziv = regija.naziv_regije
    
    return response


# UI Routes
@ui_router.get("/config/regions", response_class=HTMLResponse)
async def regions_ui(request: Request, db: Session = Depends(get_db)):
    """Regions configuration UI"""
    regije = db.query(Regije).all()
    return render_template(
        "config_regions.html",
        regije=regije
    )


@ui_router.get("/config/postal-codes", response_class=HTMLResponse)
async def postal_codes_ui(request: Request, db: Session = Depends(get_db)):
    """Postal codes configuration UI"""
    regije = db.query(Regije).all()
    return render_template(
        "config_postal.html",
        regije=regije
    )
