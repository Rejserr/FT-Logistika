"""
API endpoints za upravljanje nalozima u rutiranju.

Prebacivanje naloga iz originala u rutiranje, vraćanje natrag,
arhiviranje dostavljenih, prerutiranje nedostavljenih.
"""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.core.warehouse_scope import apply_warehouse_filter
from app.db.session import get_db
from app.models.erp_models import NalogDetail, NalogHeader, Partner
from app.models.regional_models import PostanskiBroj, Regija
from app.models.routing_models import Ruta, RutaStop
from app.models.user_models import User
from app.models.routing_order_models import (
    NalogDetailArhiva,
    NalogDetailRutiranje,
    NalogHeaderArhiva,
    NalogHeaderRutiranje,
)
from app.models.vehicle_models import Vozilo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routing")


# =============================================================================
# Pydantic schemas
# =============================================================================

class PrebaciRequest(BaseModel):
    """Prebaci označene naloge u rutiranje tablice."""
    nalog_uids: list[str] = Field(..., min_length=1)


class VratiRequest(BaseModel):
    """Vrati naloge iz rutiranja natrag u original."""
    nalog_uids: list[str] = Field(..., min_length=1)


class ArhivirajRequest(BaseModel):
    """Arhiviraj dostavljene naloge s rute."""
    ruta_id: int


class PrerutirajRequest(BaseModel):
    """Resetiraj nedostavljene naloge za novu rutu."""
    nalog_uids: list[str] = Field(..., min_length=1)


class RutiranjeNalogOut(BaseModel):
    """Output za nalog u rutiranju (sa partner podacima)."""
    nalog_prodaje_uid: str
    broj: int | None = None
    datum: Any = None
    raspored: Any = None
    skladiste: str | None = None
    status: str | None = None
    partner_uid: str | None = None
    total_weight: float | None = None
    total_volume: float | None = None
    regija_id: int | None = None
    ruta_id: int | None = None
    status_rutiranja: str | None = None
    prebaceno_at: Any = None
    # Partner podaci
    partner_naziv: str | None = None
    partner_ime: str | None = None
    partner_prezime: str | None = None
    partner_adresa: str | None = None
    partner_naziv_mjesta: str | None = None
    partner_postanski_broj: str | None = None
    partner_drzava: str | None = None
    partner_kontakt_osoba: str | None = None
    partner_mobitel: str | None = None
    partner_telefon: str | None = None
    partner_e_mail: str | None = None
    regija_naziv: str | None = None
    # Izračunate kolone
    kupac: str | None = None
    poruka_gore: str | None = None
    poruka_dolje: str | None = None
    napomena: str | None = None
    na_uvid: str | None = None
    kreirao__radnik_ime: str | None = None
    vrsta_isporuke: str | None = None


# =============================================================================
# Helperi
# =============================================================================

# Kolone za kopiranje headera (zajednicke za NalogHeader i NalogHeaderRutiranje)
_HEADER_COPY_COLS = [
    "nalog_prodaje_uid", "nalog_prodaje_b2b", "broj", "datum",
    "rezervacija_od_datuma", "rezervacija_do_datuma", "raspored",
    "skladiste", "skladiste_b2b", "na__skladiste", "na__skladiste_b2b",
    "partner_uid", "partner", "partner_b2b",
    "korisnik__partner_uid", "korisnik__partner", "korisnik__partner_b2b",
    "agent__partner_uid", "agent__partner", "agent__partner_b2b",
    "narudzba", "kupac_placa_isporuku", "valuta", "valuta_b2b",
    "tecaj", "generalni_rabat", "placa_porez", "cassa_sconto",
    "poruka_gore", "poruka_dolje", "napomena", "na_uvid",
    "referenca_isporuke", "sa__skladiste", "sa__skladiste_b2b",
    "skl_dokument", "skl_dokument_b2b", "status", "status_b2b",
    "komercijalist__radnik", "komercijalist__radnik_b2b",
    "dostavljac_uid", "dostavljac__radnik", "dostavljac__radnik_b2b",
    "kreirao__radnik_uid", "kreirao__radnik", "kreirao__radnik_ime",
    "vrsta_isporuke", "vrsta_isporuke_b2b",
    "izravna_dostava", "dropoff_sifra", "dropoff_naziv",
    "user_uid", "username", "user_b2b",
    "tip_racuna_uid", "tip_racuna", "tip_racuna_b2b",
    "predmet_uid", "predmet", "predmet_b2b",
    "za_naplatu", "zki", "jir",
  "regija_id", "vozilo_tip", "total_weight", "total_volume",
  "manual_paleta",
  "synced_at", "created_at", "updated_at",
]

_DETAIL_COPY_COLS = [
    "stavka_uid", "nalog_prodaje_uid", "artikl", "artikl_uid", "artikl_b2b",
    "mjesto_troska", "mjesto_troska_uid", "mjesto_troska_b2b",
    "predmet", "predmet_uid", "predmet_b2b",
    "opis", "kolicina", "pakiranja", "cijena",
    "detaljni_opis", "specifikacija", "rabat", "dodatni_rabat",
    "redoslijed", "synced_at", "created_at", "updated_at",
]


def _copy_header(src, TargetCls):
    """Kopiraj sve zajednicke kolone iz src u novu instancu TargetCls."""
    data = {}
    for col in _HEADER_COPY_COLS:
        data[col] = getattr(src, col, None)
    return TargetCls(**data)


def _copy_detail(src, TargetCls):
    """Kopiraj sve zajednicke kolone iz src u novu instancu TargetCls."""
    data = {}
    for col in _DETAIL_COPY_COLS:
        data[col] = getattr(src, col, None)
    return TargetCls(**data)


def _archive_delivered_stops(db: Session, ruta: Ruta) -> int:
    """
    Arhiviraj sve DELIVERED stopove s rute.
    Vraća broj arhiviranih naloga. NE radi commit (pozivatelj mora).
    """
    stops = db.execute(
        select(RutaStop).where(
            RutaStop.ruta_id == ruta.id,
            RutaStop.status == "DELIVERED",
        )
    ).scalars().all()

    if not stops:
        return 0

    vozilo = db.get(Vozilo, ruta.vozilo_id) if ruta.vozilo_id else None
    vozilo_oznaka = vozilo.oznaka if vozilo else None
    total_stops = len(stops)
    archived = 0

    for stop in stops:
        rut_header = db.get(NalogHeaderRutiranje, stop.nalog_uid)
        if not rut_header:
            continue

        arhiv_data = {}
        for col in _HEADER_COPY_COLS:
            arhiv_data[col] = getattr(rut_header, col, None)
        arhiv_header = NalogHeaderArhiva(**arhiv_data)
        arhiv_header.ruta_id = ruta.id
        arhiv_header.ruta_datum = ruta.datum
        arhiv_header.ruta_algoritam = ruta.algoritam
        arhiv_header.vozilo_id = ruta.vozilo_id
        arhiv_header.vozilo_oznaka = vozilo_oznaka
        arhiv_header.vozac_id = ruta.vozac_id
        arhiv_header.redoslijed_dostave = stop.redoslijed
        arhiv_header.eta = stop.eta
        arhiv_header.status_dostave = "DELIVERED"
        arhiv_header.ukupna_distance_rute_km = float(ruta.distance_km) if ruta.distance_km else None
        arhiv_header.ukupno_trajanje_rute_min = ruta.duration_min
        arhiv_header.broj_stopova_na_ruti = total_stops
        db.add(arhiv_header)
        db.flush()

        rut_details = db.execute(
            select(NalogDetailRutiranje).where(
                NalogDetailRutiranje.nalog_prodaje_uid == stop.nalog_uid
            )
        ).scalars().all()
        for rd in rut_details:
            detail_data = {}
            for col in _DETAIL_COPY_COLS:
                detail_data[col] = getattr(rd, col, None)
            arhiv_detail = NalogDetailArhiva(**detail_data)
            arhiv_detail.arhiva_header_id = arhiv_header.id
            db.add(arhiv_detail)

        # Brisi iz rutiranja
        db.execute(
            delete(NalogDetailRutiranje).where(
                NalogDetailRutiranje.nalog_prodaje_uid == stop.nalog_uid
            )
        )
        db.delete(rut_header)

        # Brisi i iz originala ako postoji
        orig = db.get(NalogHeader, stop.nalog_uid)
        if orig:
            db.execute(
                delete(NalogDetail).where(NalogDetail.nalog_prodaje_uid == stop.nalog_uid)
            )
            db.delete(orig)

        archived += 1

    logger.info("_archive_delivered_stops: ruta %d, arhivirano %d", ruta.id, archived)
    return archived


def _enrich_with_partner(nalog, partner, regija_naziv=None) -> dict:
    """Obogati nalog s partner podacima za frontend."""
    d: dict[str, Any] = {
        "nalog_prodaje_uid": nalog.nalog_prodaje_uid,
        "broj": nalog.broj,
        "datum": str(nalog.datum) if nalog.datum else None,
        "raspored": str(nalog.raspored) if nalog.raspored else None,
        "skladiste": nalog.skladiste,
        "status": nalog.status,
        "partner_uid": nalog.partner_uid,
        "total_weight": float(nalog.total_weight) if nalog.total_weight else None,
        "total_volume": float(nalog.total_volume) if nalog.total_volume else None,
        "regija_id": nalog.regija_id,
        "ruta_id": getattr(nalog, "ruta_id", None),
        "status_rutiranja": getattr(nalog, "status_rutiranja", None),
        "prebaceno_at": str(nalog.prebaceno_at) if getattr(nalog, "prebaceno_at", None) else None,
        "poruka_gore": nalog.poruka_gore,
        "poruka_dolje": nalog.poruka_dolje,
        "napomena": nalog.napomena,
        "na_uvid": nalog.na_uvid,
        "kreirao__radnik_ime": nalog.kreirao__radnik_ime,
        "vrsta_isporuke": nalog.vrsta_isporuke,
    }
    if partner:
        d["partner_naziv"] = partner.naziv
        d["partner_ime"] = partner.ime
        d["partner_prezime"] = partner.prezime
        d["partner_adresa"] = partner.adresa
        d["partner_naziv_mjesta"] = partner.naziv_mjesta
        d["partner_postanski_broj"] = partner.postanski_broj
        d["partner_drzava"] = partner.drzava
        d["partner_kontakt_osoba"] = partner.kontakt_osoba
        d["partner_mobitel"] = partner.mobitel
        d["partner_telefon"] = partner.telefon
        d["partner_e_mail"] = getattr(partner, "e_mail", None)
        # Kupac = naziv ili ime prezime
        kupac = partner.naziv or ""
        if not kupac and (partner.ime or partner.prezime):
            kupac = f"{partner.ime or ''} {partner.prezime or ''}".strip()
        elif kupac and (partner.ime or partner.prezime):
            kupac = f"{kupac} => {partner.ime or ''} {partner.prezime or ''}".strip()
        d["kupac"] = kupac
    else:
        d["kupac"] = None
    d["regija_naziv"] = regija_naziv
    return d


# =============================================================================
# Endpointi
# =============================================================================


@router.post("/prebaci-u-rutiranje")
def prebaci_u_rutiranje(
    payload: PrebaciRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Kopiraj označene naloge iz nalozi_header/details u nalozi_header_rutiranje/details_rutiranje.
    Originale NE brišemo — brišu se tek kad se kreira ruta sa statusom PLANNED.
    """
    uids = payload.nalog_uids
    # Provjeri da nisu vec u rutiranju
    existing = db.execute(
        select(NalogHeaderRutiranje.nalog_prodaje_uid).where(
            NalogHeaderRutiranje.nalog_prodaje_uid.in_(uids)
        )
    ).scalars().all()
    existing_set = set(existing)
    new_uids = [u for u in uids if u not in existing_set]

    if not new_uids:
        return {"prebaceno": 0, "vec_u_rutiranju": len(existing_set)}

    # Dohvati headere
    headers = db.execute(
        select(NalogHeader).where(NalogHeader.nalog_prodaje_uid.in_(new_uids))
    ).scalars().all()

    copied = 0
    for h in headers:
        rut_header = _copy_header(h, NalogHeaderRutiranje)
        db.add(rut_header)
        db.flush()

        details = db.execute(
            select(NalogDetail).where(NalogDetail.nalog_prodaje_uid == h.nalog_prodaje_uid)
        ).scalars().all()
        for d in details:
            rut_detail = _copy_detail(d, NalogDetailRutiranje)
            db.add(rut_detail)

        # Fizički obriši iz originala
        db.execute(
            delete(NalogDetail).where(NalogDetail.nalog_prodaje_uid == h.nalog_prodaje_uid)
        )
        db.delete(h)
        copied += 1

    db.commit()
    logger.info("Prebačeno %d naloga u rutiranje (obrisano iz originala)", copied)
    return {"prebaceno": copied, "vec_u_rutiranju": len(existing_set)}


@router.post("/vrati-iz-rutiranja")
def vrati_iz_rutiranja(
    payload: VratiRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Vrati naloge iz rutiranja natrag u original tablice.
    Nalog se kopira natrag u nalozi_header/details ako ne postoji,
    a briše se iz rutiranja.
    """
    uids = payload.nalog_uids
    returned = 0

    for uid in uids:
        rut_header = db.get(NalogHeaderRutiranje, uid)
        if not rut_header:
            continue

        # Provjeri da nalog vec ne postoji u originalu (ne bi smjelo, ali sigurnost)
        orig = db.get(NalogHeader, uid)
        if not orig:
            # Kopiraj natrag u original
            new_header = _copy_header(rut_header, NalogHeader)
            db.add(new_header)
            db.flush()  # Header mora biti upisan PRIJE stavki (FK constraint)

            rut_details = db.execute(
                select(NalogDetailRutiranje).where(
                    NalogDetailRutiranje.nalog_prodaje_uid == uid
                )
            ).scalars().all()
            for rd in rut_details:
                new_detail = _copy_detail(rd, NalogDetail)
                db.add(new_detail)

        # Brisi iz rutiranja (cascade ce obrisati i details)
        db.execute(
            delete(NalogDetailRutiranje).where(NalogDetailRutiranje.nalog_prodaje_uid == uid)
        )
        db.delete(rut_header)
        returned += 1

    db.commit()
    logger.info("Vraćeno %d naloga iz rutiranja u original", returned)
    return {"vraceno": returned}


@router.get("/rutiranje-nalozi", response_model=list[RutiranjeNalogOut])
def list_rutiranje_nalozi(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[RutiranjeNalogOut]:
    """
    Dohvati sve naloge u rutiranju, obogaćene partner podacima i regijom.
    """
    query = (
        select(NalogHeaderRutiranje, Partner, Regija.naziv.label("regija_naziv"))
        .outerjoin(Partner, NalogHeaderRutiranje.partner_uid == Partner.partner_uid)
        .outerjoin(PostanskiBroj, PostanskiBroj.postanski_broj == Partner.postanski_broj)
        .outerjoin(Regija, Regija.id == PostanskiBroj.regija_id)
    )
    query = apply_warehouse_filter(query, NalogHeaderRutiranje, current_user, db)
    rows = db.execute(query).all()

    result = []
    seen: set[str] = set()
    for nalog, partner, regija_naziv in rows:
        uid = nalog.nalog_prodaje_uid
        if uid in seen:
            continue
        seen.add(uid)
        d = _enrich_with_partner(nalog, partner, regija_naziv)
        result.append(RutiranjeNalogOut(**d))

    return result


@router.get("/rutiranje-uids")
def get_rutiranje_uids(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[str]:
    """
    Vrati UID-ove svih naloga koji su trenutno u rutiranju.
    Koristi se za filtriranje na OrdersPage (da se ne prikazuju nalozi u rutiranju).
    """
    query = select(NalogHeaderRutiranje.nalog_prodaje_uid)
    query = apply_warehouse_filter(query, NalogHeaderRutiranje, current_user, db)
    uids = db.execute(query).scalars().all()
    return list(uids)


@router.post("/arhiviraj")
def arhiviraj_dostavljene(
    payload: ArhivirajRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Arhiviraj dostavljene naloge s rute.
    Kopira iz rutiranja u arhiv tablice, briše iz rutiranja.
    """
    ruta = db.get(Ruta, payload.ruta_id)
    if not ruta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta nije pronađena.")

    archived = _archive_delivered_stops(db, ruta)
    db.commit()
    return {"arhivirano": archived}


@router.post("/prerutiraj")
def prerutiraj(
    payload: PrerutirajRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Resetiraj nedostavljene naloge za novu rutu.
    Postavlja status_rutiranja na CEKA_RUTU i ruta_id na NULL.
    """
    uids = payload.nalog_uids
    updated = 0

    for uid in uids:
        rut_header = db.get(NalogHeaderRutiranje, uid)
        if not rut_header:
            continue
        rut_header.status_rutiranja = "CEKA_RUTU"
        rut_header.ruta_id = None
        updated += 1

    db.commit()
    logger.info("Prerutirano %d naloga", updated)
    return {"prerutirano": updated}


class ObradaRuteRequest(BaseModel):
    """Obradi završenu rutu - arhiviraj dostavljene, vrati neuspjele."""
    ruta_id: int


class VratiStopRequest(BaseModel):
    """Vrati pojedinačni neuspjeli nalog s rute."""
    ruta_id: int
    nalog_uid: str
    destination: str = Field(..., pattern="^(nalozi|rutiranje)$")


@router.post("/obradi-rutu")
def obradi_zavrsenu_rutu(
    payload: ObradaRuteRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Obradi završenu rutu:
    1. Arhiviraj DELIVERED naloge u nalozi_header_arhiva/details_arhiva
    2. Vrati FAILED/SKIPPED naloge u rutiranje (CEKA_RUTU) za novu rutu
    """
    ruta = db.get(Ruta, payload.ruta_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta nije pronađena.")

    # Arhiviraj dostavljene
    archived = _archive_delivered_stops(db, ruta)

    # Vrati neuspjele u rutiranje
    stops = db.execute(
        select(RutaStop).where(
            RutaStop.ruta_id == payload.ruta_id,
            RutaStop.status.in_(["FAILED", "SKIPPED"]),
        )
    ).scalars().all()

    rerouted = 0
    for stop in stops:
        rut_header = db.get(NalogHeaderRutiranje, stop.nalog_uid)
        if rut_header:
            rut_header.status_rutiranja = "CEKA_RUTU"
            rut_header.ruta_id = None
            rerouted += 1

    db.commit()
    logger.info(
        "Obrada rute %d: arhivirano=%d, prerutirano=%d",
        payload.ruta_id, archived, rerouted,
    )
    return {
        "arhivirano": archived,
        "prerutirano": rerouted,
        "message": f"Arhivirano {archived} dostavljenih, {rerouted} vraćeno za novu rutu.",
    }


@router.post("/vrati-stop")
def vrati_stop_s_rute(
    payload: VratiStopRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Vrati pojedinačni nalog s završene rute natrag u naloge ili rutiranje.
    destination='nalozi' - vraća u nalozi_header/details
    destination='rutiranje' - vraća u rutiranje (CEKA_RUTU) za novu rutu
    """
    rut_header = db.get(NalogHeaderRutiranje, payload.nalog_uid)
    if not rut_header:
        raise HTTPException(404, f"Nalog {payload.nalog_uid} nije pronađen u rutiranju.")

    # Provjeri stop na ruti
    stop = db.execute(
        select(RutaStop).where(
            RutaStop.ruta_id == payload.ruta_id,
            RutaStop.nalog_uid == payload.nalog_uid,
        )
    ).scalar_one_or_none()

    if payload.destination == "nalozi":
        # Vrati u originalne tablice
        orig = db.get(NalogHeader, payload.nalog_uid)
        if not orig:
            new_header = _copy_header(rut_header, NalogHeader)
            db.add(new_header)
            db.flush()

            rut_details = db.execute(
                select(NalogDetailRutiranje).where(
                    NalogDetailRutiranje.nalog_prodaje_uid == payload.nalog_uid
                )
            ).scalars().all()
            for rd in rut_details:
                new_detail = _copy_detail(rd, NalogDetail)
                db.add(new_detail)

        # Brisi iz rutiranja
        db.execute(
            delete(NalogDetailRutiranje).where(
                NalogDetailRutiranje.nalog_prodaje_uid == payload.nalog_uid
            )
        )
        db.delete(rut_header)

        # Ukloni stop s rute
        if stop:
            db.delete(stop)

        db.commit()
        logger.info("Nalog %s vraćen u naloge s rute %d", payload.nalog_uid, payload.ruta_id)
        return {"status": "ok", "destination": "nalozi", "nalog_uid": payload.nalog_uid}

    elif payload.destination == "rutiranje":
        # Vrati u rutiranje za novu rutu
        rut_header.status_rutiranja = "CEKA_RUTU"
        rut_header.ruta_id = None

        # Ukloni stop s rute
        if stop:
            db.delete(stop)

        db.commit()
        logger.info("Nalog %s vraćen u rutiranje s rute %d", payload.nalog_uid, payload.ruta_id)
        return {"status": "ok", "destination": "rutiranje", "nalog_uid": payload.nalog_uid}

    raise HTTPException(400, "Nepoznata destinacija.")
