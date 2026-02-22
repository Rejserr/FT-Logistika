"""
Orders API endpoints
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy import or_, and_
from app.database import get_db
from app.models.erp_models import NaloziHeader, NaloziDetails, Partneri
from app.models.regional_models import Regije
from app.models.optimo_models import OptimoOrders
from app.schemas.erp_schemas import OrderFilter, NalogHeaderResponse, NalogDetailResponse
from app.services.optimo_mapper import OptimoMapper
from app.services.region_service import RegionService
from app.services.optimo_client import OptimoClient
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
import os
import logging
import json

logger = logging.getLogger(__name__)

templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir))

def render_template(template_name: str, **kwargs):
    template = jinja_env.get_template(template_name)
    return HTMLResponse(content=template.render(**kwargs))

router = APIRouter()
ui_router = APIRouter()


class OrdersResponse(BaseModel):
    items: List[NalogHeaderResponse]
    total: int
    page: int
    page_size: int
    pages: int

@router.get("/", response_model=OrdersResponse)
async def get_orders(
    filter: OrderFilter = Depends(),
    db: Session = Depends(get_db)
):
    """
    Get orders with filters and pagination
    """
    query = db.query(NaloziHeader)
    
    # Apply filters
    if filter.datum_od:
        query = query.filter(NaloziHeader.raspored >= filter.datum_od)
    if filter.datum_do:
        query = query.filter(NaloziHeader.raspored <= filter.datum_do)
    if filter.regija_id:
        query = query.filter(NaloziHeader.regija_id == filter.regija_id)
    elif filter.bez_regije:
        query = query.filter(NaloziHeader.regija_id.is_(None))
    if filter.vozilo_tip:
        query = query.filter(NaloziHeader.vozilo_tip == filter.vozilo_tip)
    if filter.vrsta_isporuke:
        query = query.filter(NaloziHeader.vrsta_isporuke == filter.vrsta_isporuke)
    if filter.partner_search:
        # Search in partner table
        partner_ids = db.query(Partneri.partner_uid).filter(
            or_(
                Partneri.partner.contains(filter.partner_search),
                Partneri.naziv.contains(filter.partner_search),
                Partneri.ime.contains(filter.partner_search),
                Partneri.prezime.contains(filter.partner_search)
            )
        ).subquery()
        query = query.filter(NaloziHeader.partner_uid.in_(partner_ids))
    
    # Filtriranje poslanih naloga (ako prikazi_poslane = False, sakrij poslane)
    if not filter.prikazi_poslane:
        # Sakrij naloge koji su poslani u OptimoRoute
        sent_nalog_uids = db.query(OptimoOrders.nalog_prodaje_uid).filter(
            OptimoOrders.sent_to_optimo == True
        ).subquery()
        query = query.filter(~NaloziHeader.nalog_prodaje_uid.in_(sent_nalog_uids))
    
    # Get total count
    total = query.count()
    
    # Sorting
    sort_column = filter.sort_by or "raspored"
    sort_order = filter.sort_order or "desc"
    
    # Map frontend column names to database columns
    sort_mapping = {
        "broj": NaloziHeader.broj,
        "partner": NaloziHeader.partner,
        "raspored": NaloziHeader.raspored,
        "total_weight": NaloziHeader.total_weight,
        "total_volume": NaloziHeader.total_volume,
        "vozilo_tip": NaloziHeader.vozilo_tip,
        "status": NaloziHeader.status,
        "vrsta_isporuke": NaloziHeader.vrsta_isporuke,
    }
    
    if sort_column in sort_mapping:
        if sort_order == "asc":
            query = query.order_by(sort_mapping[sort_column].asc())
        else:
            query = query.order_by(sort_mapping[sort_column].desc())
    else:
        # Default sorting
        query = query.order_by(NaloziHeader.raspored.desc())
    
    # Pagination
    offset = (filter.page - 1) * filter.page_size
    nalozi = query.offset(offset).limit(filter.page_size).all()
    
    # Build response with related data
    result = []
    for nalog in nalozi:
        item = NalogHeaderResponse.from_orm(nalog)
        
        # Add additional fields from model
        item.skladiste = nalog.skladiste
        item.narudzba = nalog.narudzba
        item.valuta = nalog.valuta
        item.tecaj = float(nalog.tecaj) if nalog.tecaj else None
        item.generalni_rabat = nalog.generalni_rabat
        item.na_uvid = nalog.na_uvid
        item.referenca_isporuke = nalog.referenca_isporuke
        item.kupac_placa_isporuku = nalog.kupac_placa_isporuku
        item.komercijalist__radnik = nalog.komercijalist__radnik
        item.dostavljac__radnik = nalog.dostavljac__radnik
        item.kreirao__radnik = nalog.kreirao__radnik
        
        # Get partner info
        if nalog.partner_uid:
            partner = db.query(Partneri).filter(
                Partneri.partner_uid == nalog.partner_uid
            ).first()
            if partner:
                item.partner_naziv = partner.naziv or f"{partner.ime} {partner.prezime}".strip()
                item.partner_mjesto = partner.naziv_mjesta
                item.partner_postanski_broj = partner.postanski_broj
                item.partner_adresa = partner.adresa
        
        # Get regija info
        if nalog.regija_id:
            regija = db.query(Regije).filter(
                Regije.regija_id == nalog.regija_id
            ).first()
            if regija:
                item.regija_naziv = regija.naziv_regije
        
        # Provjeri da li je nalog poslan u OptimoRoute
        optimo_order = db.query(OptimoOrders).filter(
            OptimoOrders.nalog_prodaje_uid == nalog.nalog_prodaje_uid
        ).first()
        item.sent_to_optimo = optimo_order.sent_to_optimo if optimo_order else False
        
        result.append(item)
    
    return OrdersResponse(
        items=result,
        total=total,
        page=filter.page,
        page_size=filter.page_size,
        pages=(total + filter.page_size - 1) // filter.page_size
    )


@router.get("/{nalog_uid}", response_model=NalogDetailResponse)
async def get_order_detail(
    nalog_uid: str,
    db: Session = Depends(get_db)
):
    """
    Get order detail with stavke and OptimoRoute payload
    """
    nalog = db.query(NaloziHeader).filter(
        NaloziHeader.nalog_prodaje_uid == nalog_uid
    ).first()
    
    if not nalog:
        raise HTTPException(status_code=404, detail="Nalog not found")
    
    # Build base response iz headera kako bismo izbjegli Pydantic probleme
    # sa ORM objektima u stavkama
    header_response = NalogHeaderResponse.from_orm(nalog)
    result = NalogDetailResponse(**header_response.model_dump())
    
    # Get partner info
    if nalog.partner_uid:
        partner = db.query(Partneri).filter(
            Partneri.partner_uid == nalog.partner_uid
        ).first()
        if partner:
            result.partner_naziv = partner.naziv or f"{partner.ime} {partner.prezime}".strip()
            result.partner_mjesto = partner.naziv_mjesta
            result.partner_postanski_broj = partner.postanski_broj
            result.partner_adresa = partner.adresa
    
    # Get regija info
    if nalog.regija_id:
        regija = db.query(Regije).filter(
            Regije.regija_id == nalog.regija_id
        ).first()
        if regija:
            result.regija_naziv = regija.naziv_regije
    
    # Get stavke
    from app.models.erp_models import NaloziDetails, Artikli
    stavke = db.query(NaloziDetails).filter(
        NaloziDetails.nalog_prodaje_uid == nalog_uid
    ).all()
    
    result.stavke = []
    for stavka in stavke:
        stavka_dict = {
            "stavka_uid": stavka.stavka_uid,
            "artikl": stavka.artikl,
            "artikl_uid": stavka.artikl_uid,
            "kolicina": float(stavka.kolicina) if stavka.kolicina else 0,
            "cijena": float(stavka.cijena) if stavka.cijena else 0,
            "opis": stavka.opis
        }
        
        # Get artikl details
        if stavka.artikl_uid:
            artikl = db.query(Artikli).filter(
                Artikli.artikl_uid == stavka.artikl_uid
            ).first()
            if artikl:
                stavka_dict["artikl_naziv"] = artikl.naziv
                stavka_dict["artikl_masa"] = float(artikl.masa) if artikl.masa else 0
                stavka_dict["artikl_volumen"] = float(artikl.volumen) if artikl.volumen else 0
        
        result.stavke.append(stavka_dict)
    
    # Get OptimoRoute payload
    result.optimo_payload = OptimoMapper.get_payload(nalog_uid, db)
    
    return result


# UI Routes
@ui_router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_ui(request: Request, db: Session = Depends(get_db)):
    """
    Orders dashboard UI
    """
    # Get filter options
    regije = db.query(Regije).all()
    vozilo_tipovi = db.query(NaloziHeader.vozilo_tip).distinct().all()
    vrste_isporuke = db.query(NaloziHeader.vrsta_isporuke).distinct().all()
    
    return render_template(
        "dashboard.html",
        regije=regije,
        vozilo_tipovi=[v[0] for v in vozilo_tipovi if v[0]],
        vrste_isporuke=[v[0] for v in vrste_isporuke if v[0]]
    )


@ui_router.get("/order/{nalog_uid}", response_class=HTMLResponse)
async def order_detail_ui(request: Request, nalog_uid: str, db: Session = Depends(get_db)):
    """
    Order detail UI
    """
    regije = db.query(Regije).all()
    regije_payload = [{"regija_id": r.regija_id, "naziv_regije": r.naziv_regije} for r in regije]
    return render_template(
        "order_detail.html",
        nalog_uid=nalog_uid,
        regije=regije_payload
    )


class SyncRequest(BaseModel):
    datum_od: date
    datum_do: date


class OrderItemUpdate(BaseModel):
    stavka_uid: str
    kolicina: Optional[float] = None
    cijena: Optional[float] = None
    opis: Optional[str] = None


class OrderUpdateRequest(BaseModel):
    status: Optional[str] = None
    datum: Optional[date] = None
    raspored: Optional[date] = None
    vrsta_isporuke: Optional[str] = None
    vozilo_tip: Optional[str] = None
    regija_id: Optional[int] = None
    partner_postanski_broj: Optional[str] = None
    stavke: Optional[List[OrderItemUpdate]] = None


@router.post("/sync")
async def manual_sync_orders(
    request: SyncRequest,
    db: Session = Depends(get_db)
):
    """
    Manual sync orders from ERP for date range
    Uses the same logic as scheduled sync but with custom date range
    """
    datum_od = request.datum_od
    datum_do = request.datum_do
    from app.services.erp_client import get_erp_client
    from app.services.filter_service import DeliveryFilterService
    from app.services.aggregation_service import AggregationService
    from app.services.region_service import RegionService
    from app.services.logistics_service import LogisticsService
    from app.services.optimo_mapper import OptimoMapper
    from app.models.erp_models import Partneri, PartneriAtributi
    
    logger.info(f"Manual sync requested: {datum_od} to {datum_do}")
    
    erp_client = get_erp_client()
    
    try:
        # Statusi: 08, 101, 102, 103
        statusi = ["08", "101", "102", "103"]
        
        # Fetch headers
        nalozi_headers = await erp_client.get_nalozi_headers(
            statusi=statusi,
            datum_od=datum_od,
            datum_do=datum_do
        )
        
        logger.info(f"Fetched {len(nalozi_headers)} nalozi headers from ERP")
        
        # Filter by allowed delivery types
        allowed_nalozi = await DeliveryFilterService.filter_allowed_nalozi(nalozi_headers, db)
        
        logger.info(f"After filtering: {len(allowed_nalozi)} allowed nalozi")
        
        # Get UIDs for details and partners
        nalog_uids = [n.get("nalog_prodaje_uid") for n in allowed_nalozi if n.get("nalog_prodaje_uid")]
        partner_sifre = list(set([n.get("partner") for n in allowed_nalozi if n.get("partner")]))
        
        # Fetch details and partners concurrently
        from app.config import settings
        nalog_details_map = await erp_client.fetch_multiple_nalozi_details(
            nalog_uids, 
            max_concurrent=settings.SYNC_CONCURRENCY
        )
        
        partner_map = await erp_client.fetch_multiple_partners(
            partner_sifre,
            max_concurrent=settings.SYNC_CONCURRENCY
        )
        
        # Process each nalog (same logic as sync_nalozi)
        synced_count = 0
        for nalog_header in allowed_nalozi:
            try:
                nalog_uid = nalog_header.get("nalog_prodaje_uid")
                if not nalog_uid:
                    continue
                
                # Upsert NaloziHeader
                nalog = db.query(NaloziHeader).filter(
                    NaloziHeader.nalog_prodaje_uid == nalog_uid
                ).first()
                
                if not nalog:
                    nalog = NaloziHeader(nalog_prodaje_uid=nalog_uid)
                    db.add(nalog)
                
                # Update header fields
                for key, value in nalog_header.items():
                    if hasattr(nalog, key) and key != "nalog_prodaje_uid" and key != "stavke":
                        # Handle date fields
                        if key in ["datum", "rezervacija_do_datuma", "raspored"] and value:
                            try:
                                if isinstance(value, str):
                                    value = value.strip().rstrip(".")
                                    value = datetime.strptime(value, "%d.%m.%Y").date()
                                setattr(nalog, key, value)
                            except Exception as e:
                                logger.warning(f"Error parsing date {key}={value}: {e}")
                        elif key == "rezervacija_od_datuma" and value:
                            try:
                                if isinstance(value, str):
                                    value = value.strip().rstrip(".")
                                    value = datetime.strptime(value, "%d.%m.%Y. %H:%M:%S")
                                setattr(nalog, key, value)
                            except Exception as e:
                                logger.warning(f"Error parsing datetime {key}={value}: {e}")
                        else:
                            # Truncate na_uvid if too long
                            if key == "na_uvid" and value and len(str(value)) > 255:
                                value = str(value)[:255]
                            setattr(nalog, key, value)
                
                # Validate required fields before commit
                if not nalog.vrsta_isporuke:
                    logger.warning(f"Nalog {nalog_uid} has no vrsta_isporuke, skipping")
                    db.rollback()
                    continue
                
                db.flush()
                
                # Process details if available
                nalog_details = nalog_details_map.get(nalog_uid)
                if nalog_details and "stavke" in nalog_details:
                    # Delete existing stavke
                    db.query(NaloziDetails).filter(
                        NaloziDetails.nalog_prodaje_uid == nalog_uid
                    ).delete()
                    
                    # Insert new stavke
                    for stavka_data in nalog_details.get("stavke", []):
                        stavka_uid = stavka_data.get("stavka_uid")
                        if not stavka_uid:
                            continue
                        
                        stavka = NaloziDetails(
                            stavka_uid=stavka_uid,
                            nalog_prodaje_uid=nalog_uid
                        )
                        
                        for key, value in stavka_data.items():
                            # Skip relationship attributes and primary keys
                            if key in ["stavka_uid", "nalog_prodaje_uid", "artikl_obj", "nalog"]:
                                continue
                            if hasattr(stavka, key) and key != "stavka_uid" and key != "nalog_prodaje_uid":
                                # Skip if it's a relationship (check if it's a relationship descriptor)
                                from sqlalchemy.orm import RelationshipProperty
                                attr = getattr(type(stavka), key, None)
                                if attr is not None and isinstance(attr.property, RelationshipProperty):
                                    continue
                                
                                # Validate artikl_uid foreign key - set to None if artikl doesn't exist
                                if key == "artikl_uid" and value:
                                    from app.models.erp_models import Artikli
                                    artikl_exists = db.query(Artikli).filter(
                                        Artikli.artikl_uid == value
                                    ).first()
                                    if not artikl_exists:
                                        logger.warning(f"Artikl {value} not found in database, setting artikl_uid to None for stavka {stavka_uid}")
                                        value = None
                                
                                setattr(stavka, key, value)
                        
                        db.add(stavka)
                
                # Process partner if available
                partner_sifra = nalog_header.get("partner")
                if partner_sifra and partner_sifra in partner_map:
                    partner_data = partner_map[partner_sifra]
                    if partner_data:
                        partner_uid = partner_data.get("partner_uid")
                        if partner_uid:
                            # Upsert Partneri
                            partner = db.query(Partneri).filter(
                                Partneri.partner_uid == partner_uid
                            ).first()
                            
                            if not partner:
                                partner = Partneri(partner_uid=partner_uid)
                                db.add(partner)
                            
                            # Update partner fields
                            for key, value in partner_data.items():
                                if hasattr(partner, key) and key != "partner_uid" and key != "atributi":
                                    # Ako je naziv prazan, složi ga iz ime + prezime
                                    if key == "naziv":
                                        if (not value or not str(value).strip()) and (
                                            partner_data.get("ime") or partner_data.get("prezime")
                                        ):
                                            ime = partner_data.get("ime") or ""
                                            prezime = partner_data.get("prezime") or ""
                                            value = f"{ime} {prezime}".strip()
                                    setattr(partner, key, value)
                            
                            db.flush()
                            
                            # Process atributi
                            if "atributi" in partner_data:
                                # Delete existing atributi
                                db.query(PartneriAtributi).filter(
                                    PartneriAtributi.partner_uid == partner_uid
                                ).delete()
                                
                                # Insert new atributi
                                for atribut_data in partner_data.get("atributi", []):
                                    atribut = PartneriAtributi(
                                        partner_uid=partner_uid
                                    )
                                    
                                    for key, value in atribut_data.items():
                                        if hasattr(atribut, key) and key != "partner_uid":
                                            setattr(atribut, key, value)
                                    
                                    db.add(atribut)
                
                # Set partner_uid as string, not object
                if partner_sifra and partner_sifra in partner_map:
                    partner_data = partner_map[partner_sifra]
                    if partner_data:
                        partner_uid_str = partner_data.get("partner_uid")
                        if partner_uid_str:
                            nalog.partner_uid = str(partner_uid_str)  # Ensure it's a string
                
                db.commit()
                
                # Calculate totals
                AggregationService.update_nalog_totals(nalog_uid, db)
                
                # Assign region
                if partner_sifra and partner_sifra in partner_map:
                    partner_data = partner_map[partner_sifra]
                    if partner_data and partner_data.get("postanski_broj"):
                        RegionService.assign_region_to_nalog(
                            nalog_uid,
                            partner_data.get("postanski_broj"),
                            db
                        )
                
                # Determine vehicle type
                LogisticsService.determine_vehicle_type(nalog_uid, db)
                
                # Generate OptimoRoute payload
                OptimoMapper.save_payload(nalog_uid, db)
                
                synced_count += 1
                
            except Exception as e:
                import traceback
                logger.error(f"Error syncing nalog {nalog_header.get('nalog_prodaje_uid')}: {e}")
                logger.error(traceback.format_exc())
                db.rollback()
                continue
        
        await erp_client.close()
        
        return {
            "message": f"Sync completed",
            "synced_count": synced_count,
            "total_fetched": len(nalozi_headers),
            "allowed_count": len(allowed_nalozi)
        }
    
    except Exception as e:
        logger.error(f"Error in manual sync: {e}")
        await erp_client.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{nalog_uid}")
async def update_order(
    nalog_uid: str,
    data: OrderUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Ažuriranje podataka naloga i stavki.
    """
    nalog = db.query(NaloziHeader).filter(
        NaloziHeader.nalog_prodaje_uid == nalog_uid
    ).first()
    
    if not nalog:
        raise HTTPException(status_code=404, detail="Nalog not found")
    
    if data.status is not None:
        nalog.status = data.status
    if data.datum is not None:
        nalog.datum = data.datum
    if data.raspored is not None:
        nalog.raspored = data.raspored
    if data.vrsta_isporuke is not None:
        nalog.vrsta_isporuke = data.vrsta_isporuke
    if data.vozilo_tip is not None:
        nalog.vozilo_tip = data.vozilo_tip
    if "regija_id" in data.model_fields_set:
        if data.regija_id is not None:
            regija = db.query(Regije).filter(Regije.regija_id == data.regija_id).first()
            if not regija:
                raise HTTPException(status_code=400, detail="Regija ne postoji")
        nalog.regija_id = data.regija_id
    if "partner_postanski_broj" in data.model_fields_set:
        if not nalog.partner_uid:
            raise HTTPException(status_code=400, detail="Nalog nema povezanog partnera")
        partner = db.query(Partneri).filter(
            Partneri.partner_uid == nalog.partner_uid
        ).first()
        if not partner:
            raise HTTPException(status_code=404, detail="Partner nije pronađen")
        if data.partner_postanski_broj is None or data.partner_postanski_broj == "":
            partner.postanski_broj = None
        else:
            clean_postal = RegionService.normalize_postal_code(data.partner_postanski_broj)
            if not clean_postal:
                raise HTTPException(status_code=400, detail="Neispravan poštanski broj")
            partner.postanski_broj = clean_postal

    if data.stavke:
        for stavka_data in data.stavke:
            stavka = db.query(NaloziDetails).filter(
                NaloziDetails.stavka_uid == stavka_data.stavka_uid,
                NaloziDetails.nalog_prodaje_uid == nalog_uid
            ).first()
            if not stavka:
                raise HTTPException(status_code=404, detail=f"Stavka {stavka_data.stavka_uid} nije pronađena")
            if stavka_data.kolicina is not None:
                stavka.kolicina = stavka_data.kolicina
            if stavka_data.cijena is not None:
                stavka.cijena = stavka_data.cijena
            if stavka_data.opis is not None:
                stavka.opis = stavka_data.opis
    
    try:
        from app.services.aggregation_service import AggregationService
        totals = AggregationService.calculate_order_totals(nalog_uid, db)
        nalog.total_weight = totals["total_weight"]
        nalog.total_volume = totals["total_volume"]
        db.commit()
        return {"message": "Order updated successfully"}
    except Exception as e:
        logger.error(f"Error updating order {nalog_uid}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{nalog_uid}/refresh-region")
async def refresh_order_region(
    nalog_uid: str,
    db: Session = Depends(get_db)
):
    """
    Refresh regija for nalog based on partner's postal code.
    Useful when postal code mapping is updated after nalog was synced.
    """
    from app.services.region_service import RegionService
    
    nalog = db.query(NaloziHeader).filter(
        NaloziHeader.nalog_prodaje_uid == nalog_uid
    ).first()
    
    if not nalog:
        raise HTTPException(status_code=404, detail="Nalog not found")
    
    # Get partner postal code
    if not nalog.partner_uid:
        raise HTTPException(status_code=400, detail="Nalog nema povezanog partnera")
    
    partner = db.query(Partneri).filter(
        Partneri.partner_uid == nalog.partner_uid
    ).first()
    
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    if not partner.postanski_broj:
        raise HTTPException(status_code=400, detail="Partner nema poštanski broj")
    
    # Assign region based on postal code
    regija_id = RegionService.assign_region_to_nalog(
        nalog_uid,
        partner.postanski_broj,
        db
    )
    
    if regija_id:
        # Get regija name for response
        regija = db.query(Regije).filter(
            Regije.regija_id == regija_id
        ).first()
        regija_naziv = regija.naziv_regije if regija else None
        
        return {
            "message": "Regija uspješno ažurirana",
            "status": "success",
            "regija_id": regija_id,
            "regija_naziv": regija_naziv
        }
    else:
        return {
            "message": "Regija nije pronađena za poštanski broj",
            "status": "warning",
            "regija_id": None,
            "regija_naziv": None
        }


@router.delete("/{nalog_uid}")
async def delete_order(
    nalog_uid: str,
    db: Session = Depends(get_db)
):
    """Delete order (nalog) and all related data"""
    nalog = db.query(NaloziHeader).filter(
        NaloziHeader.nalog_prodaje_uid == nalog_uid
    ).first()
    
    if not nalog:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Delete related data (cascade should handle this, but explicit is better)
    from app.models.optimo_models import OptimoOrders
    db.query(OptimoOrders).filter(
        OptimoOrders.nalog_prodaje_uid == nalog_uid
    ).delete()
    
    # Delete details (should cascade, but explicit)
    db.query(NaloziDetails).filter(
        NaloziDetails.nalog_prodaje_uid == nalog_uid
    ).delete()
    
    # Delete header
    db.delete(nalog)
    db.commit()
    
    return {"message": "Order deleted successfully"}


class SendToOptimoRequest(BaseModel):
    nalog_uids: List[str]


async def _process_single_order(nalog_uid: str, db: Session) -> list[dict]:
    """
    Pomoćna funkcija koja obrađuje jedan nalog i vraća listu rezultata po grupama artikala.
    """
    # Provjeri da nalog postoji
    nalog = db.query(NaloziHeader).filter(
        NaloziHeader.nalog_prodaje_uid == nalog_uid
    ).first()

    if not nalog:
        logger.warning("Nalog %s not found", nalog_uid)
        return []

    # Dohvati JSON po grupama artikala iz view-a
    rows = db.execute(
        text(
            "SELECT payload_json_send FROM dbo.vw_optimo_send_payload_json_stavke "
            "WHERE nalog_prodaje_uid = :uid"
        ),
        {"uid": nalog_uid},
    ).fetchall()

    if not rows:
        logger.warning("Nalog %s nema grupa artikala u view-u", nalog_uid)
        return []

    results: list[dict] = []
    for row in rows:
        raw_payload = row[0]
        try:
            src = json.loads(raw_payload)
        except json.JSONDecodeError as e:
            logger.error("Error parsing payload_json_send for %s: %s", nalog_uid, e)
            results.append({
                "nalog_uid": nalog_uid,
                "orderNo": None,
                "success": False,
                "http_status": None,
                "response": {"detail": f"JSON parsing error: {e}"},
                "error_code": "ERR_JSON_PARSE",
                "error_message": f"Greška pri parsiranju JSON-a za grupu artikala: {e}",
                "address": None,
                "grupa_artikla": None,
            })
            continue

        # Pripremi payload u formatu koji očekuje OptimoRoute create_order
        location_src = src.get("location") or {}
        custom_fields = src.get("customFields") or {}

        # Dodaj grupu naloga u custom polja (za njihovu logiku group_orders)
        custom_fields.setdefault("group_orders", nalog_uid)

        # Ako imamo tagove iz view-a, spremi ih u custom polja radi analize
        tags = src.get("tags") or []
        if tags:
            custom_fields.setdefault("tag_regija", tags[0])
            if len(tags) > 1:
                custom_fields.setdefault("tag_vozilo_tip", tags[1])
            if len(tags) > 2:
                custom_fields.setdefault("tag_vrsta_isporuke", tags[2])

        # Polje "stavke" je već generirano u SQL view-u sa svim artiklima odvojenim sa ||
        # Ne trebamo ga više generirati ovdje

        # Poboljšaj format adrese - dodaj poštanski broj i naziv mjesta za bolje geokodiranje
        address_parts = []
        base_address = location_src.get("address") or ""
        if base_address:
            address_parts.append(base_address)
        
        postcode = location_src.get("postcode")
        city = location_src.get("city")
        country = location_src.get("country") or "HR"
        
        if postcode or city:
            location_parts = []
            if postcode:
                location_parts.append(postcode)
            if city:
                location_parts.append(city)
            if location_parts:
                address_parts.append(", ".join(location_parts))
        
        if country and country != "HR":
            address_parts.append(country)
        
        formatted_address = ", ".join(address_parts) if address_parts else base_address

        # Grupa artikala za notes i rezultate
        grupa_artikla = custom_fields.get("grupa_artikla")

        order_payload = {
            "operation": "CREATE",
            "orderNo": src.get("orderNo"),
            "date": src.get("date"),
            "type": src.get("type") or "D",
            "duration": 10,
            "priority": "M",
            "load1": src.get("load1"),
            "load2": src.get("load2"),
            "location": {
                # OptimoRoute ne prihvaća city/postcode/country ovdje, samo address i opcionalno locationName
                # Format adrese uključuje sve informacije u jednom stringu za bolje geokodiranje
                "address": formatted_address,
                "locationName": location_src.get("locationName"),
                # Prihvati djelomično podudaranje geocodiranja (lower confidence) da bi se izbjegla greška ERR_LOC_GEOCODING_PARTIAL
                "acceptPartialMatch": True,
                "acceptMultipleResults": True,
            },
            "notes": f"Nalog {nalog_uid} / grupa {grupa_artikla}" if grupa_artikla else f"Nalog {nalog_uid}",
            "customFields": custom_fields,
        }

        result = await OptimoClient.send_order(order_payload)
        response_data = result.get("response") or {}
        
        # Ekstraktuj informacije o grešci iz OptimoRoute response-a
        error_code = None
        error_message = None
        if isinstance(response_data, dict):
            error_code = response_data.get("code")
            error_message = response_data.get("message")
            if error_code and not error_message:
                error_message = f"OptimoRoute greška: {error_code}"
        
        results.append(
            {
                "nalog_uid": nalog_uid,
                "orderNo": order_payload.get("orderNo"),
                "grupa_artikla": grupa_artikla,
                "address": formatted_address,
                "success": result.get("success", False),
                "http_status": result.get("http_status"),
                "error_code": error_code,
                "error_message": error_message,
                "response": response_data,
            }
        )

    return results


@router.post("/send-to-optimo")
async def send_orders_to_optimo(
    request: SendToOptimoRequest,
    db: Session = Depends(get_db),
):
    """
    Pošalji više naloga (grupe artikala) ručno u OptimoRoute.

    - Prima listu nalog_uid-ova u request body-ju.
    - Podaci se čitaju iz SQL view-a `vw_optimo_send_payload_json_stavke`
      (1 red = 1 grupa artikala = 1 Optimo order).
    - Svaka grupa artikala se šalje kao zaseban `create_order` poziv.
    """
    if not request.nalog_uids:
        raise HTTPException(status_code=400, detail="Lista nalog_uid-ova ne može biti prazna")

    all_results: list[dict] = []
    nalog_summary: dict[str, dict] = {}  # nalog_uid -> {total, success, failed}
    from datetime import datetime

    for nalog_uid in request.nalog_uids:
        results = await _process_single_order(nalog_uid, db)
        all_results.extend(results)
        
        # Sažetak po nalogu
        total_grupa = len(results)
        success_grupa = sum(1 for r in results if r.get("success", False))
        nalog_summary[nalog_uid] = {
            "total_grupa": total_grupa,
            "success_grupa": success_grupa,
            "failed_grupa": total_grupa - success_grupa,
        }
        
        # Ažuriraj OptimoOrders ako su sve grupe uspješno poslane
        if total_grupa > 0 and success_grupa == total_grupa:
            optimo_order = db.query(OptimoOrders).filter(
                OptimoOrders.nalog_prodaje_uid == nalog_uid
            ).first()
            
            if optimo_order:
                optimo_order.sent_to_optimo = True
                optimo_order.sent_at = datetime.now()
            else:
                # Kreiraj novi zapis ako ne postoji
                optimo_order = OptimoOrders(
                    nalog_prodaje_uid=nalog_uid,
                    sent_to_optimo=True,
                    sent_at=datetime.now()
                )
                db.add(optimo_order)
            
            try:
                db.commit()
            except Exception as e:
                logger.error(f"Error updating OptimoOrders for {nalog_uid}: {e}")
                db.rollback()

    # Ukupni sažetak
    total_grupa = len(all_results)
    success_grupa = sum(1 for r in all_results if r.get("success", False))
    total_naloga = len(request.nalog_uids)
    success_naloga = sum(1 for uid, summary in nalog_summary.items() if summary["failed_grupa"] == 0)

    return {
        "message": f"Poslano {total_grupa} grupa artikala iz {total_naloga} naloga prema OptimoRoute. Uspješno: {success_grupa} grupa, {success_naloga} naloga bez grešaka.",
        "total_naloga": total_naloga,
        "success_naloga": success_naloga,
        "total_grupa": total_grupa,
        "success_grupa": success_grupa,
        "failed_grupa": total_grupa - success_grupa,
        "nalog_summary": nalog_summary,
        "results": all_results,
    }


@router.post("/{nalog_uid}/send-to-optimo")
async def send_order_to_optimo(
    nalog_uid: str,
    db: Session = Depends(get_db),
):
    """
    Pošalji odabrani nalog (grupe artikala) ručno u OptimoRoute.
    Backward compatibility endpoint - koristi istu logiku kao batch endpoint.

    - Podaci se čitaju iz SQL view-a `vw_optimo_send_payload_json_stavke`
      (1 red = 1 grupa artikala = 1 Optimo order).
    - Svaka grupa artikala se šalje kao zaseban `create_order` poziv.
    """
    results = await _process_single_order(nalog_uid, db)

    if not results:
        raise HTTPException(
            status_code=400,
            detail="Nalog nema grupa artikala u view-u vw_optimo_send_payload_json_stavke ili nalog ne postoji",
        )

    # Sažetak za frontend
    total = len(results)
    ok = sum(1 for r in results if r.get("success", False))

    return {
        "message": f"Poslano {total} grupa artikala prema OptimoRoute, uspješno: {ok}, grešaka: {total - ok}",
        "total": total,
        "success_count": ok,
        "results": results,
    }
