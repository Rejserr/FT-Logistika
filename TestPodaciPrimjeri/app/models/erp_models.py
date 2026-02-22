"""
ERP models - Artikli, GrupeArtikala, NaloziHeader, NaloziDetails, Partneri, PartneriAtributi
"""
from sqlalchemy import (
    Column, String, Integer, Numeric, Date, DateTime, ForeignKey, 
    Boolean, Text, Index, CheckConstraint
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class GrupeArtikala(Base):
    """Normalizirane grupe artikala iz ERP-a"""
    __tablename__ = "GrupeArtikala"
    
    grupa_artikla_uid = Column(String(50), primary_key=True)
    grupa_artikla = Column(String(50), unique=True, nullable=False)
    grupa_artikla_naziv = Column(String(255), nullable=True)
    nadgrupa_artikla = Column(String(50), nullable=True)
    nadgrupa_artikla_naziv = Column(String(255), nullable=True)
    supergrupa_artikla = Column(String(50), nullable=True)
    supergrupa_artikla_naziv = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    artikli = relationship("Artikli", back_populates="grupa")
    logisticka_pravila = relationship("LogistickaPravila", back_populates="grupa_artikla")
    
    def __repr__(self):
        return f"<GrupeArtikala(grupa_artikla='{self.grupa_artikla}', naziv='{self.grupa_artikla_naziv}')>"


class Artikli(Base):
    """Artikli iz ERP-a"""
    __tablename__ = "Artikli"
    
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
    grupa_artikla_uid = Column(String(50), ForeignKey("GrupeArtikala.grupa_artikla_uid"), nullable=True)
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
    glavni_dobavljac_artikl = Column(String(50), nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    grupa = relationship("GrupeArtikala", back_populates="artikli")
    stavke = relationship("NaloziDetails", foreign_keys="[NaloziDetails.artikl_uid]", back_populates="artikl_obj")
    
    __table_args__ = (
        Index("IX_Artikli_Grupa", "grupa_artikla_uid"),
    )
    
    def __repr__(self):
        return f"<Artikli(artikl='{self.artikl}', naziv='{self.naziv}')>"


class Partneri(Base):
    """Partneri (kupci) iz ERP-a"""
    __tablename__ = "Partneri"
    
    partner_uid = Column(String(50), primary_key=True)
    b2b_partner = Column(String(50), nullable=True)
    partner = Column(String(50), nullable=False)
    naziv = Column(String(255), nullable=True)
    ime = Column(String(100), nullable=True)
    prezime = Column(String(100), nullable=True)
    enabled = Column(String(1), nullable=True)
    tip_komitenta = Column(String(1), nullable=True)
    mobitel = Column(String(50), nullable=True)
    adresa = Column(String(500), nullable=True)
    maticni_broj = Column(String(50), nullable=True)
    oib = Column(String(50), nullable=True)
    pdv_broj = Column(String(50), nullable=True)
    ziro_racun = Column(String(50), nullable=True)
    telefon = Column(String(50), nullable=True)
    telefax = Column(String(50), nullable=True)
    mjesto_uid = Column(String(50), nullable=True)
    mjesto = Column(String(50), nullable=True)
    naziv_mjesta = Column(String(255), nullable=True)
    postanski_broj = Column(String(20), nullable=True)
    b2b_mjesto = Column(String(50), nullable=True)
    drzava_uid = Column(String(50), nullable=True)
    drzava = Column(String(10), nullable=True)
    naziv_drzave = Column(String(100), nullable=True)
    b2b_drzava = Column(String(50), nullable=True)
    valuta = Column(String(10), nullable=True)
    b2b_valuta = Column(String(10), nullable=True)
    rabat = Column(Numeric(18, 6), nullable=True)
    limit_iznos = Column(Numeric(18, 6), nullable=True)
    limit_dana = Column(Integer, nullable=True)
    odgoda_placanja = Column(Integer, nullable=True)
    iznos_zaduznice = Column(Numeric(18, 6), nullable=True)
    blokiran = Column(String(1), nullable=True)
    kontakt_osoba = Column(String(255), nullable=True)
    ugovor = Column(String(255), nullable=True)
    banka = Column(String(255), nullable=True)
    swift = Column(String(50), nullable=True)
    e_mail = Column(String(255), nullable=True)
    url = Column(String(500), nullable=True)
    napomena = Column(Text, nullable=True)
    upozorenje = Column(Text, nullable=True)
    gln = Column(String(50), nullable=True)
    placa_porez = Column(String(1), nullable=True)
    cassa_sconto = Column(String(1), nullable=True)
    tip_cijene = Column(String(10), nullable=True)
    tip_racuna = Column(String(50), nullable=True)
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
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    atributi = relationship("PartneriAtributi", back_populates="partner", cascade="all, delete-orphan")
    nalozi = relationship("NaloziHeader", back_populates="partner_obj")
    
    __table_args__ = (
        Index("IX_Partneri_PostanskiBroj", "postanski_broj"),
    )
    
    def __repr__(self):
        return f"<Partneri(partner='{self.partner}', naziv='{self.naziv or self.ime}')>"


class PartneriAtributi(Base):
    """Atributi partnera iz ERP-a"""
    __tablename__ = "PartneriAtributi"
    
    partner_atribut_id = Column(Integer, primary_key=True, autoincrement=True)
    partner_uid = Column(String(50), ForeignKey("Partneri.partner_uid", ondelete="CASCADE"), nullable=False)
    atribut_uid = Column(String(50), nullable=True)
    atribut_b2b = Column(String(50), nullable=True)
    atribut = Column(String(50), nullable=True)
    atribut_naziv = Column(String(255), nullable=True)
    atribut_tip = Column(String(50), nullable=True)
    aktivan = Column(String(1), nullable=True)
    redoslijed = Column(Integer, nullable=True)
    vidljiv = Column(String(1), nullable=True)
    grupa_atributa_uid = Column(String(50), nullable=True)
    grupa_atributa_b2b = Column(String(50), nullable=True)
    grupa_atributa = Column(String(50), nullable=True)
    grupa_atributa_naziv = Column(String(255), nullable=True)
    vrijednost = Column(Text, nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    partner = relationship("Partneri", back_populates="atributi")
    
    __table_args__ = (
        Index("IX_PartneriAtributi_Partner", "partner_uid"),
    )
    
    def __repr__(self):
        return f"<PartneriAtributi(partner_uid='{self.partner_uid}', atribut_naziv='{self.atribut_naziv}')>"


class NaloziHeader(Base):
    """Header naloga prodaje iz ERP-a (samo dozvoljene vrste isporuke)"""
    __tablename__ = "NaloziHeader"
    
    nalog_prodaje_uid = Column(String(50), primary_key=True)
    nalog_prodaje_b2b = Column(String(50), nullable=True)
    broj = Column(Integer, nullable=True)
    datum = Column(Date, nullable=True)
    rezervacija_od_datuma = Column(DateTime(timezone=True), nullable=True)
    rezervacija_do_datuma = Column(Date, nullable=True)
    raspored = Column(Date, nullable=True)
    skladiste = Column(String(10), nullable=True)
    skladiste_b2b = Column(String(10), nullable=True)
    na__skladiste = Column(String(10), nullable=True)
    na__skladiste_b2b = Column(String(10), nullable=True)
    partner_uid = Column(String(50), ForeignKey("Partneri.partner_uid"), nullable=True)
    partner = Column(String(50), nullable=True)
    partner_b2b = Column(String(50), nullable=True)
    korisnik__partner_uid = Column(String(50), nullable=True)
    korisnik__partner = Column(String(50), nullable=True)
    korisnik__partner_b2b = Column(String(50), nullable=True)
    agent__partner_uid = Column(String(50), nullable=True)
    agent__partner = Column(String(50), nullable=True)
    agent__partner_b2b = Column(String(50), nullable=True)
    narudzba = Column(String(255), nullable=True)
    kupac_placa_isporuku = Column(String(1), nullable=True)
    valuta = Column(String(10), nullable=True)
    valuta_b2b = Column(String(10), nullable=True)
    tecaj = Column(Numeric(18, 6), nullable=True)
    generalni_rabat = Column(String(50), nullable=True)
    placa_porez = Column(String(1), nullable=True)
    cassa_sconto = Column(String(1), nullable=True)
    poruka_gore = Column(Text, nullable=True)
    poruka_dolje = Column(Text, nullable=True)
    napomena = Column(Text, nullable=True)
    na_uvid = Column(String(255), nullable=True)
    referenca_isporuke = Column(String(255), nullable=True)
    sa__skladiste = Column(String(10), nullable=True)
    sa__skladiste_b2b = Column(String(10), nullable=True)
    skl_dokument = Column(String(10), nullable=True)
    skl_dokument_b2b = Column(String(10), nullable=True)
    status = Column(String(10), nullable=True)
    status_b2b = Column(String(10), nullable=True)
    komercijalist__radnik = Column(String(100), nullable=True)
    komercijalist__radnik_b2b = Column(String(100), nullable=True)
    dostavljac_uid = Column(String(50), nullable=True)
    dostavljac__radnik = Column(String(100), nullable=True)
    dostavljac__radnik_b2b = Column(String(100), nullable=True)
    kreirao__radnik_uid = Column(String(50), nullable=True)
    kreirao__radnik = Column(String(100), nullable=True)
    kreirao__radnik_ime = Column(String(255), nullable=True)
    vrsta_isporuke = Column(String(50), ForeignKey("AllowedDeliveryTypes.vrsta_isporuke"), nullable=False)
    vrsta_isporuke_b2b = Column(String(50), nullable=True)
    izravna_dostava = Column(String(1), nullable=True)
    dropoff_sifra = Column(String(50), nullable=True)
    dropoff_naziv = Column(String(255), nullable=True)
    user_uid = Column(String(50), nullable=True)
    username = Column(String(100), nullable=True)
    user_b2b = Column(String(50), nullable=True)
    tip_racuna_uid = Column(String(50), nullable=True)
    tip_racuna = Column(String(50), nullable=True)
    tip_racuna_b2b = Column(String(50), nullable=True)
    predmet_uid = Column(String(50), nullable=True)
    predmet = Column(String(50), nullable=True)
    predmet_b2b = Column(String(50), nullable=True)
    za_naplatu = Column(Numeric(18, 6), nullable=True)
    zki = Column(String(255), nullable=True)
    jir = Column(String(255), nullable=True)
    
    # Business logic fields
    regija_id = Column(Integer, ForeignKey("Regije.regija_id"), nullable=True)
    vozilo_tip = Column(String(20), nullable=True)
    total_weight = Column(Numeric(18, 6), nullable=True)
    total_volume = Column(Numeric(18, 6), nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    regija = relationship("Regije", back_populates="nalozi")
    partner_obj = relationship("Partneri", back_populates="nalozi")
    stavke = relationship("NaloziDetails", back_populates="nalog", cascade="all, delete-orphan")
    optimo_order = relationship("OptimoOrders", back_populates="nalog", uselist=False)
    
    __table_args__ = (
        Index("IX_NaloziHeader_Regija", "regija_id"),
        Index("IX_NaloziHeader_Raspored", "raspored"),
        Index("IX_NaloziHeader_VoziloTip", "vozilo_tip"),
        Index("IX_NaloziHeader_Status", "status"),
    )
    
    def __repr__(self):
        return f"<NaloziHeader(nalog_prodaje_uid='{self.nalog_prodaje_uid}', broj={self.broj}, vrsta_isporuke='{self.vrsta_isporuke}')>"


class NaloziDetails(Base):
    """Stavke (details) naloga prodaje iz ERP-a"""
    __tablename__ = "NaloziDetails"
    
    stavka_uid = Column(String(50), primary_key=True)
    nalog_prodaje_uid = Column(String(50), ForeignKey("NaloziHeader.nalog_prodaje_uid", ondelete="CASCADE"), nullable=False)
    artikl = Column(String(50), nullable=True)
    artikl_uid = Column(String(50), ForeignKey("Artikli.artikl_uid"), nullable=True)
    artikl_b2b = Column(String(50), nullable=True)
    mjesto_troska = Column(String(50), nullable=True)
    mjesto_troska_uid = Column(String(50), nullable=True)
    mjesto_troska_b2b = Column(String(50), nullable=True)
    predmet = Column(String(50), nullable=True)
    predmet_uid = Column(String(50), nullable=True)
    predmet_b2b = Column(String(50), nullable=True)
    opis = Column(Text, nullable=True)
    kolicina = Column(Numeric(18, 6), nullable=True)
    pakiranja = Column(Numeric(18, 6), nullable=True)
    cijena = Column(Numeric(18, 6), nullable=True)
    detaljni_opis = Column(String(1), nullable=True)
    specifikacija = Column(Text, nullable=True)
    rabat = Column(Numeric(18, 6), nullable=True)
    dodatni_rabat = Column(String(50), nullable=True)
    redoslijed = Column(Integer, nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    nalog = relationship("NaloziHeader", back_populates="stavke")
    artikl_obj = relationship("Artikli", foreign_keys=[artikl_uid], back_populates="stavke")
    
    __table_args__ = (
        Index("IX_NaloziDetails_Nalog", "nalog_prodaje_uid"),
        Index("IX_NaloziDetails_Artikl", "artikl_uid"),
    )
    
    def __repr__(self):
        return f"<NaloziDetails(stavka_uid='{self.stavka_uid}', artikl='{self.artikl}', kolicina={self.kolicina})>"
