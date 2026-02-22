"""
Pydantic sheme za naloge i partnere (proširene prema Luceed API-ju).
"""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# VrstaIsporuke sheme
# =============================================================================

class VrstaIsporukeBase(BaseModel):
    vrsta_isporuke: str
    opis: str | None = None
    aktivan: bool = True


class VrstaIsporukeCreate(VrstaIsporukeBase):
    pass


class VrstaIsporukeUpdate(BaseModel):
    vrsta_isporuke: str | None = None
    opis: str | None = None
    aktivan: bool | None = None


class VrstaIsporukeOut(VrstaIsporukeBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# SyncStatus sheme
# =============================================================================

class SyncStatusBase(BaseModel):
    status_id: str
    naziv: str | None = None
    aktivan: bool = True


class SyncStatusCreate(SyncStatusBase):
    pass


class SyncStatusUpdate(BaseModel):
    naziv: str | None = None
    aktivan: bool | None = None


class SyncStatusOut(SyncStatusBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Partner sheme (proširene)
# =============================================================================

class PartnerOut(BaseModel):
    """Partner output shema sa svim poljima iz Luceed API-ja."""
    partner_uid: str
    partner: str | None = None  # šifra
    b2b_partner: str | None = None
    naziv: str | None = None
    ime: str | None = None
    prezime: str | None = None
    enabled: str | None = None
    tip_komitenta: str | None = None
    mobitel: str | None = None
    adresa: str | None = None
    maticni_broj: str | None = None
    oib: str | None = None
    pdv_broj: str | None = None
    ziro_racun: str | None = None
    telefon: str | None = None
    telefax: str | None = None
    mjesto_uid: str | None = None
    mjesto: str | None = None
    naziv_mjesta: str | None = None
    postanski_broj: str | None = None
    b2b_mjesto: str | None = None
    drzava_uid: str | None = None
    drzava: str | None = None
    naziv_drzave: str | None = None
    b2b_drzava: str | None = None
    valuta: str | None = None
    b2b_valuta: str | None = None
    rabat: float | None = None
    limit_iznos: float | None = None
    limit_dana: int | None = None
    odgoda_placanja: int | None = None
    iznos_zaduznice: float | None = None
    blokiran: str | None = None
    kontakt_osoba: str | None = None
    ugovor: str | None = None
    banka: str | None = None
    swift: str | None = None
    e_mail: str | None = None
    url: str | None = None
    napomena: str | None = None
    upozorenje: str | None = None
    gln: str | None = None
    placa_porez: str | None = None
    cassa_sconto: str | None = None
    tip_cijene: str | None = None
    tip_racuna: str | None = None
    datum_rodenja: date | None = None
    spol: str | None = None
    placa_isporuku: str | None = None
    broj_osigurane_osobe: str | None = None
    export_cjenika: str | None = None
    grupacija_uid: str | None = None
    grupacija: str | None = None
    naziv_grupacije: str | None = None
    parent__partner_uid: str | None = None
    parent__partner: str | None = None
    parent__partner_b2b: str | None = None
    komercijalista_uid: str | None = None
    komercijalista: str | None = None
    ime_komercijaliste: str | None = None
    kam_uid: str | None = None
    kam: str | None = None
    ime_kam: str | None = None
    grupa_partnera_uid: str | None = None
    grupa_partnera: str | None = None
    naziv_grupe_partnera: str | None = None
    agent_uid: str | None = None
    agent: str | None = None
    naziv_agenta: str | None = None
    vrsta_isporuke_uid: str | None = None
    vrsta_isporuke: str | None = None
    naziv_vrste_isporuke: str | None = None
    grupa_mjesta_uid: str | None = None
    grupa_mjesta: str | None = None
    naziv_grupe_mjesta: str | None = None
    nivo_partnera_uid: str | None = None
    nivo_partnera: str | None = None
    naziv_nivoa_partnera: str | None = None
    suradnik_uid: str | None = None
    suradnik: str | None = None
    naziv_suradnika: str | None = None
    odakle_uid: str | None = None
    odakle: str | None = None
    odakle_naziv: str | None = None
    synced_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PartnerUpdate(BaseModel):
    """Schema za ažuriranje podataka partnera."""
    adresa: str | None = None
    postanski_broj: str | None = None
    naziv_mjesta: str | None = None
    mobitel: str | None = None
    telefon: str | None = None
    drzava: str | None = None
    kontakt_osoba: str | None = None
    e_mail: str | None = None
    ime: str | None = None
    prezime: str | None = None
    naziv: str | None = None


class PartnerListOut(BaseModel):
    """Pojednostavljena verzija partnera za liste."""
    partner_uid: str
    partner: str | None = None
    naziv: str | None = None
    ime: str | None = None
    prezime: str | None = None
    adresa: str | None = None
    naziv_mjesta: str | None = None
    postanski_broj: str | None = None
    drzava: str | None = None
    mobitel: str | None = None
    telefon: str | None = None
    e_mail: str | None = None
    blokiran: str | None = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# NalogDetail sheme (proširene)
# =============================================================================

class NalogDetailOut(BaseModel):
    """Stavka naloga output shema."""
    stavka_uid: str
    nalog_prodaje_uid: str
    artikl: str | None = None
    artikl_uid: str | None = None
    artikl_b2b: str | None = None
    mjesto_troska: str | None = None
    mjesto_troska_uid: str | None = None
    mjesto_troska_b2b: str | None = None
    predmet: str | None = None
    predmet_uid: str | None = None
    predmet_b2b: str | None = None
    opis: str | None = None
    kolicina: float | None = None
    pakiranja: float | None = None
    cijena: float | None = None
    detaljni_opis: str | None = None
    specifikacija: str | None = None
    rabat: float | None = None
    dodatni_rabat: str | None = None
    redoslijed: int | None = None
    synced_at: datetime | None = None
    # Polja iz tablice artikli (popunjavaju se joinom)
    artikl_naziv_kratki: str | None = None
    artikl_jm: str | None = None
    artikl_masa: float | None = None
    artikl_volumen: float | None = None
    artikl_visina: float | None = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# NalogHeader sheme (proširene)
# =============================================================================

class NalogHeaderOut(BaseModel):
    """Nalog header output shema sa svim poljima iz Luceed API-ja."""
    nalog_prodaje_uid: str
    nalog_prodaje_b2b: str | None = None
    broj: int | None = None
    datum: date | None = None
    rezervacija_od_datuma: datetime | None = None
    rezervacija_do_datuma: date | None = None
    raspored: date | None = None  # datum isporuke
    skladiste: str | None = None
    skladiste_b2b: str | None = None
    na__skladiste: str | None = None
    na__skladiste_b2b: str | None = None
    partner_uid: str | None = None
    partner: str | None = None
    partner_b2b: str | None = None
    korisnik__partner_uid: str | None = None
    korisnik__partner: str | None = None
    korisnik__partner_b2b: str | None = None
    agent__partner_uid: str | None = None
    agent__partner: str | None = None
    agent__partner_b2b: str | None = None
    narudzba: str | None = None
    kupac_placa_isporuku: str | None = None
    valuta: str | None = None
    valuta_b2b: str | None = None
    tecaj: float | None = None
    generalni_rabat: str | None = None
    placa_porez: str | None = None
    cassa_sconto: str | None = None
    poruka_gore: str | None = None
    poruka_dolje: str | None = None
    napomena: str | None = None
    na_uvid: str | None = None
    referenca_isporuke: str | None = None
    sa__skladiste: str | None = None
    sa__skladiste_b2b: str | None = None
    skl_dokument: str | None = None
    skl_dokument_b2b: str | None = None
    status: str | None = None
    status_b2b: str | None = None
    komercijalist__radnik: str | None = None
    komercijalist__radnik_b2b: str | None = None
    dostavljac_uid: str | None = None
    dostavljac__radnik: str | None = None
    dostavljac__radnik_b2b: str | None = None
    kreirao__radnik_uid: str | None = None
    kreirao__radnik: str | None = None
    kreirao__radnik_ime: str | None = None
    vrsta_isporuke: str | None = None
    vrsta_isporuke_b2b: str | None = None
    izravna_dostava: str | None = None
    dropoff_sifra: str | None = None
    dropoff_naziv: str | None = None
    user_uid: str | None = None
    username: str | None = None
    user_b2b: str | None = None
    tip_racuna_uid: str | None = None
    tip_racuna: str | None = None
    tip_racuna_b2b: str | None = None
    predmet_uid: str | None = None
    predmet: str | None = None
    predmet_b2b: str | None = None
    za_naplatu: float | None = None
    zki: str | None = None
    jir: str | None = None
    # Interna polja
    regija_id: int | None = None
    regija_naziv: str | None = None
    vozilo_tip: str | None = None
    total_weight: float | None = None
    total_volume: float | None = None
    manual_paleta: int | None = None
    synced_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Nested details
    details: list[NalogDetailOut] = Field(default_factory=list)
    # Polja iz tablice partneri (dostava / kupac) – popunjavaju se joinom
    partner_naziv: str | None = None
    partner_ime: str | None = None
    partner_prezime: str | None = None
    partner_mobitel: str | None = None
    partner_adresa: str | None = None
    partner_telefon: str | None = None
    partner_naziv_mjesta: str | None = None
    partner_postanski_broj: str | None = None
    partner_drzava: str | None = None
    partner_kontakt_osoba: str | None = None
    partner_e_mail: str | None = None

    model_config = ConfigDict(from_attributes=True)


class NalogListOut(BaseModel):
    """Pojednostavljena verzija naloga za liste."""
    nalog_prodaje_uid: str
    broj: int | None = None
    datum: date | None = None
    raspored: date | None = None
    status: str | None = None
    partner_uid: str | None = None
    korisnik__partner: str | None = None
    vrsta_isporuke: str | None = None
    za_naplatu: float | None = None
    napomena: str | None = None
    regija_id: int | None = None
    total_weight: float | None = None
    total_volume: float | None = None
    synced_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NalogUpdate(BaseModel):
    """Ažuriranje internih polja naloga."""
    regija_id: int | None = None
    vozilo_tip: str | None = None
    total_weight: float | None = None
    total_volume: float | None = None
    manual_paleta: int | None = None