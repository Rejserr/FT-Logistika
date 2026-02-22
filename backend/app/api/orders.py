"""
API endpoints za naloge (orders).
"""
from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.core.warehouse_scope import apply_warehouse_filter
from app.db.session import get_db
from app.models.erp_models import Artikl, ArtiklKriterija, NalogDetail, NalogHeader, NaloziBlacklist, Partner, VrstaIsporuke
from app.models.config_models import SyncStatus
from app.models.regional_models import PostanskiBroj, Regija
from app.models.user_models import User
from app.schemas.orders import (
    NalogDetailOut,
    NalogHeaderOut,
    NalogListOut,
    NalogUpdate,
    PartnerListOut,
    PartnerOut,
    PartnerUpdate,
    SyncStatusCreate,
    SyncStatusOut,
    SyncStatusUpdate,
    VrstaIsporukeCreate,
    VrstaIsporukeOut,
    VrstaIsporukeUpdate,
)

router = APIRouter()


class BlacklistRequest(BaseModel):
    nalog_uids: list[str] = Field(..., min_length=1)
    razlog: str | None = None


class BlacklistItem(BaseModel):
    nalog_prodaje_uid: str
    razlog: str | None
    blocked_by: str | None
    blocked_at: str | None


# =============================================================================
# Orders endpoints
# =============================================================================

@router.get("/orders", response_model=list[NalogHeaderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None, alias="date_from"),
    date_to: date | None = Query(default=None, alias="date_to"),
    raspored_from: date | None = Query(default=None, alias="raspored_from"),
    raspored_to: date | None = Query(default=None, alias="raspored_to"),
    partner_uid: str | None = Query(default=None, alias="partner_uid"),
    vrsta_isporuke: str | None = Query(default=None, alias="vrsta_isporuke"),
    limit: int = Query(default=100, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[NalogHeaderOut]:
    """Dohvati listu naloga s filterima (sva polja nalozi_header + partner/dostava + regija)."""
    # First: fetch distinct header UIDs with filters and limit applied
    header_q = select(NalogHeader)
    header_q = apply_warehouse_filter(header_q, NalogHeader, current_user, db)

    if status_filter:
        header_q = header_q.where(NalogHeader.status == status_filter)
    if date_from:
        header_q = header_q.where(NalogHeader.datum >= date_from)
    if date_to:
        header_q = header_q.where(NalogHeader.datum <= date_to)
    if raspored_from:
        header_q = header_q.where(NalogHeader.raspored >= raspored_from)
    if raspored_to:
        header_q = header_q.where(NalogHeader.raspored <= raspored_to)
    if partner_uid:
        header_q = header_q.where(NalogHeader.partner_uid == partner_uid)
    if vrsta_isporuke:
        header_q = header_q.where(NalogHeader.vrsta_isporuke == vrsta_isporuke)

    header_q = header_q.order_by(NalogHeader.datum.desc()).offset(offset).limit(limit)
    headers = db.execute(header_q).scalars().all()

    # Second: enrich with partner + regija data (no duplicates possible)
    result: list[NalogHeaderOut] = []
    for header in headers:
        out = NalogHeaderOut.model_validate(header)

        if header.partner_uid:
            partner = db.get(Partner, header.partner_uid)
            if partner:
                out.partner_naziv = partner.naziv
                out.partner_ime = partner.ime
                out.partner_prezime = partner.prezime
                out.partner_mobitel = partner.mobitel
                out.partner_adresa = partner.adresa
                out.partner_telefon = partner.telefon
                out.partner_naziv_mjesta = partner.naziv_mjesta
                out.partner_postanski_broj = partner.postanski_broj
                out.partner_drzava = partner.drzava
                out.partner_kontakt_osoba = partner.kontakt_osoba
                out.partner_e_mail = partner.e_mail

                if partner.postanski_broj:
                    pb = db.execute(
                        select(PostanskiBroj).where(
                            PostanskiBroj.postanski_broj == partner.postanski_broj
                        ).limit(1)
                    ).scalar_one_or_none()
                    if pb and pb.regija_id:
                        regija = db.get(Regija, pb.regija_id)
                        out.regija_naziv = regija.naziv if regija else None

        result.append(out)
    return result


@router.get("/orders/with-criteria", response_model=list[str])
def get_orders_with_criteria(db: Session = Depends(get_db)) -> list[str]:
    """Vraća listu nalog_prodaje_uid-ova čije stavke sadrže artikle s dodijeljenim kriterijima."""
    rows = db.execute(
        select(NalogDetail.nalog_prodaje_uid)
        .where(
            NalogDetail.artikl.in_(
                select(ArtiklKriterija.artikl).distinct()
            )
        )
        .distinct()
    ).scalars().all()
    return list(rows)


@router.get("/orders/blacklist", response_model=list[BlacklistItem])
def list_blacklisted_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[BlacklistItem]:
    """Prikaži sve blokirane naloge."""
    rows = db.execute(
        select(NaloziBlacklist).order_by(NaloziBlacklist.blocked_at.desc())
    ).scalars().all()
    return [
        BlacklistItem(
            nalog_prodaje_uid=r.nalog_prodaje_uid,
            razlog=r.razlog,
            blocked_by=r.blocked_by,
            blocked_at=r.blocked_at.isoformat() if r.blocked_at else None,
        )
        for r in rows
    ]


@router.get("/orders/{nalog_prodaje_uid}", response_model=NalogHeaderOut)
def get_order(nalog_prodaje_uid: str, db: Session = Depends(get_db)) -> NalogHeaderOut:
    """Dohvati pojedinačni nalog s detaljima (stavkama) i podacima partnera (dostava)."""
    header = db.get(NalogHeader, nalog_prodaje_uid)
    if not header:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nalog nije pronađen.")
    partner = db.get(Partner, header.partner_uid) if header.partner_uid else None
    # Dohvati stavke s joinanim artiklom
    detail_rows = (
        db.execute(
            select(NalogDetail, Artikl)
            .outerjoin(Artikl, NalogDetail.artikl_uid == Artikl.artikl_uid)
            .where(NalogDetail.nalog_prodaje_uid == nalog_prodaje_uid)
        )
        .all()
    )
    header_out = NalogHeaderOut.model_validate(header)
    details_out: list[NalogDetailOut] = []
    for detail, artikl in detail_rows:
        detail_item = NalogDetailOut.model_validate(detail)
        if artikl:
            detail_item.artikl_naziv_kratki = artikl.naziv_kratki
            detail_item.artikl_jm = artikl.jm
            detail_item.artikl_masa = float(artikl.masa) if artikl.masa else None
            detail_item.artikl_volumen = float(artikl.volumen) if artikl.volumen else None
            detail_item.artikl_visina = float(artikl.visina) if artikl.visina else None
        details_out.append(detail_item)
    header_out.details = details_out
    if partner:
        header_out.partner_naziv = partner.naziv
        header_out.partner_ime = partner.ime
        header_out.partner_prezime = partner.prezime
        header_out.partner_mobitel = partner.mobitel
        header_out.partner_adresa = partner.adresa
        header_out.partner_telefon = partner.telefon
        header_out.partner_naziv_mjesta = partner.naziv_mjesta
        header_out.partner_postanski_broj = partner.postanski_broj
        header_out.partner_drzava = partner.drzava
        header_out.partner_kontakt_osoba = partner.kontakt_osoba
        header_out.partner_e_mail = partner.e_mail

        if partner.postanski_broj:
            pb = (
                db.execute(
                    select(PostanskiBroj)
                    .where(PostanskiBroj.postanski_broj == partner.postanski_broj)
                    .limit(1)
                )
                .scalars()
                .first()
            )
            if pb and pb.regija_id:
                regija = db.get(Regija, pb.regija_id)
                if regija:
                    header_out.regija_naziv = regija.naziv
    return header_out


@router.put("/orders/{nalog_prodaje_uid}", response_model=NalogHeaderOut)
def update_order(
    nalog_prodaje_uid: str, payload: NalogUpdate, db: Session = Depends(get_db)
) -> NalogHeaderOut:
    """Ažuriraj interna polja naloga (regija, vozilo_tip, weight/volume)."""
    header = db.get(NalogHeader, nalog_prodaje_uid)
    if not header:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nalog nije pronađen.")
    
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(header, field, value)
    
    db.commit()
    db.refresh(header)
    return header


@router.patch("/orders/{nalog_prodaje_uid}/manual-paleta")
def set_manual_paleta(
    nalog_prodaje_uid: str,
    body: dict,
    db: Session = Depends(get_db),
):
    """Postavi ručni broj paleta za nalog."""
    header = db.get(NalogHeader, nalog_prodaje_uid)
    if not header:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nalog nije pronađen.")
    header.manual_paleta = body.get("manual_paleta")
    db.commit()
    return {"nalog_prodaje_uid": nalog_prodaje_uid, "manual_paleta": header.manual_paleta}


# =============================================================================
# Partners endpoints
# =============================================================================

@router.get("/partners", response_model=list[PartnerListOut])
def list_partners(
    search: str | None = Query(default=None),
    blokiran: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[PartnerListOut]:
    """Dohvati listu partnera."""
    query = select(Partner)
    
    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Partner.partner.ilike(pattern)) |
            (Partner.naziv.ilike(pattern)) |
            (Partner.ime.ilike(pattern)) |
            (Partner.prezime.ilike(pattern)) |
            (Partner.oib.ilike(pattern))
        )
    
    if blokiran:
        query = query.where(Partner.blokiran == blokiran)
    
    query = query.order_by(Partner.partner).offset(offset).limit(limit)
    return db.execute(query).scalars().all()


@router.get("/partners/{partner_uid}", response_model=PartnerOut)
def get_partner(partner_uid: str, db: Session = Depends(get_db)) -> PartnerOut:
    """Dohvati pojedinačnog partnera."""
    partner = db.get(Partner, partner_uid)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner nije pronađen.")
    return partner


@router.patch("/partners/{partner_uid}", response_model=PartnerOut)
def update_partner(
    partner_uid: str,
    payload: PartnerUpdate,
    db: Session = Depends(get_db),
) -> PartnerOut:
    """Ažurira podatke partnera. Samo poslana polja se mijenjaju."""
    partner = db.get(Partner, partner_uid)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner nije pronađen.")

    updated_fields = payload.model_dump(exclude_unset=True)
    for field, value in updated_fields.items():
        setattr(partner, field, value)

    # Ako se promijenio poštanski broj, ažuriraj regiju na svim nalozima tog partnera
    if "postanski_broj" in updated_fields:
        new_pb = updated_fields["postanski_broj"]
        pb_row = db.execute(
            select(PostanskiBroj).where(PostanskiBroj.postanski_broj == new_pb).limit(1)
        ).scalars().first()
        new_regija_id = pb_row.regija_id if pb_row else None

        # Ažuriraj naloge koji koriste ovog partnera
        nalozi = db.execute(
            select(NalogHeader).where(NalogHeader.partner_uid == partner_uid)
        ).scalars().all()
        for nalog in nalozi:
            nalog.regija_id = new_regija_id

    db.commit()
    db.refresh(partner)
    return partner


# =============================================================================
# Vrste isporuke endpoints
# =============================================================================

@router.get("/vrste-isporuke", response_model=list[VrstaIsporukeOut])
def list_vrste_isporuke(
    aktivan: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[VrstaIsporukeOut]:
    """Dohvati sve vrste isporuke."""
    query = select(VrstaIsporuke)
    if aktivan is not None:
        query = query.where(VrstaIsporuke.aktivan == aktivan)
    query = query.order_by(VrstaIsporuke.vrsta_isporuke)
    return db.execute(query).scalars().all()


@router.post("/vrste-isporuke", response_model=VrstaIsporukeOut, status_code=status.HTTP_201_CREATED)
def create_vrsta_isporuke(
    payload: VrstaIsporukeCreate, db: Session = Depends(get_db)
) -> VrstaIsporukeOut:
    """Kreiraj novu vrstu isporuke."""
    existing = db.execute(
        select(VrstaIsporuke).where(VrstaIsporuke.vrsta_isporuke == payload.vrsta_isporuke)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vrsta isporuke '{payload.vrsta_isporuke}' već postoji."
        )
    
    vrsta = VrstaIsporuke(**payload.model_dump())
    db.add(vrsta)
    db.commit()
    db.refresh(vrsta)
    return vrsta


@router.put("/vrste-isporuke/{vrsta_id}", response_model=VrstaIsporukeOut)
def update_vrsta_isporuke(
    vrsta_id: int, payload: VrstaIsporukeUpdate, db: Session = Depends(get_db)
) -> VrstaIsporukeOut:
    """Ažuriraj vrstu isporuke."""
    vrsta = db.get(VrstaIsporuke, vrsta_id)
    if not vrsta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vrsta isporuke nije pronađena.")
    
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vrsta, field, value)
    
    db.commit()
    db.refresh(vrsta)
    return vrsta


@router.delete("/vrste-isporuke/{vrsta_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vrsta_isporuke(vrsta_id: int, db: Session = Depends(get_db)) -> None:
    """Obriši vrstu isporuke."""
    vrsta = db.get(VrstaIsporuke, vrsta_id)
    if not vrsta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vrsta isporuke nije pronađena.")
    
    db.delete(vrsta)
    db.commit()


# =============================================================================
# Sync statusi endpoints
# =============================================================================

@router.get("/sync-statusi", response_model=list[SyncStatusOut])
def list_sync_statusi(db: Session = Depends(get_db)) -> list[SyncStatusOut]:
    """Dohvati sve sync statuse (kriteriji za sinkronizaciju naloga)."""
    return db.execute(
        select(SyncStatus).order_by(SyncStatus.status_id)
    ).scalars().all()


@router.post("/sync-statusi", response_model=SyncStatusOut, status_code=status.HTTP_201_CREATED)
def create_sync_status(
    payload: SyncStatusCreate, db: Session = Depends(get_db)
) -> SyncStatusOut:
    """Dodaj novi status za sinkronizaciju."""
    existing = db.execute(
        select(SyncStatus).where(SyncStatus.status_id == payload.status_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"Status '{payload.status_id}' već postoji.")
    ss = SyncStatus(**payload.model_dump())
    db.add(ss)
    db.commit()
    db.refresh(ss)
    return ss


@router.put("/sync-statusi/{sync_status_id}", response_model=SyncStatusOut)
def update_sync_status(
    sync_status_id: int, payload: SyncStatusUpdate, db: Session = Depends(get_db)
) -> SyncStatusOut:
    """Ažuriraj sync status."""
    ss = db.get(SyncStatus, sync_status_id)
    if not ss:
        raise HTTPException(404, "Sync status nije pronađen.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ss, field, value)
    db.commit()
    db.refresh(ss)
    return ss


@router.delete("/sync-statusi/{sync_status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sync_status(sync_status_id: int, db: Session = Depends(get_db)) -> None:
    """Obriši sync status."""
    ss = db.get(SyncStatus, sync_status_id)
    if not ss:
        raise HTTPException(404, "Sync status nije pronađen.")
    db.delete(ss)
    db.commit()


# =============================================================================
# Blacklist (blokirani nalozi)
# =============================================================================

@router.post("/orders/delete-and-blacklist")
def delete_and_blacklist_orders(
    payload: BlacklistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Obriši naloge iz nalozi_header/details i stavi na blacklist da se ne importiraju ponovno."""
    deleted = 0
    for uid in payload.nalog_uids:
        header = db.get(NalogHeader, uid)
        if header:
            db.execute(delete(NalogDetail).where(NalogDetail.nalog_prodaje_uid == uid))
            db.delete(header)
            deleted += 1

        if not db.get(NaloziBlacklist, uid):
            db.add(NaloziBlacklist(
                nalog_prodaje_uid=uid,
                razlog=payload.razlog or "Ručno obrisano",
                blocked_by=current_user.username,
            ))

    db.commit()
    return {"obrisano": deleted, "blacklisted": len(payload.nalog_uids)}


@router.post("/orders/unblacklist")
def unblacklist_orders(
    payload: BlacklistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Ukloni naloge s blacklista — sljedeći sync će ih ponovo importirati."""
    removed = 0
    for uid in payload.nalog_uids:
        bl = db.get(NaloziBlacklist, uid)
        if bl:
            db.delete(bl)
            removed += 1
    db.commit()
    return {"uklonjeno": removed}
