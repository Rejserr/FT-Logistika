"""
Vehicles API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.vehicle_models import Vozila, vozila_regije
from app.models.regional_models import Regije
from app.schemas.vehicle_schemas import (
    VozilaCreate,
    VozilaUpdate,
    VozilaResponse
)
from typing import List
import os
import json

templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir))
jinja_env.filters['tojson'] = lambda v: json.dumps(v)

def render_template(template_name: str, **kwargs):
    template = jinja_env.get_template(template_name)
    return HTMLResponse(content=template.render(**kwargs))

router = APIRouter()
ui_router = APIRouter()


@router.get("/", response_model=List[VozilaResponse])
async def get_vehicles(
    aktivan: bool = None,
    tip: str = None,
    db: Session = Depends(get_db)
):
    """Get all vehicles, optionally filtered"""
    query = db.query(Vozila)
    
    if aktivan is not None:
        query = query.filter(Vozila.aktivan == aktivan)
    if tip:
        query = query.filter(Vozila.tip == tip)
    
    vehicles = query.order_by(Vozila.registracija).all()
    result = []
    for vehicle in vehicles:
        # Create response without regije first, then add them manually
        response_dict = {
            "vozilo_id": vehicle.vozilo_id,
            "registracija": vehicle.registracija,
            "oznaka": vehicle.oznaka,
            "tip": vehicle.tip,
            "profil_rutiranja": vehicle.profil_rutiranja,
            "masa_kg": float(vehicle.masa_kg) if vehicle.masa_kg else None,
            "volumen_m3": float(vehicle.volumen_m3) if vehicle.volumen_m3 else None,
            "paleta": vehicle.paleta,
            "aktivan": vehicle.aktivan,
            "created_at": vehicle.created_at,
            "updated_at": vehicle.updated_at,
            "regije": [
                {"regija_id": r.regija_id, "naziv_regije": r.naziv_regije}
                for r in vehicle.regije
            ]
        }
        response = VozilaResponse(**response_dict)
        result.append(response)
    return result


@router.post("/", response_model=VozilaResponse)
async def create_vehicle(
    data: VozilaCreate,
    db: Session = Depends(get_db)
):
    """Create new vehicle"""
    # Check if registracija already exists
    existing = db.query(Vozila).filter(Vozila.registracija == data.registracija).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle with this registration already exists")
    
    vehicle = Vozila(
        registracija=data.registracija,
        oznaka=data.oznaka,
        tip=data.tip,
        profil_rutiranja=data.profil_rutiranja,
        masa_kg=data.masa_kg,
        volumen_m3=data.volumen_m3,
        paleta=data.paleta,
        aktivan=data.aktivan
    )
    
    # Add regije if specified
    if data.regija_ids:
        regije = db.query(Regije).filter(Regije.regija_id.in_(data.regija_ids)).all()
        vehicle.regije = regije
    
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    
    # Reload regije relationship
    db.refresh(vehicle)
    
    # Create response without regije first, then add them manually
    response_dict = {
        "vozilo_id": vehicle.vozilo_id,
        "registracija": vehicle.registracija,
        "oznaka": vehicle.oznaka,
        "tip": vehicle.tip,
        "profil_rutiranja": vehicle.profil_rutiranja,
        "masa_kg": float(vehicle.masa_kg) if vehicle.masa_kg else None,
        "volumen_m3": float(vehicle.volumen_m3) if vehicle.volumen_m3 else None,
        "paleta": vehicle.paleta,
        "aktivan": vehicle.aktivan,
        "created_at": vehicle.created_at,
        "updated_at": vehicle.updated_at,
        "regije": [
            {"regija_id": r.regija_id, "naziv_regije": r.naziv_regije}
            for r in vehicle.regije
        ]
    }
    response = VozilaResponse(**response_dict)
    return response


@router.put("/{vozilo_id}", response_model=VozilaResponse)
async def update_vehicle(
    vozilo_id: int,
    data: VozilaUpdate,
    db: Session = Depends(get_db)
):
    """Update vehicle"""
    vehicle = db.query(Vozila).filter(Vozila.vozilo_id == vozilo_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Update fields
    if data.registracija is not None:
        # Check if new registracija already exists
        existing = db.query(Vozila).filter(
            Vozila.registracija == data.registracija,
            Vozila.vozilo_id != vozilo_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Vehicle with this registration already exists")
        vehicle.registracija = data.registracija
    
    if data.oznaka is not None:
        vehicle.oznaka = data.oznaka
    if data.tip is not None:
        vehicle.tip = data.tip
    if data.profil_rutiranja is not None:
        vehicle.profil_rutiranja = data.profil_rutiranja
    if data.masa_kg is not None:
        vehicle.masa_kg = data.masa_kg
    if data.volumen_m3 is not None:
        vehicle.volumen_m3 = data.volumen_m3
    if data.paleta is not None:
        vehicle.paleta = data.paleta
    if data.aktivan is not None:
        vehicle.aktivan = data.aktivan
    
    # Update regije if specified
    if data.regija_ids is not None:
        regije = db.query(Regije).filter(Regije.regija_id.in_(data.regija_ids)).all()
        vehicle.regije = regije
    
    db.commit()
    db.refresh(vehicle)
    
    # Reload regije relationship
    db.refresh(vehicle)
    
    # Create response without regije first, then add them manually
    response_dict = {
        "vozilo_id": vehicle.vozilo_id,
        "registracija": vehicle.registracija,
        "oznaka": vehicle.oznaka,
        "tip": vehicle.tip,
        "profil_rutiranja": vehicle.profil_rutiranja,
        "masa_kg": float(vehicle.masa_kg) if vehicle.masa_kg else None,
        "volumen_m3": float(vehicle.volumen_m3) if vehicle.volumen_m3 else None,
        "paleta": vehicle.paleta,
        "aktivan": vehicle.aktivan,
        "created_at": vehicle.created_at,
        "updated_at": vehicle.updated_at,
        "regije": [
            {"regija_id": r.regija_id, "naziv_regije": r.naziv_regije}
            for r in vehicle.regije
        ]
    }
    response = VozilaResponse(**response_dict)
    return response


@router.delete("/{vozilo_id}")
async def delete_vehicle(
    vozilo_id: int,
    db: Session = Depends(get_db)
):
    """Delete vehicle"""
    vehicle = db.query(Vozila).filter(Vozila.vozilo_id == vozilo_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted"}


# UI Routes
@ui_router.get("/config/vehicles", response_class=HTMLResponse)
async def vehicles_ui(request: Request, db: Session = Depends(get_db)):
    """Vehicles configuration UI"""
    vehicles = db.query(Vozila).order_by(Vozila.registracija).all()
    regije = db.query(Regije).all()
    
    # Convert to dicts for JSON serialization
    from app.api.regions import RegijaResponse
    vehicles_data = []
    for v in vehicles:
        vehicle_dict = {
            "vozilo_id": v.vozilo_id,
            "registracija": v.registracija,
            "oznaka": v.oznaka,
            "tip": v.tip,
            "profil_rutiranja": v.profil_rutiranja,
            "masa_kg": float(v.masa_kg) if v.masa_kg else None,
            "volumen_m3": float(v.volumen_m3) if v.volumen_m3 else None,
            "paleta": v.paleta,
            "aktivan": v.aktivan,
            "regije": [{"regija_id": r.regija_id, "naziv_regije": r.naziv_regije} for r in v.regije]
        }
        vehicles_data.append(vehicle_dict)
    
    regije_data = [RegijaResponse.from_orm(r).model_dump() for r in regije]
    
    return render_template(
        "config_vehicles.html",
        vehicles=vehicles_data,
        regije=regije_data
    )
