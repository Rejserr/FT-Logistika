"""
SQLAlchemy modeli za ERP entitete (Luceed).

Proširene tablice sa svim poljima iz Luceed API-ja.
"""
from sqlalchemy import (
    Column,
    String,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Boolean,
    Text,
    func,
)

from app.db.base import Base


class NaloziBlacklist(Base):
    """Nalozi blokirani za automatski ERP import. Ručno se mogu reimportirati."""
    __tablename__ = "nalozi_blacklist"

    nalog_prodaje_uid = Column(String(50), primary_key=True)
    razlog = Column(String(500), nullable=True)
    blocked_by = Column(String(100), nullable=True)
    blocked_at = Column(DateTime, server_default=func.getutcdate())


class VrstaIsporuke(Base):
    """Vrste isporuke koje filtriramo pri sync-u naloga."""
    __tablename__ = "vrste_isporuke"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vrsta_isporuke = Column(String(50), nullable=False, unique=True)
    opis = Column(String(255), nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class Partner(Base):
    """
    Partner (kupac/dobavljač) iz Luceed ERP-a.
    
    Sva polja mapirana iz API poziva: /datasnap/rest/partneri/sifra/{sifra}
    Primarni ključ je partner_uid (ne partner/sifra).
    """
    __tablename__ = "partneri"

    partner_uid = Column(String(50), primary_key=True)
    partner = Column(String(50), nullable=True, index=True)  # šifra partnera
    b2b_partner = Column(String(50), nullable=True)
    naziv = Column(String(255), nullable=True)
    ime = Column(String(100), nullable=True)
    prezime = Column(String(100), nullable=True)
    enabled = Column(String(1), nullable=True)
    tip_komitenta = Column(String(10), nullable=True)
    mobitel = Column(String(50), nullable=True)
    adresa = Column(String(255), nullable=True)
    maticni_broj = Column(String(50), nullable=True)
    oib = Column(String(20), nullable=True)
    pdv_broj = Column(String(50), nullable=True)
    ziro_racun = Column(String(50), nullable=True)
    telefon = Column(String(50), nullable=True)
    telefax = Column(String(50), nullable=True)
    mjesto_uid = Column(String(50), nullable=True)
    mjesto = Column(String(50), nullable=True)
    naziv_mjesta = Column(String(100), nullable=True)
    postanski_broj = Column(String(20), nullable=True)
    b2b_mjesto = Column(String(50), nullable=True)
    drzava_uid = Column(String(50), nullable=True)
    drzava = Column(String(10), nullable=True)
    naziv_drzave = Column(String(100), nullable=True)
    b2b_drzava = Column(String(50), nullable=True)
    valuta = Column(String(10), nullable=True)
    b2b_valuta = Column(String(50), nullable=True)
    rabat = Column(Numeric(18, 2), nullable=True)
    limit_iznos = Column(Numeric(18, 2), nullable=True)
    limit_dana = Column(Integer, nullable=True)
    odgoda_placanja = Column(Integer, nullable=True)
    iznos_zaduznice = Column(Numeric(18, 2), nullable=True)
    blokiran = Column(String(1), nullable=True)
    kontakt_osoba = Column(String(255), nullable=True)
    ugovor = Column(String(100), nullable=True)
    banka = Column(String(100), nullable=True)
    swift = Column(String(50), nullable=True)
    e_mail = Column(String(255), nullable=True)
    url = Column(String(255), nullable=True)
    napomena = Column(Text, nullable=True)
    upozorenje = Column(Text, nullable=True)
    gln = Column(String(50), nullable=True)
    placa_porez = Column(String(1), nullable=True)
    cassa_sconto = Column(String(1), nullable=True)
    tip_cijene = Column(String(10), nullable=True)
    tip_racuna = Column(String(10), nullable=True)
    datum_rodenja = Column(Date, nullable=True)
    spol = Column(String(1), nullable=True)
    placa_isporuku = Column(String(1), nullable=True)
    broj_osigurane_osobe = Column(String(50), nullable=True)
    export_cjenika = Column(String(1), nullable=True)
    grupacija_uid = Column(String(50), nullable=True)
    grupacija = Column(String(50), nullable=True)
    naziv_grupacije = Column(String(255), nullable=True)
    parent__partner_uid = Column(String(50), nullable=True)
    parent__partner = Column(String(50), nullable=True)
    parent__partner_b2b = Column(String(50), nullable=True)
    komercijalista_uid = Column(String(50), nullable=True)
    komercijalista = Column(String(50), nullable=True)
    ime_komercijaliste = Column(String(255), nullable=True)
    kam_uid = Column(String(50), nullable=True)
    kam = Column(String(50), nullable=True)
    ime_kam = Column(String(255), nullable=True)
    grupa_partnera_uid = Column(String(50), nullable=True)
    grupa_partnera = Column(String(50), nullable=True)
    naziv_grupe_partnera = Column(String(255), nullable=True)
    agent_uid = Column(String(50), nullable=True)
    agent = Column(String(50), nullable=True)
    naziv_agenta = Column(String(255), nullable=True)
    vrsta_isporuke_uid = Column(String(50), nullable=True)
    vrsta_isporuke = Column(String(50), nullable=True)
    naziv_vrste_isporuke = Column(String(255), nullable=True)
    grupa_mjesta_uid = Column(String(50), nullable=True)
    grupa_mjesta = Column(String(50), nullable=True)
    naziv_grupe_mjesta = Column(String(255), nullable=True)
    nivo_partnera_uid = Column(String(50), nullable=True)
    nivo_partnera = Column(String(50), nullable=True)
    naziv_nivoa_partnera = Column(String(255), nullable=True)
    suradnik_uid = Column(String(50), nullable=True)
    suradnik = Column(String(50), nullable=True)
    naziv_suradnika = Column(String(255), nullable=True)
    odakle_uid = Column(String(50), nullable=True)
    odakle = Column(String(50), nullable=True)
    odakle_naziv = Column(String(255), nullable=True)
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class GrupaArtikla(Base):
    """Normalizirane grupe artikala iz ERP-a."""
    __tablename__ = "grupe_artikala"

    grupa_artikla_uid = Column(String(50), primary_key=True)
    grupa_artikla = Column(String(50), nullable=False, unique=True)
    grupa_artikla_naziv = Column(String(255), nullable=True)
    nadgrupa_artikla = Column(String(50), nullable=True)
    nadgrupa_artikla_naziv = Column(String(255), nullable=True)
    supergrupa_artikla = Column(String(50), nullable=True)
    supergrupa_artikla_naziv = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class Artikl(Base):
    """Artikl iz Luceed ERP-a."""
    __tablename__ = "artikli"

    artikl_uid = Column(String(50), primary_key=True)
    artikl_b2b = Column(String(50), nullable=True)
    artikl = Column(String(50), nullable=False)
    naziv = Column(String(500), nullable=True)
    barcode = Column(String(100), nullable=True)
    jm = Column(String(20), nullable=True)
    vpc = Column(Numeric(18, 6), nullable=True)
    mpc = Column(Numeric(18, 6), nullable=True)
    duzina = Column(Numeric(18, 6), nullable=True)
    sirina = Column(Numeric(18, 6), nullable=True)
    visina = Column(Numeric(18, 6), nullable=True)
    masa = Column(Numeric(18, 6), nullable=True)
    volumen = Column(Numeric(18, 6), nullable=True)
    pakiranje = Column(String(50), nullable=True)
    pakiranje_jm = Column(String(20), nullable=True)
    pakiranje_masa = Column(Numeric(18, 6), nullable=True)
    pakiranje_barcode = Column(String(100), nullable=True)
    pakiranje_trans = Column(String(50), nullable=True)
    pakiranje_trans_jm = Column(String(20), nullable=True)
    pakiranje_trans_masa = Column(Numeric(18, 6), nullable=True)
    pakiranje_trans_barcode = Column(String(100), nullable=True)
    pakiranje_trans_duzina = Column(Numeric(18, 6), nullable=True)
    pakiranje_trans_sirina = Column(Numeric(18, 6), nullable=True)
    pakiranje_trans_visina = Column(Numeric(18, 6), nullable=True)
    naziv_kratki = Column(String(255), nullable=True)
    supergrupa_artikla = Column(String(50), nullable=True)
    supergrupa_artikla_naziv = Column(String(255), nullable=True)
    nadgrupa_artikla = Column(String(50), nullable=True)
    nadgrupa_artikla_naziv = Column(String(255), nullable=True)
    # Ovdje NE forsiramo FK constraint prema grupe_artikala,
    # jer ERP ponekad vraća grupu koja ne postoji u master listi.
    grupa_artikla_uid = Column(String(50), nullable=True)
    grupa_artikla = Column(String(50), nullable=True)
    grupa_artikla_naziv = Column(String(255), nullable=True)
    masa_netto = Column(Numeric(18, 6), nullable=True)
    pakiranje_duzina = Column(Numeric(18, 6), nullable=True)
    pakiranje_visina = Column(Numeric(18, 6), nullable=True)
    pakiranje_sirina = Column(Numeric(18, 6), nullable=True)
    paleta_kolicina = Column(Integer, nullable=True)
    proizvodac_uid = Column(String(50), nullable=True)
    proizvodac = Column(String(50), nullable=True)
    proizvodac_naziv = Column(String(255), nullable=True)
    glavni_dobavljac = Column(String(50), nullable=True)
    glavni_dobavljac_artikl = Column(String(255), nullable=True)
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class KriterijaSku(Base):
    """Lookup tablica za tipove kriterija artikala."""
    __tablename__ = "kriterije_sku"

    id = Column(Integer, primary_key=True, autoincrement=True)
    naziv = Column(String(100), nullable=False)
    opis = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class ArtiklKriterija(Base):
    """Veza artikla s kriterijem (npr. Raster artikli)."""
    __tablename__ = "artikli_kriterija"

    id = Column(Integer, primary_key=True, autoincrement=True)
    artikl = Column(String(50), nullable=False)
    artikl_naziv = Column(String(500), nullable=True)
    kriterija_id = Column(Integer, ForeignKey("kriterije_sku.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class Skladiste(Base):
    """Skladište - može biti centralno ili prodajno mjesto."""
    __tablename__ = "skladista"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), unique=True, nullable=True)  # "01", "100", "200" — maps to sa__skladiste/skladiste
    naziv = Column(String(255), nullable=False)
    adresa = Column(String(255), nullable=True)
    mjesto = Column(String(100), nullable=True)
    postanski_broj = Column(String(20), nullable=True)
    drzava = Column(String(50), nullable=True)
    lat = Column(Numeric(18, 8), nullable=True)
    lng = Column(Numeric(18, 8), nullable=True)
    tip = Column(String(20), nullable=False)  # central / store
    is_central = Column(Boolean, nullable=False, server_default="0")
    radno_vrijeme_od = Column(String(5), nullable=True)  # "07:00"
    radno_vrijeme_do = Column(String(5), nullable=True)  # "15:00"
    kontakt_telefon = Column(String(50), nullable=True)
    kontakt_email = Column(String(100), nullable=True)
    max_vozila = Column(Integer, nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")
    sync_naloga = Column(Boolean, nullable=False, server_default="0")
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class NalogHeader(Base):
    """
    Nalog prodaje header iz Luceed ERP-a.
    
    Sva polja mapirana iz API poziva: /datasnap/rest/NaloziProdaje/uid/{uid}
    Primarni ključ je nalog_prodaje_uid.
    Polje raspored = datum isporuke.
    """
    __tablename__ = "nalozi_header"

    nalog_prodaje_uid = Column(String(50), primary_key=True)
    nalog_prodaje_b2b = Column(String(50), nullable=True)
    broj = Column(Integer, nullable=True)
    datum = Column(Date, nullable=True)
    rezervacija_od_datuma = Column(DateTime, nullable=True)
    rezervacija_do_datuma = Column(Date, nullable=True)
    raspored = Column(Date, nullable=True, index=True)  # datum isporuke
    skladiste = Column(String(50), nullable=True)
    skladiste_b2b = Column(String(50), nullable=True)
    na__skladiste = Column(String(50), nullable=True)
    na__skladiste_b2b = Column(String(50), nullable=True)
    partner_uid = Column(String(50), ForeignKey("partneri.partner_uid"), nullable=True, index=True)
    partner = Column(String(50), nullable=True)
    partner_b2b = Column(String(50), nullable=True)
    korisnik__partner_uid = Column(String(50), nullable=True)
    korisnik__partner = Column(String(50), nullable=True)
    korisnik__partner_b2b = Column(String(50), nullable=True)
    agent__partner_uid = Column(String(50), nullable=True)
    agent__partner = Column(String(50), nullable=True)
    agent__partner_b2b = Column(String(50), nullable=True)
    narudzba = Column(String(100), nullable=True)
    kupac_placa_isporuku = Column(String(1), nullable=True)
    valuta = Column(String(10), nullable=True)
    valuta_b2b = Column(String(50), nullable=True)
    tecaj = Column(Numeric(18, 6), nullable=True)
    generalni_rabat = Column(String(50), nullable=True)
    placa_porez = Column(String(1), nullable=True)
    cassa_sconto = Column(String(1), nullable=True)
    poruka_gore = Column(Text, nullable=True)
    poruka_dolje = Column(Text, nullable=True)
    napomena = Column(Text, nullable=True)
    na_uvid = Column(String(50), nullable=True)
    referenca_isporuke = Column(String(100), nullable=True)
    sa__skladiste = Column(String(50), nullable=True)
    sa__skladiste_b2b = Column(String(50), nullable=True)
    skl_dokument = Column(String(10), nullable=True)
    skl_dokument_b2b = Column(String(50), nullable=True)
    status = Column(String(20), nullable=True, index=True)
    status_b2b = Column(String(50), nullable=True)
    komercijalist__radnik = Column(String(100), nullable=True)
    komercijalist__radnik_b2b = Column(String(50), nullable=True)
    dostavljac_uid = Column(String(50), nullable=True)
    dostavljac__radnik = Column(String(100), nullable=True)
    dostavljac__radnik_b2b = Column(String(50), nullable=True)
    kreirao__radnik_uid = Column(String(50), nullable=True)
    kreirao__radnik = Column(String(100), nullable=True)
    kreirao__radnik_ime = Column(String(255), nullable=True)
    vrsta_isporuke = Column(String(50), nullable=True, index=True)
    vrsta_isporuke_b2b = Column(String(50), nullable=True)
    izravna_dostava = Column(String(1), nullable=True)
    dropoff_sifra = Column(String(50), nullable=True)
    dropoff_naziv = Column(String(255), nullable=True)
    user_uid = Column(String(50), nullable=True)
    username = Column(String(100), nullable=True)
    user_b2b = Column(String(50), nullable=True)
    tip_racuna_uid = Column(String(50), nullable=True)
    tip_racuna = Column(String(20), nullable=True)
    tip_racuna_b2b = Column(String(50), nullable=True)
    predmet_uid = Column(String(50), nullable=True)
    predmet = Column(String(50), nullable=True)
    predmet_b2b = Column(String(50), nullable=True)
    za_naplatu = Column(Numeric(18, 2), nullable=True)
    zki = Column(String(100), nullable=True)
    jir = Column(String(100), nullable=True)
    # Interna polja koja mi računamo
    regija_id = Column(Integer, ForeignKey("regije.id"), nullable=True)
    vozilo_tip = Column(String(50), nullable=True)
    total_weight = Column(Numeric(18, 3), nullable=True)
    total_volume = Column(Numeric(18, 6), nullable=True)
    manual_paleta = Column(Integer, nullable=True)
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())


class NalogDetail(Base):
    """
    Stavka naloga prodaje iz Luceed ERP-a.
    
    Sva polja mapirana iz API poziva (stavke array unutar naloga).
    """
    __tablename__ = "nalozi_details"

    stavka_uid = Column(String(50), primary_key=True)
    nalog_prodaje_uid = Column(String(50), ForeignKey("nalozi_header.nalog_prodaje_uid"), nullable=False, index=True)
    artikl = Column(String(50), nullable=True)
    artikl_uid = Column(String(50), ForeignKey("artikli.artikl_uid"), nullable=True)
    artikl_b2b = Column(String(50), nullable=True)
    mjesto_troska = Column(String(50), nullable=True)
    mjesto_troska_uid = Column(String(50), nullable=True)
    mjesto_troska_b2b = Column(String(50), nullable=True)
    predmet = Column(String(50), nullable=True)
    predmet_uid = Column(String(50), nullable=True)
    predmet_b2b = Column(String(50), nullable=True)
    opis = Column(Text, nullable=True)
    kolicina = Column(Numeric(18, 3), nullable=True)
    pakiranja = Column(Numeric(18, 3), nullable=True)
    cijena = Column(Numeric(18, 2), nullable=True)
    detaljni_opis = Column(String(1), nullable=True)
    specifikacija = Column(Text, nullable=True)
    rabat = Column(Numeric(18, 2), nullable=True)
    dodatni_rabat = Column(String(50), nullable=True)
    redoslijed = Column(Integer, nullable=True)
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())
