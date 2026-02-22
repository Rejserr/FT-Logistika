"""
Sync servis za uvoz podataka iz ERP-a (Luceed) u FTLogistika bazu.

Proširena verzija s filtriranjem po vrsti isporuke i potpunim mapiranjem polja.
"""
from __future__ import annotations

import asyncio
import logging
import sys
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.erp_models import Artikl, GrupaArtikla, NalogDetail, NalogHeader, Partner, VrstaIsporuke
from app.models.regional_models import PostanskiBroj
from app.models.erp_models import NaloziBlacklist
from app.models.routing_order_models import NalogHeaderRutiranje, NalogHeaderArhiva
from app.models.sync_models import SyncLog
from app.models.config_models import RefreshLog
from app.services.erp_client import erp_client

logger = logging.getLogger(__name__)


def _log(msg: str) -> None:
    """Print + flush za terminalni ispis u sync background tasku."""
    import sys
    print(msg, flush=True)
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


# ==============================================================================
# Helper funkcije za parsiranje
# ==============================================================================

def _safe_decimal(value: Any, default: Decimal | None = None) -> Decimal | None:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _safe_int(value: Any, default: int | None = None) -> int | None:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except Exception:
        return default


def _safe_date(value: Any) -> date | None:
    """Parse ERP date format DD.MM.YYYY or YYYY-MM-DD."""
    if not value:
        return None
    if isinstance(value, date):
        return value
    s = str(value).strip()
    # Ukloni vrijeme ako postoji (npr. "30.01.2026. 10:15:12")
    if " " in s:
        s = s.split(" ")[0]
    # Ukloni trailing dot
    s = s.rstrip(".")
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _safe_datetime(value: Any) -> datetime | None:
    """Parse ERP datetime format DD.MM.YYYY. HH:MM:SS ili slični formati."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    for fmt in (
        "%d.%m.%Y. %H:%M:%S",
        "%d.%m.%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%d.%m.%Y",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _safe_str(value: Any) -> str | None:
    """Vrati string ili None."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _normalize_postanski_broj(value: Any) -> str | None:
    """
    Normalizira poštanski broj – uklanja razmake.
    Primjer: '10 000' → '10000'
    """
    s = _safe_str(value)
    if s is None:
        return None
    return s.replace(" ", "")


# ==============================================================================
# Mapiranje polja: ERP JSON → SQLAlchemy model
# ==============================================================================

def map_partner(erp: dict[str, Any]) -> dict[str, Any]:
    """
    Mapira ERP partner JSON na dict za Partner model.
    
    Očekuje rezultat iz: /datasnap/rest/partneri/sifra/{sifra}
    API vraća result[0].partner[0] strukturu.
    """
    return {
        "partner_uid": _safe_str(erp.get("partner_uid")),
        "partner": _safe_str(erp.get("partner")),  # šifra
        "b2b_partner": _safe_str(erp.get("b2b_partner")),
        "naziv": _safe_str(erp.get("naziv")),
        "ime": _safe_str(erp.get("ime")),
        "prezime": _safe_str(erp.get("prezime")),
        "enabled": _safe_str(erp.get("enabled")),
        "tip_komitenta": _safe_str(erp.get("tip_komitenta")),
        "mobitel": _safe_str(erp.get("mobitel")),
        "adresa": _safe_str(erp.get("adresa")),
        "maticni_broj": _safe_str(erp.get("maticni_broj")),
        "oib": _safe_str(erp.get("oib")),
        "pdv_broj": _safe_str(erp.get("pdv_broj")),
        "ziro_racun": _safe_str(erp.get("ziro_racun")),
        "telefon": _safe_str(erp.get("telefon")),
        "telefax": _safe_str(erp.get("telefax")),
        "mjesto_uid": _safe_str(erp.get("mjesto_uid")),
        "mjesto": _safe_str(erp.get("mjesto")),
        "naziv_mjesta": _safe_str(erp.get("naziv_mjesta")),
        "postanski_broj": _normalize_postanski_broj(erp.get("postanski_broj")),
        "b2b_mjesto": _safe_str(erp.get("b2b_mjesto")),
        "drzava_uid": _safe_str(erp.get("drzava_uid")),
        "drzava": _safe_str(erp.get("drzava")),
        "naziv_drzave": _safe_str(erp.get("naziv_drzave")),
        "b2b_drzava": _safe_str(erp.get("b2b_drzava")),
        "valuta": _safe_str(erp.get("valuta")),
        "b2b_valuta": _safe_str(erp.get("b2b_valuta")),
        "rabat": _safe_decimal(erp.get("rabat")),
        "limit_iznos": _safe_decimal(erp.get("limit_iznos")),
        "limit_dana": _safe_int(erp.get("limit_dana")),
        "odgoda_placanja": _safe_int(erp.get("odgoda_placanja")),
        "iznos_zaduznice": _safe_decimal(erp.get("iznos_zaduznice")),
        "blokiran": _safe_str(erp.get("blokiran")),
        "kontakt_osoba": _safe_str(erp.get("kontakt_osoba")),
        "ugovor": _safe_str(erp.get("ugovor")),
        "banka": _safe_str(erp.get("banka")),
        "swift": _safe_str(erp.get("swift")),
        "e_mail": _safe_str(erp.get("e_mail")),
        "url": _safe_str(erp.get("url")),
        "napomena": _safe_str(erp.get("napomena")),
        "upozorenje": _safe_str(erp.get("upozorenje")),
        "gln": _safe_str(erp.get("gln")),
        "placa_porez": _safe_str(erp.get("placa_porez")),
        "cassa_sconto": _safe_str(erp.get("cassa_sconto")),
        "tip_cijene": _safe_str(erp.get("tip_cijene")),
        "tip_racuna": _safe_str(erp.get("tip_racuna")),
        "datum_rodenja": _safe_date(erp.get("datum_rodenja")),
        "spol": _safe_str(erp.get("spol")),
        "placa_isporuku": _safe_str(erp.get("placa_isporuku")),
        "broj_osigurane_osobe": _safe_str(erp.get("broj_osigurane_osobe")),
        "export_cjenika": _safe_str(erp.get("export_cjenika")),
        "grupacija_uid": _safe_str(erp.get("grupacija_uid")),
        "grupacija": _safe_str(erp.get("grupacija")),
        "naziv_grupacije": _safe_str(erp.get("naziv_grupacije")),
        "parent__partner_uid": _safe_str(erp.get("parent__partner_uid")),
        "parent__partner": _safe_str(erp.get("parent__partner")),
        "parent__partner_b2b": _safe_str(erp.get("parent__partner_b2b")),
        "komercijalista_uid": _safe_str(erp.get("komercijalista_uid")),
        "komercijalista": _safe_str(erp.get("komercijalista")),
        "ime_komercijaliste": _safe_str(erp.get("ime_komercijaliste")),
        "kam_uid": _safe_str(erp.get("kam_uid")),
        "kam": _safe_str(erp.get("kam")),
        "ime_kam": _safe_str(erp.get("ime_kam")),
        "grupa_partnera_uid": _safe_str(erp.get("grupa_partnera_uid")),
        "grupa_partnera": _safe_str(erp.get("grupa_partnera")),
        "naziv_grupe_partnera": _safe_str(erp.get("naziv_grupe_partnera")),
        "agent_uid": _safe_str(erp.get("agent_uid")),
        "agent": _safe_str(erp.get("agent")),
        "naziv_agenta": _safe_str(erp.get("naziv_agenta")),
        "vrsta_isporuke_uid": _safe_str(erp.get("vrsta_isporuke_uid")),
        "vrsta_isporuke": _safe_str(erp.get("vrsta_isporuke")),
        "naziv_vrste_isporuke": _safe_str(erp.get("naziv_vrste_isporuke")),
        "grupa_mjesta_uid": _safe_str(erp.get("grupa_mjesta_uid")),
        "grupa_mjesta": _safe_str(erp.get("grupa_mjesta")),
        "naziv_grupe_mjesta": _safe_str(erp.get("naziv_grupe_mjesta")),
        "nivo_partnera_uid": _safe_str(erp.get("nivo_partnera_uid")),
        "nivo_partnera": _safe_str(erp.get("nivo_partnera")),
        "naziv_nivoa_partnera": _safe_str(erp.get("naziv_nivoa_partnera")),
        "suradnik_uid": _safe_str(erp.get("suradnik_uid")),
        "suradnik": _safe_str(erp.get("suradnik")),
        "naziv_suradnika": _safe_str(erp.get("naziv_suradnika")),
        "odakle_uid": _safe_str(erp.get("odakle_uid")),
        "odakle": _safe_str(erp.get("odakle")),
        "odakle_naziv": _safe_str(erp.get("odakle_naziv")),
        "synced_at": datetime.utcnow(),
    }


def map_artikl(erp: dict[str, Any]) -> dict[str, Any]:
    """Mapira ERP artikl JSON na dict za Artikl model."""
    glavni_dobavljac_artikl = _safe_str(erp.get("glavni_dobavljac_artikl"))
    if glavni_dobavljac_artikl and len(glavni_dobavljac_artikl) > 255:
        glavni_dobavljac_artikl = glavni_dobavljac_artikl[:255]

    return {
        "artikl_uid": str(erp.get("artikl_uid", "")),
        "artikl_b2b": _safe_str(erp.get("artikl_b2b")),
        "artikl": _safe_str(erp.get("artikl")),
        "naziv": _safe_str(erp.get("naziv")),
        "barcode": _safe_str(erp.get("barcode")),
        "jm": _safe_str(erp.get("jm")),
        "vpc": _safe_decimal(erp.get("vpc")),
        "mpc": _safe_decimal(erp.get("mpc")),
        "duzina": _safe_decimal(erp.get("duzina")),
        "sirina": _safe_decimal(erp.get("sirina")),
        "visina": _safe_decimal(erp.get("visina")),
        "masa": _safe_decimal(erp.get("masa")),
        "volumen": _safe_decimal(erp.get("volumen")),
        "pakiranje": _safe_str(erp.get("pakiranje")),
        "pakiranje_jm": _safe_str(erp.get("pakiranje_jm")),
        "pakiranje_masa": _safe_decimal(erp.get("pakiranje_masa")),
        "pakiranje_barcode": _safe_str(erp.get("pakiranje_barcode")),
        "pakiranje_trans": _safe_str(erp.get("pakiranje_trans")),
        "pakiranje_trans_jm": _safe_str(erp.get("pakiranje_trans_jm")),
        "pakiranje_trans_masa": _safe_decimal(erp.get("pakiranje_trans_masa")),
        "pakiranje_trans_barcode": _safe_str(erp.get("pakiranje_trans_barcode")),
        "pakiranje_trans_duzina": _safe_decimal(erp.get("pakiranje_trans_duzina")),
        "pakiranje_trans_sirina": _safe_decimal(erp.get("pakiranje_trans_sirina")),
        "pakiranje_trans_visina": _safe_decimal(erp.get("pakiranje_trans_visina")),
        "naziv_kratki": _safe_str(erp.get("naziv_kratki")),
        "supergrupa_artikla": _safe_str(erp.get("supergrupa_artikla")),
        "supergrupa_artikla_naziv": _safe_str(erp.get("supergrupa_artikla_naziv")),
        "nadgrupa_artikla": _safe_str(erp.get("nadgrupa_artikla")),
        "nadgrupa_artikla_naziv": _safe_str(erp.get("nadgrupa_artikla_naziv")),
        "grupa_artikla_uid": _safe_str(erp.get("grupa_artikla_uid")),
        "grupa_artikla": _safe_str(erp.get("grupa_artikla")),
        "grupa_artikla_naziv": _safe_str(erp.get("grupa_artikla_naziv")),
        "masa_netto": _safe_decimal(erp.get("masa_netto")),
        "pakiranje_duzina": _safe_decimal(erp.get("pakiranje_duzina")),
        "pakiranje_visina": _safe_decimal(erp.get("pakiranje_visina")),
        "pakiranje_sirina": _safe_decimal(erp.get("pakiranje_sirina")),
        "paleta_kolicina": _safe_int(erp.get("paleta_kolicina")),
        "proizvodac_uid": _safe_str(erp.get("proizvodac_uid")),
        "proizvodac": _safe_str(erp.get("proizvodac")),
        "proizvodac_naziv": _safe_str(erp.get("proizvodac_naziv")),
        "glavni_dobavljac": _safe_str(erp.get("glavni_dobavljac")),
        "glavni_dobavljac_artikl": glavni_dobavljac_artikl,
        "synced_at": datetime.utcnow(),
    }


def map_nalog_header(erp: dict[str, Any]) -> dict[str, Any]:
    """
    Mapira ERP nalog header JSON na dict za NalogHeader model.
    
    Očekuje podatke iz: /datasnap/rest/NaloziProdaje/uid/{uid}
    ili /datasnap/rest/NaloziProdaje/statusi/...
    """
    return {
        "nalog_prodaje_uid": _safe_str(erp.get("nalog_prodaje_uid")),
        "nalog_prodaje_b2b": _safe_str(erp.get("nalog_prodaje_b2b")),
        "broj": _safe_int(erp.get("broj")),
        "datum": _safe_date(erp.get("datum")),
        "rezervacija_od_datuma": _safe_datetime(erp.get("rezervacija_od_datuma")),
        "rezervacija_do_datuma": _safe_date(erp.get("rezervacija_do_datuma")),
        "raspored": _safe_date(erp.get("raspored")),  # datum isporuke
        "skladiste": _safe_str(erp.get("skladiste")),
        "skladiste_b2b": _safe_str(erp.get("skladiste_b2b")),
        "na__skladiste": _safe_str(erp.get("na__skladiste")),
        "na__skladiste_b2b": _safe_str(erp.get("na__skladiste_b2b")),
        "partner_uid": _safe_str(erp.get("partner_uid")),
        "partner": _safe_str(erp.get("partner")),
        "partner_b2b": _safe_str(erp.get("partner_b2b")),
        "korisnik__partner_uid": _safe_str(erp.get("korisnik__partner_uid")),
        "korisnik__partner": _safe_str(erp.get("korisnik__partner")),
        "korisnik__partner_b2b": _safe_str(erp.get("korisnik__partner_b2b")),
        "agent__partner_uid": _safe_str(erp.get("agent__partner_uid")),
        "agent__partner": _safe_str(erp.get("agent__partner")),
        "agent__partner_b2b": _safe_str(erp.get("agent__partner_b2b")),
        "narudzba": _safe_str(erp.get("narudzba")),
        "kupac_placa_isporuku": _safe_str(erp.get("kupac_placa_isporuku")),
        "valuta": _safe_str(erp.get("valuta")),
        "valuta_b2b": _safe_str(erp.get("valuta_b2b")),
        "tecaj": _safe_decimal(erp.get("tecaj")),
        "generalni_rabat": _safe_str(erp.get("generalni_rabat")),
        "placa_porez": _safe_str(erp.get("placa_porez")),
        "cassa_sconto": _safe_str(erp.get("cassa_sconto")),
        "poruka_gore": _safe_str(erp.get("poruka_gore")),
        "poruka_dolje": _safe_str(erp.get("poruka_dolje")),
        "napomena": _safe_str(erp.get("napomena")),
        "na_uvid": _safe_str(erp.get("na_uvid")),
        "referenca_isporuke": _safe_str(erp.get("referenca_isporuke")),
        "sa__skladiste": _safe_str(erp.get("sa__skladiste")),
        "sa__skladiste_b2b": _safe_str(erp.get("sa__skladiste_b2b")),
        "skl_dokument": _safe_str(erp.get("skl_dokument")),
        "skl_dokument_b2b": _safe_str(erp.get("skl_dokument_b2b")),
        "status": _safe_str(erp.get("status")),
        "status_b2b": _safe_str(erp.get("status_b2b")),
        "komercijalist__radnik": _safe_str(erp.get("komercijalist__radnik")),
        "komercijalist__radnik_b2b": _safe_str(erp.get("komercijalist__radnik_b2b")),
        "dostavljac_uid": _safe_str(erp.get("dostavljac_uid")),
        "dostavljac__radnik": _safe_str(erp.get("dostavljac__radnik")),
        "dostavljac__radnik_b2b": _safe_str(erp.get("dostavljac__radnik_b2b")),
        "kreirao__radnik_uid": _safe_str(erp.get("kreirao__radnik_uid")),
        "kreirao__radnik": _safe_str(erp.get("kreirao__radnik")),
        "kreirao__radnik_ime": _safe_str(erp.get("kreirao__radnik_ime")),
        "vrsta_isporuke": _safe_str(erp.get("vrsta_isporuke")),
        "vrsta_isporuke_b2b": _safe_str(erp.get("vrsta_isporuke_b2b")),
        "izravna_dostava": _safe_str(erp.get("izravna_dostava")),
        "dropoff_sifra": _safe_str(erp.get("dropoff_sifra")),
        "dropoff_naziv": _safe_str(erp.get("dropoff_naziv")),
        "user_uid": _safe_str(erp.get("user_uid")),
        "username": _safe_str(erp.get("username")),
        "user_b2b": _safe_str(erp.get("user_b2b")),
        "tip_racuna_uid": _safe_str(erp.get("tip_racuna_uid")),
        "tip_racuna": _safe_str(erp.get("tip_racuna")),
        "tip_racuna_b2b": _safe_str(erp.get("tip_racuna_b2b")),
        "predmet_uid": _safe_str(erp.get("predmet_uid")),
        "predmet": _safe_str(erp.get("predmet")),
        "predmet_b2b": _safe_str(erp.get("predmet_b2b")),
        "za_naplatu": _safe_decimal(erp.get("za_naplatu")),
        "zki": _safe_str(erp.get("zki")),
        "jir": _safe_str(erp.get("jir")),
        "synced_at": datetime.utcnow(),
    }


def map_nalog_detail(erp: dict[str, Any], nalog_prodaje_uid: str) -> dict[str, Any]:
    """
    Mapira ERP stavka JSON na dict za NalogDetail model.
    
    Očekuje stavku iz "stavke" array unutar naloga.
    """
    return {
        "stavka_uid": _safe_str(erp.get("stavka_uid")),
        "nalog_prodaje_uid": nalog_prodaje_uid,
        "artikl": _safe_str(erp.get("artikl")),
        "artikl_uid": _safe_str(erp.get("artikl_uid")),
        "artikl_b2b": _safe_str(erp.get("artikl_b2b")),
        "mjesto_troska": _safe_str(erp.get("mjesto_troska")),
        "mjesto_troska_uid": _safe_str(erp.get("mjesto_troska_uid")),
        "mjesto_troska_b2b": _safe_str(erp.get("mjesto_troska_b2b")),
        "predmet": _safe_str(erp.get("predmet")),
        "predmet_uid": _safe_str(erp.get("predmet_uid")),
        "predmet_b2b": _safe_str(erp.get("predmet_b2b")),
        "opis": _safe_str(erp.get("opis")),
        "kolicina": _safe_decimal(erp.get("kolicina")),
        "pakiranja": _safe_decimal(erp.get("pakiranja")),
        "cijena": _safe_decimal(erp.get("cijena")),
        "detaljni_opis": _safe_str(erp.get("detaljni_opis")),
        "specifikacija": _safe_str(erp.get("specifikacija")),
        "rabat": _safe_decimal(erp.get("rabat")),
        "dodatni_rabat": _safe_str(erp.get("dodatni_rabat")),
        "redoslijed": _safe_int(erp.get("redoslijed")),
        "synced_at": datetime.utcnow(),
    }


# ==============================================================================
# Sync funkcije
# ==============================================================================

def _get_allowed_vrste_isporuke(db: Session) -> set[str]:
    """Dohvati sve aktivne vrste isporuke iz baze."""
    result = db.execute(
        select(VrstaIsporuke.vrsta_isporuke).where(VrstaIsporuke.aktivan == True)
    ).scalars().all()
    return set(result)


def _assign_regija(db: Session, postanski_broj: str | None) -> int | None:
    """Pronađi regiju na temelju poštanskog broja (uzima prvi pronađeni red)."""
    if not postanski_broj:
        return None
    row = db.execute(
        select(PostanskiBroj).where(PostanskiBroj.postanski_broj == postanski_broj).limit(1)
    ).scalars().first()
    return row.regija_id if row else None


def _recalculate_totals_for_nalog(db: Session, nalog_uid: str) -> None:
    """
    Izračunaj total_weight i total_volume za nalog na temelju stavki i artikala.

    total_weight = SUM(stavka.kolicina * artikl.masa)
    total_volume = SUM(stavka.kolicina * artikl.volumen)

    Napomena: artikl.volumen je u cm3 – u bazi držimo cm3, a prikaz u m3 radi frontend
    dijeljenjem s 1_000_000.
    """
    header = db.get(NalogHeader, nalog_uid)
    if not header:
        return

    result = db.execute(
        select(
            func.sum(NalogDetail.kolicina * Artikl.masa),
            func.sum(NalogDetail.kolicina * Artikl.volumen),
        )
        .outerjoin(Artikl, NalogDetail.artikl_uid == Artikl.artikl_uid)
        .where(NalogDetail.nalog_prodaje_uid == nalog_uid)
    ).first()

    if result is None:
        return

    total_weight, total_volume = result
    header.total_weight = total_weight or 0
    header.total_volume = total_volume or 0


async def sync_orders(
    db: Session,
    sync_log: SyncLog,
    statusi: list[str],
    datum_od: date,
    datum_do: date,
    require_raspored: bool = False,
) -> None:
    """
    Sinkronizira naloge iz ERP-a (Luceed).

    1. Dohvati headere naloga po statusima i datumu.
    2. Filtriraj naloge po vrsti_isporuke (samo oni koji postoje u tablici vrste_isporuke).
    3. Ako je require_raspored=True, preskoči naloge bez rasporeda.
    4. Za svaki nalog dohvati detalje (stavke) i partnera.
    5. Upsert Partner, NalogHeader, NalogDetail.
    6. Dodijeli regiju na temelju poštanskog broja partnera.
    """
    sync_log.status = "RUNNING"
    db.commit()

    try:
        allowed_vrste = _get_allowed_vrste_isporuke(db)
        logger.info("Dozvoljene vrste isporuke: %s", allowed_vrste)
        _log(f"[SYNC] Dozvoljene vrste isporuke: {allowed_vrste}")
        if require_raspored:
            logger.info("Filter rasporeda UKLJUČEN - preskaču se nalozi bez rasporeda")
            _log("[SYNC] Filter rasporeda UKLJUČEN")

        headers = await erp_client.get_nalozi_headers(statusi, datum_od, datum_do)
        logger.info("ERP vratio %d headera naloga", len(headers))
        _log(f"[SYNC] ERP vratio {len(headers)} headera naloga")

        created = 0
        updated = 0
        skipped = 0
        skipped_no_raspored = 0
        skipped_vrsta = 0
        skipped_blacklist = 0
        skipped_rutiranje = 0
        skipped_arhiva = 0
        skipped_existing = 0
        errors = 0
        total_headers = len(headers)

        for idx, header_data in enumerate(headers, 1):
            nalog_prodaje_uid = _safe_str(header_data.get("nalog_prodaje_uid"))
            if not nalog_prodaje_uid:
                errors += 1
                continue

            # Filtriraj po vrsti isporuke
            vrsta_isporuke = _safe_str(header_data.get("vrsta_isporuke"))
            if not vrsta_isporuke or vrsta_isporuke not in allowed_vrste:
                skipped_vrsta += 1
                skipped += 1
                if skipped_vrsta <= 5:
                    _log(f"[SYNC] SKIP {nalog_prodaje_uid} — vrsta_isporuke '{vrsta_isporuke}' nije u {allowed_vrste}")
                elif skipped_vrsta == 6:
                    _log(f"[SYNC] ... i još naloga s nedozvoljenom vrstom isporuke (neće se više ispisivati)")
                continue

            # Filtriraj po rasporedu (datum isporuke)
            if require_raspored:
                raspored = header_data.get("raspored")
                if not raspored:
                    skipped_no_raspored += 1
                    skipped += 1
                    if skipped_no_raspored <= 5:
                        _log(f"[SYNC] SKIP {nalog_prodaje_uid} — nema rasporeda")
                    continue

            try:
                # ------------------------------------------------------------------
                # 1) Dohvati detalje naloga (header + stavke) iz ERP-a
                # ------------------------------------------------------------------
                detail_resp = await erp_client.get_nalog_details(nalog_prodaje_uid)
                await asyncio.sleep(0.05)  # throttle

                # ------------------------------------------------------------------
                # 2) Upsert partner + header, zaseban commit (da uvijek postoji parent)
                # ------------------------------------------------------------------
                # Upsert partner - koristimo korisnik__partner / partner polja za dohvat
                partner_sifra = _safe_str(
                    header_data.get("korisnik__partner") or header_data.get("partner")
                )
                # UID iz headera, čak i ako ERP /partneri API ne vrati podatke
                partner_uid = _safe_str(
                    header_data.get("korisnik__partner_uid") or header_data.get("partner_uid")
                )
                partner_postanski_broj = None

                # 2a) Pokušaj dohvatiti punog partnera iz ERP-a
                partner_found_in_erp = False
                if partner_sifra:
                    try:
                        partner_erp = await erp_client.get_partner(partner_sifra)
                        await asyncio.sleep(0.05)
                    except Exception:
                        partner_erp = None

                    if partner_erp:
                        partner_found_in_erp = True
                        partner_dict = map_partner(partner_erp)
                        # Ako ERP vrati UID, koristimo njega kao izvor istine
                        if partner_dict.get("partner_uid"):
                            partner_uid = partner_dict["partner_uid"]
                        partner_postanski_broj = partner_dict.get("postanski_broj")

                        if partner_uid:
                            existing_partner = db.get(Partner, partner_uid)
                            if existing_partner:
                                for k, v in partner_dict.items():
                                    if v is not None:  # ne prepisuj None vrijednosti
                                        setattr(existing_partner, k, v)
                            else:
                                db.add(Partner(**partner_dict))

                # 2b) Ako ERP nije vratio partnera, ali imamo UID iz headera,
                #     kreiramo "stub" partner zapis da zadovoljimo FK constraint.
                if not partner_found_in_erp and partner_uid:
                    existing_partner = db.get(Partner, partner_uid)
                    if not existing_partner:
                        stub = Partner(
                            partner_uid=partner_uid,
                            partner=partner_sifra,
                        )
                        db.add(stub)

                # Obavezno commit-aj partnera prije inserta naloga
                # kako bi FK nalozi_header.partner_uid sigurno imao parent zapis.
                db.commit()

                # Pripremi header dict
                header_dict = map_nalog_header(header_data)

                # SIGURNOSNO: uvijek forsiraj nalog_prodaje_uid iz varijable petlje
                header_dict["nalog_prodaje_uid"] = nalog_prodaje_uid

                # Koristi podatke iz detail_resp ako postoje (potpuniji podaci),
                # ali NIKAD ne mijenjaj nalog_prodaje_uid koji smo gore postavili.
                if detail_resp:
                    detail_header = map_nalog_header(detail_resp)
                    for k, v in detail_header.items():
                        if k == "nalog_prodaje_uid":
                            continue
                        if v is not None:
                            header_dict[k] = v

                # Postavi partner_uid ispravno (može doći iz partner API-ja)
                if partner_uid:
                    header_dict["partner_uid"] = partner_uid

                # Dodijeli regiju na temelju poštanskog broja partnera
                if partner_postanski_broj:
                    header_dict["regija_id"] = _assign_regija(db, partner_postanski_broj)

                # Preskoči ako je nalog na blacklistu, u rutiranju ili arhiviran
                if db.get(NaloziBlacklist, nalog_prodaje_uid):
                    logger.info("SKIP %s — na blacklistu", nalog_prodaje_uid)
                    _log(f"[SYNC] SKIP {nalog_prodaje_uid} — blacklist")
                    skipped_blacklist += 1
                    skipped += 1
                    continue
                if db.get(NalogHeaderRutiranje, nalog_prodaje_uid):
                    logger.info("SKIP %s — već u rutiranju", nalog_prodaje_uid)
                    _log(f"[SYNC] SKIP {nalog_prodaje_uid} — u rutiranju")
                    skipped_rutiranje += 1
                    skipped += 1
                    continue
                if db.execute(
                    select(NalogHeaderArhiva.nalog_prodaje_uid).where(
                        NalogHeaderArhiva.nalog_prodaje_uid == nalog_prodaje_uid
                    )
                ).first():
                    logger.info("SKIP %s — arhiviran", nalog_prodaje_uid)
                    _log(f"[SYNC] SKIP {nalog_prodaje_uid} — arhiviran")
                    skipped_arhiva += 1
                    skipped += 1
                    continue

                # Upsert nalog header
                existing_header = db.get(NalogHeader, nalog_prodaje_uid)
                if existing_header:
                    for k, v in header_dict.items():
                        if v is not None:
                            setattr(existing_header, k, v)
                    updated += 1
                    logger.info("UPDATE %s — ažuriran u bazi", nalog_prodaje_uid)
                    _log(f"[SYNC] UPDATE {nalog_prodaje_uid}")
                else:
                    db.add(NalogHeader(**header_dict))
                    created += 1
                    logger.info("CREATE %s — novi nalog kreiran (vrsta: %s, raspored: %s)",
                                nalog_prodaje_uid, vrsta_isporuke, header_dict.get("raspored"))
                    _log(f"[SYNC] CREATE {nalog_prodaje_uid} (vrsta: {vrsta_isporuke})")

                # Najprije commit da budemo sigurni da parent red postoji
                db.commit()

                # ------------------------------------------------------------------
                # 3) Upsert stavke (u zasebnoj transakciji)
                # ------------------------------------------------------------------
                if detail_resp:
                    stavke = detail_resp.get("stavke", [])
                    if not isinstance(stavke, list):
                        stavke = []
                    for stavka_erp in stavke:
                        detail_dict = map_nalog_detail(stavka_erp, nalog_prodaje_uid)
                        stavka_uid = detail_dict.get("stavka_uid")
                        if not stavka_uid:
                            continue

                        # Ako artikl ne postoji u tablici artikli, ne postavljamo artikl_uid
                        artikl_uid = detail_dict.get("artikl_uid")
                        if artikl_uid:
                            artikl_exists = db.get(Artikl, artikl_uid)
                            if not artikl_exists:
                                logger.warning(
                                    "Artikl %s ne postoji u tablici artikli, postavljam artikl_uid = NULL za stavku %s",
                                    artikl_uid,
                                    stavka_uid,
                                )
                                detail_dict["artikl_uid"] = None

                        existing_detail = db.get(NalogDetail, stavka_uid)
                        if existing_detail:
                            for k, v in detail_dict.items():
                                if v is not None:
                                    setattr(existing_detail, k, v)
                        else:
                            db.add(NalogDetail(**detail_dict))

                    db.commit()

                    # Nakon što su sve stavke za ovaj nalog upisane/ažurirane,
                    # izračunaj total_weight i total_volume.
                    _recalculate_totals_for_nalog(db, nalog_prodaje_uid)
                    db.commit()

            except Exception as e:
                logger.exception("Greška pri sync naloga %s: %s", nalog_prodaje_uid, e)
                _log(f"[SYNC] ERROR {nalog_prodaje_uid} — {e}")
                errors += 1
                db.rollback()

            # Progress print svake 50. iteracije
            if idx % 50 == 0:
                _log(f"[SYNC] Progress: {idx}/{total_headers} ({int(idx/total_headers*100)}%) — novo:{created} ažur:{updated} skip:{skipped} err:{errors}")

            # Progress DB update svake 10. iteracije ili na zadnjoj
            if idx % 10 == 0 or idx == total_headers:
                pct = int(idx / total_headers * 100)
                sync_log.status = "IN_PROGRESS"
                sync_log.message = (
                    f"Obrađeno {idx}/{total_headers} ({pct}%) — "
                    f"Novo: {created}, Ažurirano: {updated}, Preskočeno: {skipped}, Greške: {errors}"
                )
                try:
                    db.commit()
                except Exception:
                    db.rollback()

        sync_log.status = "COMPLETED"
        msg = (
            f"Kreirano: {created}, Ažurirano: {updated}, "
            f"Preskočeno: {skipped}, Greške: {errors}"
        )
        skip_details = []
        if skipped_vrsta:
            skip_details.append(f"vrsta isporuke: {skipped_vrsta}")
        if skipped_no_raspored:
            skip_details.append(f"bez rasporeda: {skipped_no_raspored}")
        if skipped_blacklist:
            skip_details.append(f"blacklist: {skipped_blacklist}")
        if skipped_rutiranje:
            skip_details.append(f"u rutiranju: {skipped_rutiranje}")
        if skipped_arhiva:
            skip_details.append(f"arhivirano: {skipped_arhiva}")
        if skip_details:
            msg += f" ({', '.join(skip_details)})"
        sync_log.message = msg
        sync_log.finished_at = datetime.utcnow()
        db.commit()

        summary = (
            f"SYNC ZAVRŠEN — ERP headera: {total_headers} | Kreirano: {created} | Ažurirano: {updated} | "
            f"Preskočeno: {skipped} (vrsta: {skipped_vrsta}, raspored: {skipped_no_raspored}, "
            f"blacklist: {skipped_blacklist}, rutiranje: {skipped_rutiranje}, arhiva: {skipped_arhiva}) | "
            f"Greške: {errors}"
        )
        logger.info(summary)
        _log(f"[SYNC] {summary}")

    except Exception as e:
        logger.exception("Sync orders failed: %s", e)
        _log(f"[SYNC] FATALNA GREŠKA: {e}")
        sync_log.status = "FAILED"
        sync_log.message = str(e)[:500]
        sync_log.finished_at = datetime.utcnow()
        db.commit()


async def refresh_orders(db: Session, sync_log: SyncLog, datum_od: date) -> None:
    """
    Osvježava naloge koji su u statusu '08' u našoj bazi.

    1. Pozove ERP endpoint IzmjenaStatus/{datum} da dohvati promjene.
    2. Za svaki nalog koji postoji u našoj bazi i ima status '08':
       - Ažurira header podatke (status, raspored, itd.)
       - Dohvati i ažurira partnera ako se promijenio
       - Bilježi sve promjene u tablicu refresh_log
    3. Za naloge koji nisu u našoj bazi – preskače ih (nisu importirani).
    """
    import json

    sync_log.status = "RUNNING"
    sync_log.message = "Dohvaćam promjene iz ERP-a..."
    db.commit()

    try:
        # 1. Dohvati promjene iz ERP-a
        erp_changes = await erp_client.get_nalozi_izmjena_status(datum_od)
        logger.info("ERP IzmjenaStatus vratio %d naloga s promjenama", len(erp_changes))

        updated_headers = 0
        updated_partners = 0
        skipped = 0
        errors = 0

        for erp_nalog in erp_changes:
            nalog_uid = _safe_str(erp_nalog.get("nalog_prodaje_uid"))
            if not nalog_uid:
                errors += 1
                continue

            try:
                # 2. Provjeri postoji li nalog u našoj bazi i ima li status '08'
                existing = db.get(NalogHeader, nalog_uid)
                if not existing or existing.status != "08":
                    skipped += 1
                    continue

                # 3. Ažuriraj header podatke i bilježi promjene
                header_dict = map_nalog_header(erp_nalog)
                changed_fields: list[str] = []
                old_values: dict[str, str] = {}
                new_values: dict[str, str] = {}

                for k, v in header_dict.items():
                    if k == "nalog_prodaje_uid":
                        continue
                    if v is not None:
                        old_val = getattr(existing, k, None)
                        if old_val != v:
                            changed_fields.append(k)
                            old_values[k] = str(old_val) if old_val is not None else None
                            new_values[k] = str(v)
                            setattr(existing, k, v)

                if changed_fields:
                    existing.synced_at = datetime.utcnow()
                    updated_headers += 1
                    # Zapiši u refresh_log
                    db.add(RefreshLog(
                        sync_log_id=sync_log.id,
                        nalog_prodaje_uid=nalog_uid,
                        tip="HEADER",
                        polja_promijenjena=json.dumps(changed_fields, ensure_ascii=False),
                        stare_vrijednosti=json.dumps(old_values, ensure_ascii=False),
                        nove_vrijednosti=json.dumps(new_values, ensure_ascii=False),
                    ))

                # 4. Ažuriraj partnera ako postoji partner_uid
                partner_uid = _safe_str(
                    erp_nalog.get("korisnik__partner_uid") or erp_nalog.get("partner_uid")
                )
                if partner_uid:
                    try:
                        partner_erp = await erp_client.get_partner_by_uid(partner_uid)
                        await asyncio.sleep(0.05)
                        if partner_erp:
                            partner_dict = map_partner(partner_erp)
                            existing_partner = db.get(Partner, partner_uid)
                            if existing_partner:
                                p_changed_fields: list[str] = []
                                p_old_values: dict[str, str] = {}
                                p_new_values: dict[str, str] = {}
                                for k, v in partner_dict.items():
                                    if v is not None:
                                        old_val = getattr(existing_partner, k, None)
                                        if old_val != v:
                                            p_changed_fields.append(k)
                                            p_old_values[k] = str(old_val) if old_val is not None else None
                                            p_new_values[k] = str(v)
                                            setattr(existing_partner, k, v)
                                if p_changed_fields:
                                    updated_partners += 1
                                    db.add(RefreshLog(
                                        sync_log_id=sync_log.id,
                                        nalog_prodaje_uid=nalog_uid,
                                        partner_uid=partner_uid,
                                        tip="PARTNER",
                                        polja_promijenjena=json.dumps(p_changed_fields, ensure_ascii=False),
                                        stare_vrijednosti=json.dumps(p_old_values, ensure_ascii=False),
                                        nove_vrijednosti=json.dumps(p_new_values, ensure_ascii=False),
                                    ))

                            # Ažuriraj regiju na temelju novog poštanskog broja
                            postanski_broj = partner_dict.get("postanski_broj")
                            if postanski_broj:
                                regija_id = _assign_regija(db, postanski_broj)
                                if existing.regija_id != regija_id:
                                    existing.regija_id = regija_id
                    except Exception as e:
                        logger.warning("Greška pri dohvatu partnera %s: %s", partner_uid, e)

                db.commit()

            except Exception as e:
                logger.exception("Greška pri osvježavanju naloga %s: %s", nalog_uid, e)
                errors += 1
                db.rollback()

        sync_log.status = "COMPLETED"
        sync_log.message = (
            f"Ažurirano headera: {updated_headers}, Ažurirano partnera: {updated_partners}, "
            f"Preskočeno: {skipped}, Greške: {errors}"
        )
        sync_log.finished_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        logger.exception("Refresh orders failed: %s", e)
        sync_log.status = "FAILED"
        sync_log.message = str(e)[:500]
        sync_log.finished_at = datetime.utcnow()
        db.commit()


async def sync_partners(db: Session, sync_log: SyncLog) -> None:
    """
    Sinkronizira partnere - bulk import nije dostupan preko ERP-a,
    pa se partneri importiraju kroz sync_orders.
    Ovdje možemo samo ažurirati sync_log.
    """
    sync_log.status = "COMPLETED"
    sync_log.message = "Partneri se sinkroniziraju zajedno s nalozima."
    sync_log.finished_at = datetime.utcnow()
    db.commit()


async def sync_artikli(db: Session, sync_log: SyncLog) -> None:
    """
    Sinkronizira sve artikle iz ERP-a u batch-ovima po 1000.
    Istovremeno puni i tablicu grupe_artikala.
    """
    sync_log.status = "RUNNING"
    sync_log.message = "Inicijalizacija sync_a artikala..."
    db.commit()

    try:
        limit = 1000
        # Ako već imamo dio artikala u bazi, nastavljamo od tog offseta (kao resume)
        existing_count = db.query(Artikl).count()
        offset = existing_count
        created = 0
        updated = 0
        grupe_created = 0
        grupe_updated = 0

        batch = 0
        _log(f"[Sync artikli] Startam sync od offset={offset} (postojeci artikli u bazi={existing_count})")
        while True:
            batch += 1
            # U jednom batchu ista grupa može biti kod više artikala – dodajemo je samo jednom
            grupe_dodane_u_ovom_batchu: set[str] = set()
            _log(f"[Sync artikli] Batch {batch}: trazim offset={offset}, limit={limit} ...")
            logger.info("Sync artikli: trazim batch %d (offset=%d, limit=%d)", batch, offset, limit)
            page = await erp_client.get_artikli_page(offset=offset, limit=limit)
            if not page:
                _log(f"[Sync artikli] Batch {batch}: prazan rezultat – kraj.")
                logger.info("Sync artikli: prazan rezultat za batch %d (offset=%d) – prekidam petlju", batch, offset)
                break

            _log(f"[Sync artikli] Batch {batch}: ERP vratio {len(page)} artikala (offset={offset})")
            logger.info("Sync artikli: batch %d, ERP vratio %d artikala (offset=%d)", batch, len(page), offset)

            for idx, erp_art in enumerate(page, start=1):
                # Upsert grupa artikla (samo jednom po grupa_uid u batchu – inače duplicate key)
                grupa_uid = _safe_str(erp_art.get("grupa_artikla_uid"))
                if grupa_uid:
                    grupa = db.get(GrupaArtikla, grupa_uid)
                    grupa_data = {
                        "grupa_artikla_uid": grupa_uid,
                        "grupa_artikla": _safe_str(erp_art.get("grupa_artikla")),
                        "grupa_artikla_naziv": _safe_str(erp_art.get("grupa_artikla_naziv")),
                        "nadgrupa_artikla": _safe_str(erp_art.get("nadgrupa_artikla")),
                        "nadgrupa_artikla_naziv": _safe_str(erp_art.get("nadgrupa_artikla_naziv")),
                        "supergrupa_artikla": _safe_str(erp_art.get("supergrupa_artikla")),
                        "supergrupa_artikla_naziv": _safe_str(erp_art.get("supergrupa_artikla_naziv")),
                    }
                    if grupa:
                        for k, v in grupa_data.items():
                            if v is not None:
                                setattr(grupa, k, v)
                        grupe_updated += 1
                    elif grupa_uid not in grupe_dodane_u_ovom_batchu:
                        db.add(GrupaArtikla(**grupa_data))
                        grupe_dodane_u_ovom_batchu.add(grupa_uid)
                        grupe_created += 1

                # Upsert artikl
                art_dict = map_artikl(erp_art)
                artikl_uid = art_dict["artikl_uid"]
                if not artikl_uid:
                    continue

                existing = db.get(Artikl, artikl_uid)
                if existing:
                    for k, v in art_dict.items():
                        if v is not None:
                            setattr(existing, k, v)
                    updated += 1
                else:
                    db.add(Artikl(**art_dict))
                    created += 1

                if (created + updated) % 1000 == 0:
                    logger.info(
                        "Sync artikli: dosad obrađeno %d artikala (kreirano=%d, azurirano=%d) u batchu %d (lokalni index=%d)",
                        created + updated,
                        created,
                        updated,
                        batch,
                        idx,
                    )

            _log(
                f"[Sync artikli] Batch {batch} zavrsen (offset={offset}) | "
                f"artikli: kreirano={created}, azurirano={updated} | grupe: kreirano={grupe_created}, azurirano={grupe_updated}"
            )
            logger.info(
                "Sync artikli: batch %d zavrsen (offset=%d); total artikli: kreirano=%d, azurirano=%d; grupe: kreirano=%d, azurirano=%d",
                batch,
                offset,
                created,
                updated,
                grupe_created,
                grupe_updated,
            )

            sync_log.message = (
                f"Batch {batch} zavrsen (offset={offset}) – "
                f"artikli kreirano={created}, azurirano={updated}; "
                f"grupe kreirano={grupe_created}, azurirano={grupe_updated}"
            )
            db.commit()
            if len(page) < limit:
                _log(f"[Sync artikli] Zadnji batch ({batch}), {len(page)} zapisa – kraj.")
                logger.info(
                    "Sync artikli: zadnji batch (%d) ima %d zapisa (< limit=%d) – kraj",
                    batch,
                    len(page),
                    limit,
                )
                break
            offset += limit

        _log(f"[Sync artikli] GOTOVO. Artikli: kreirano={created}, azurirano={updated}; Grupe: kreirano={grupe_created}, azurirano={grupe_updated}")
        sync_log.status = "COMPLETED"
        sync_log.message = (
            f"Artikli - kreirano: {created}, ažurirano: {updated}; "
            f"Grupe - kreirano: {grupe_created}, ažurirano: {grupe_updated}"
        )
        sync_log.finished_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        logger.exception("Sync artikli failed: %s", e)
        db.rollback()
        sync_log.status = "FAILED"
        sync_log.message = str(e)[:500]
        sync_log.finished_at = datetime.utcnow()
        db.commit()
