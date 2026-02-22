"""
Logistics API endpoints - LogistickaPravila
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.logistics_models import LogistickaPravila
from app.schemas.logistics_schemas import (
    LogistickaPravilaCreate,
    LogistickaPravilaUpdate,
    LogistickaPravilaResponse
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


@router.get("/rules", response_model=List[LogistickaPravilaResponse])
async def get_logistics_rules(db: Session = Depends(get_db)):
    """Get all logistics rules"""
    rules = db.query(LogistickaPravila).order_by(
        LogistickaPravila.prioritet.desc()
    ).all()
    return [LogistickaPravilaResponse.from_orm(r) for r in rules]


@router.post("/rules", response_model=LogistickaPravilaResponse)
async def create_logistics_rule(
    data: LogistickaPravilaCreate,
    db: Session = Depends(get_db)
):
    """Create new logistics rule"""
    rule = LogistickaPravila(**data.dict())
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return LogistickaPravilaResponse.from_orm(rule)


@router.put("/rules/{pravilo_id}", response_model=LogistickaPravilaResponse)
async def update_logistics_rule(
    pravilo_id: int,
    data: LogistickaPravilaUpdate,
    db: Session = Depends(get_db)
):
    """Update logistics rule"""
    rule = db.query(LogistickaPravila).filter(
        LogistickaPravila.pravilo_id == pravilo_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Update fields
    for key, value in data.dict(exclude_unset=True).items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    
    return LogistickaPravilaResponse.from_orm(rule)


@router.delete("/rules/{pravilo_id}")
async def delete_logistics_rule(
    pravilo_id: int,
    db: Session = Depends(get_db)
):
    """Delete logistics rule"""
    rule = db.query(LogistickaPravila).filter(
        LogistickaPravila.pravilo_id == pravilo_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    db.delete(rule)
    db.commit()
    
    return {"message": "Rule deleted"}


# UI Routes
@ui_router.get("/config/logistics", response_class=HTMLResponse)
async def logistics_ui(request: Request, db: Session = Depends(get_db)):
    """Logistics rules configuration UI"""
    rules = db.query(LogistickaPravila).order_by(
        LogistickaPravila.prioritet.desc()
    ).all()
    
    from app.models.regional_models import Regije
    from app.models.erp_models import GrupeArtikala
    from app.api.regions import RegijaResponse
    
    regije_objects = db.query(Regije).all()
    grupe_objects = db.query(GrupeArtikala).all()
    
    # Convert SQLAlchemy objects to dicts for JSON serialization
    regije = [RegijaResponse.from_orm(r).model_dump() for r in regije_objects]
    grupe = [
        {
            "grupa_artikla_uid": g.grupa_artikla_uid,
            "grupa_artikla": g.grupa_artikla,
            "grupa_artikla_naziv": g.grupa_artikla_naziv
        }
        for g in grupe_objects
    ]
    
    return render_template(
        "config_logistics.html",
        rules=rules,
        regije=regije,
        grupe=grupe
    )
