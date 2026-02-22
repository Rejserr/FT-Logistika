"""
Configuration API endpoints - AllowedDeliveryTypes
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.config_models import AllowedDeliveryTypes, GrupeArtikalaConfig
from app.models.erp_models import GrupeArtikala
from app.models.erp_models import NaloziHeader, Partneri, PartneriAtributi
from app.services.erp_client import get_erp_client
from app.config import settings
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir))

def render_template(template_name: str, **kwargs):
    template = jinja_env.get_template(template_name)
    return HTMLResponse(content=template.render(**kwargs))

router = APIRouter()
ui_router = APIRouter()


class DeliveryTypeCreate(BaseModel):
    vrsta_isporuke: str
    opis: Optional[str] = None
    aktivan: bool = True


class DeliveryTypeUpdate(BaseModel):
    opis: Optional[str] = None
    aktivan: Optional[bool] = None


class DeliveryTypeResponse(BaseModel):
    vrsta_isporuke: str
    opis: Optional[str]
    aktivan: bool
    
    class Config:
        from_attributes = True


@router.get("/delivery-types", response_model=List[DeliveryTypeResponse])
async def get_delivery_types(db: Session = Depends(get_db)):
    """Get all allowed delivery types"""
    types = db.query(AllowedDeliveryTypes).all()
    return [DeliveryTypeResponse.from_orm(t) for t in types]


@router.post("/delivery-types", response_model=DeliveryTypeResponse)
async def create_delivery_type(
    data: DeliveryTypeCreate,
    db: Session = Depends(get_db)
):
    """Create new allowed delivery type"""
    # Check if exists
    existing = db.query(AllowedDeliveryTypes).filter(
        AllowedDeliveryTypes.vrsta_isporuke == data.vrsta_isporuke
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Delivery type already exists")
    
    delivery_type = AllowedDeliveryTypes(
        vrsta_isporuke=data.vrsta_isporuke,
        opis=data.opis,
        aktivan=data.aktivan
    )
    
    db.add(delivery_type)
    db.commit()
    db.refresh(delivery_type)
    
    return DeliveryTypeResponse.from_orm(delivery_type)


@router.put("/delivery-types/{vrsta_isporuke}", response_model=DeliveryTypeResponse)
async def update_delivery_type(
    vrsta_isporuke: str,
    data: DeliveryTypeUpdate,
    db: Session = Depends(get_db)
):
    """Update delivery type"""
    delivery_type = db.query(AllowedDeliveryTypes).filter(
        AllowedDeliveryTypes.vrsta_isporuke == vrsta_isporuke
    ).first()
    
    if not delivery_type:
        raise HTTPException(status_code=404, detail="Delivery type not found")
    
    if data.opis is not None:
        delivery_type.opis = data.opis
    if data.aktivan is not None:
        delivery_type.aktivan = data.aktivan
    
    db.commit()
    db.refresh(delivery_type)
    
    return DeliveryTypeResponse.from_orm(delivery_type)


@router.delete("/delivery-types/{vrsta_isporuke}")
async def delete_delivery_type(
    vrsta_isporuke: str,
    db: Session = Depends(get_db)
):
    """Delete delivery type"""
    delivery_type = db.query(AllowedDeliveryTypes).filter(
        AllowedDeliveryTypes.vrsta_isporuke == vrsta_isporuke
    ).first()
    
    if not delivery_type:
        raise HTTPException(status_code=404, detail="Delivery type not found")
    
    db.delete(delivery_type)
    db.commit()
    
    return {"message": "Delivery type deleted"}


@router.post("/sync/artikli")
async def manual_sync_artikli(
    start_offset: int = Query(0, description="Offset od kojeg počinje sinkronizacija"),
    db: Session = Depends(get_db)
):
    """
    Manual sync artikli from ERP
    This will sync all artikli and grupe artikala from ERP
    
    Args:
        start_offset: Offset od kojeg počinje sinkronizacija (za nastavak od određenog mjesta)
    """
    from app.schedulers.sync_scheduler import sync_artikli
    
    try:
        await sync_artikli(start_offset=start_offset)
        return {
            "message": "Artikli sync completed successfully",
            "status": "success",
            "start_offset": start_offset
        }
    except Exception as e:
        logger.error(f"Error in manual artikli sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/partneri")
async def manual_sync_partneri(
    only_missing: bool = Query(True, description="Sinkronizirati samo partnere koji nedostaju ili nemaju naziv"),
    db: Session = Depends(get_db)
):
    """
    Ručna sinkronizacija partnera iz ERP-a na temelju naloga.
    
    - Pronalazi šifre partnera iz naloga
    - Za one koji nemaju partner zapis ili im je naziv prazan, povlači podatke iz ERP-a
    - Ako je naziv prazan, sastavlja ga iz ime + prezime
    """
    erp_client = get_erp_client()
    
    try:
        # Prikupi šifre partnera koje treba osvježiti
        needed_sifre = set()
        
        # Učitaj sve naloge gdje postoji šifra partnera
        nalozi = db.query(NaloziHeader).filter(
            NaloziHeader.partner.isnot(None)
        ).all()
        
        for nalog in nalozi:
            partner_sifra = nalog.partner
            if not partner_sifra:
                continue
            
            partner_obj = None
            if nalog.partner_uid:
                partner_obj = db.query(Partneri).filter(
                    Partneri.partner_uid == nalog.partner_uid
                ).first()
            
            if only_missing:
                # Treba sync ako partner ne postoji ili nema naziv
                if (not partner_obj) or (not (partner_obj.naziv and partner_obj.naziv.strip())):
                    needed_sifre.add(partner_sifra)
            else:
                needed_sifre.add(partner_sifra)
        
        if not needed_sifre:
            return {
                "message": "Nema partnera za sinkronizaciju",
                "status": "ok",
                "updated_partners": 0,
                "total_sifre": 0
            }
        
        logger.info(f"Pokrećem sinkronizaciju partnera za {len(needed_sifre)} šifri")
        
        # Dohvati partnere iz ERP-a
        erp_client_instance = erp_client
        partner_map = await erp_client_instance.fetch_multiple_partners(
            list(needed_sifre),
            max_concurrent=settings.SYNC_CONCURRENCY
        )
        
        updated_count = 0
        
        for partner_sifra, partner_data in partner_map.items():
            if not partner_data:
                continue
            
            partner_uid = partner_data.get("partner_uid")
            if not partner_uid:
                continue
            
            # Upsert Partneri
            partner = db.query(Partneri).filter(
                Partneri.partner_uid == partner_uid
            ).first()
            
            if not partner:
                partner = Partneri(partner_uid=partner_uid)
                db.add(partner)
            
            # Update polja partnera
            for key, value in partner_data.items():
                if hasattr(partner, key) and key != "partner_uid" and key != "atributi":
                    if key == "naziv":
                        if (not value or not str(value).strip()) and (
                            partner_data.get("ime") or partner_data.get("prezime")
                        ):
                            ime = partner_data.get("ime") or ""
                            prezime = partner_data.get("prezime") or ""
                            value = f"{ime} {prezime}".strip()
                    setattr(partner, key, value)
            
            db.flush()
            
            # Atributi
            if "atributi" in partner_data:
                db.query(PartneriAtributi).filter(
                    PartneriAtributi.partner_uid == partner_uid
                ).delete()
                
                for atribut_data in partner_data.get("atributi", []):
                    atribut = PartneriAtributi(partner_uid=partner_uid)
                    for key, value in atribut_data.items():
                        if hasattr(atribut, key) and key != "partner_uid":
                            setattr(atribut, key, value)
                    db.add(atribut)
            
            updated_count += 1
        
        db.commit()
        
        return {
            "message": "Partneri sync completed successfully",
            "status": "success",
            "updated_partners": updated_count,
            "total_sifre": len(needed_sifre)
        }
    except Exception as e:
        logger.error(f"Error in manual partneri sync: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/artikl/{artikl_uid}")
async def sync_single_artikl(
    artikl_uid: str,
    db: Session = Depends(get_db)
):
    """
    Ručno povlačenje jednog artikla iz ERP-a po UID-u i upis u tablicu Artikli.
    Ako artikl već postoji, radi se update svih polja.
    """
    from app.models.erp_models import Artikli, GrupeArtikala
    
    erp_client = get_erp_client()
    
    try:
        artikl_data = await erp_client.get_artikl_by_uid(artikl_uid)
        if not artikl_data:
            raise HTTPException(status_code=404, detail="Artikl nije pronađen u ERP-u")
        
        # Ako postoji info o grupi artikla, prvo osiguraj da grupa postoji
        grupa_artikla_uid = artikl_data.get("grupa_artikla_uid")
        if grupa_artikla_uid:
            grupa = db.query(GrupeArtikala).filter(
                GrupeArtikala.grupa_artikla_uid == grupa_artikla_uid
            ).first()
            if not grupa:
                grupa = GrupeArtikala(grupa_artikla_uid=grupa_artikla_uid)
                db.add(grupa)
            
            # Mapiraj polja grupe ako postoje
            for key in ["grupa_artikla", "grupa_artikla_naziv", "nadgrupa_artikla", "nadgrupa_artikla_naziv",
                        "supergrupa_artikla", "supergrupa_artikla_naziv"]:
                if hasattr(grupa, key) and key in artikl_data:
                    setattr(grupa, key, artikl_data.get(key))
            
            db.flush()
        
        # Upsert Artikli
        artikl = db.query(Artikli).filter(
            Artikli.artikl_uid == artikl_uid
        ).first()
        
        if not artikl:
            artikl = Artikli(artikl_uid=artikl_uid)
            db.add(artikl)
        
        # Mapiraj sva polja koja postoje i u modelu i u payloadu
        for key, value in artikl_data.items():
            if hasattr(Artikli, key):
                setattr(artikl, key, value)
        
        db.commit()
        
        return {
            "message": "Artikl uspješno sinkroniziran",
            "status": "success",
            "artikl_uid": artikl_uid,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in single artikl sync ({artikl_uid}): {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# UI Routes
@ui_router.get("/config/delivery-types", response_class=HTMLResponse)
async def delivery_types_ui(request: Request, db: Session = Depends(get_db)):
    """Delivery types configuration UI"""
    types = db.query(AllowedDeliveryTypes).all()
    return render_template(
        "config_delivery_types.html",
        delivery_types=types
    )


@ui_router.get("/sync", response_class=HTMLResponse)
async def sync_ui(request: Request, db: Session = Depends(get_db)):
    """Sync UI for artikli i partneri"""
    return render_template("sync.html")


# Grupe Artikala Config Schemas
class GrupaArtikalaConfigCreate(BaseModel):
    grupa_artikla_naziv: str
    salje_se_u_optimo: bool = True
    opis: Optional[str] = None


class GrupaArtikalaConfigUpdate(BaseModel):
    salje_se_u_optimo: Optional[bool] = None
    opis: Optional[str] = None


class GrupaArtikalaConfigResponse(BaseModel):
    grupa_artikla_naziv: str
    salje_se_u_optimo: bool
    opis: Optional[str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


@router.get("/artikli-grupe", response_model=List[GrupaArtikalaConfigResponse])
async def get_grupe_artikala_config(db: Session = Depends(get_db)):
    """Get all grupe artikala configurations"""
    configs = db.query(GrupeArtikalaConfig).order_by(GrupeArtikalaConfig.grupa_artikla_naziv).all()
    return [GrupaArtikalaConfigResponse.from_orm(c) for c in configs]


@router.get("/artikli-grupe/available")
async def get_available_grupe_artikala(db: Session = Depends(get_db)):
    """Get all available grupe artikala from GrupeArtikala table that are not yet configured"""
    # Get all configured grupe
    configured = {c.grupa_artikla_naziv for c in db.query(GrupeArtikalaConfig).all()}
    
    # Get all grupe from GrupeArtikala
    all_grupe = db.query(GrupeArtikala).filter(
        GrupeArtikala.grupa_artikla_naziv.isnot(None)
    ).distinct().all()
    
    # Filter out already configured
    available = [
        {
            "grupa_artikla_naziv": g.grupa_artikla_naziv,
            "grupa_artikla": g.grupa_artikla
        }
        for g in all_grupe
        if g.grupa_artikla_naziv and g.grupa_artikla_naziv not in configured
    ]
    
    return {"available": available}


@router.post("/artikli-grupe", response_model=GrupaArtikalaConfigResponse)
async def create_grupa_artikala_config(
    data: GrupaArtikalaConfigCreate,
    db: Session = Depends(get_db)
):
    """Create new grupa artikala configuration"""
    # Check if exists
    existing = db.query(GrupeArtikalaConfig).filter(
        GrupeArtikalaConfig.grupa_artikla_naziv == data.grupa_artikla_naziv
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Grupa artikala configuration already exists")
    
    config = GrupeArtikalaConfig(
        grupa_artikla_naziv=data.grupa_artikla_naziv,
        salje_se_u_optimo=data.salje_se_u_optimo,
        opis=data.opis
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return GrupaArtikalaConfigResponse.from_orm(config)


@router.put("/artikli-grupe/{grupa_artikla_naziv}", response_model=GrupaArtikalaConfigResponse)
async def update_grupa_artikala_config(
    grupa_artikla_naziv: str,
    data: GrupaArtikalaConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update grupa artikala configuration"""
    config = db.query(GrupeArtikalaConfig).filter(
        GrupeArtikalaConfig.grupa_artikla_naziv == grupa_artikla_naziv
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Grupa artikala configuration not found")
    
    if data.salje_se_u_optimo is not None:
        config.salje_se_u_optimo = data.salje_se_u_optimo
    if data.opis is not None:
        config.opis = data.opis
    
    db.commit()
    db.refresh(config)
    
    return GrupaArtikalaConfigResponse.from_orm(config)


@router.delete("/artikli-grupe/{grupa_artikla_naziv}")
async def delete_grupa_artikala_config(
    grupa_artikla_naziv: str,
    db: Session = Depends(get_db)
):
    """Delete grupa artikala configuration"""
    config = db.query(GrupeArtikalaConfig).filter(
        GrupeArtikalaConfig.grupa_artikla_naziv == grupa_artikla_naziv
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Grupa artikala configuration not found")
    
    db.delete(config)
    db.commit()
    
    return {"message": "Grupa artikala configuration deleted"}


@ui_router.get("/config/artikli-grupe", response_class=HTMLResponse)
async def artikli_grupe_ui(request: Request, db: Session = Depends(get_db)):
    """Grupe artikala configuration UI"""
    configs = db.query(GrupeArtikalaConfig).order_by(GrupeArtikalaConfig.grupa_artikla_naziv).all()
    available_grupe = db.query(GrupeArtikala).filter(
        GrupeArtikala.grupa_artikla_naziv.isnot(None)
    ).distinct().all()
    
    # Filter out already configured
    configured = {c.grupa_artikla_naziv for c in configs}
    available = [
        g for g in available_grupe
        if g.grupa_artikla_naziv and g.grupa_artikla_naziv not in configured
    ]
    
    return render_template(
        "config_artikli_grupe.html",
        configs=configs,
        available_grupe=available
    )
