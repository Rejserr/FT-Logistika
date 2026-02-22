-- ===================================================
-- OptimoRout Database Schema
-- SQL Server Database Creation Script
-- ===================================================

USE master;
GO

-- Create database if not exists
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'OptimoRout')
BEGIN
    CREATE DATABASE OptimoRout;
END
GO

USE OptimoRout;
GO

-- ===================================================
-- 1. AllowedDeliveryTypes (KRITIČNA TABLICA)
-- ===================================================
IF OBJECT_ID('AllowedDeliveryTypes', 'U') IS NOT NULL
    DROP TABLE AllowedDeliveryTypes;
GO

CREATE TABLE AllowedDeliveryTypes (
    vrsta_isporuke NVARCHAR(50) PRIMARY KEY,
    opis NVARCHAR(255),
    aktivan BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Inicijalni podaci
INSERT INTO AllowedDeliveryTypes (vrsta_isporuke, opis)
VALUES 
    ('VDK', 'Vlastita dostava Hrvatska'),
    ('B2BD', 'B2B dostava'),
    ('VDK-SLO', 'Vlastita dostava Slovenija'),
    ('B2BD-SLO', 'B2B dostava Slovenija');
GO

-- ===================================================
-- 2. Regije
-- ===================================================
IF OBJECT_ID('Regije', 'U') IS NOT NULL
    DROP TABLE Regije;
GO

CREATE TABLE Regije (
    regija_id INT IDENTITY(1,1) PRIMARY KEY,
    naziv_regije NVARCHAR(100) UNIQUE NOT NULL,
    opis NVARCHAR(255),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ===================================================
-- 3. PostanskiBrojevi
-- ===================================================
IF OBJECT_ID('PostanskiBrojevi', 'U') IS NOT NULL
    DROP TABLE PostanskiBrojevi;
GO

CREATE TABLE PostanskiBrojevi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    postanski_broj NVARCHAR(20) NOT NULL,
    mjesto NVARCHAR(255),
    regija_id INT,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (regija_id) REFERENCES Regije(regija_id)
);
GO

CREATE INDEX IX_PostanskiBrojevi_Regija ON PostanskiBrojevi(regija_id);
GO

CREATE INDEX IX_PostanskiBrojevi_PostanskiBroj ON PostanskiBrojevi(postanski_broj);
GO

CREATE UNIQUE INDEX IX_PostanskiBrojevi_Unique ON PostanskiBrojevi(postanski_broj, mjesto);
GO

-- ===================================================
-- 4. GrupeArtikala (normalizirana iz Artikli)
-- ===================================================
IF OBJECT_ID('GrupeArtikala', 'U') IS NOT NULL
    DROP TABLE GrupeArtikala;
GO

CREATE TABLE GrupeArtikala (
    grupa_artikla_uid NVARCHAR(50) PRIMARY KEY,
    grupa_artikla NVARCHAR(50) NOT NULL UNIQUE,
    grupa_artikla_naziv NVARCHAR(255),
    nadgrupa_artikla NVARCHAR(50),
    nadgrupa_artikla_naziv NVARCHAR(255),
    supergrupa_artikla NVARCHAR(50),
    supergrupa_artikla_naziv NVARCHAR(255),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ===================================================
-- 5. Artikli (sva ERP polja)
-- ===================================================
IF OBJECT_ID('Artikli', 'U') IS NOT NULL
    DROP TABLE Artikli;
GO

CREATE TABLE Artikli (
    artikl_uid NVARCHAR(50) PRIMARY KEY,
    artikl_b2b NVARCHAR(50),
    artikl NVARCHAR(50) NOT NULL,
    naziv NVARCHAR(500),
    barcode NVARCHAR(100),
    jm NVARCHAR(20),
    vpc DECIMAL(18,6),
    mpc DECIMAL(18,6),
    duzina DECIMAL(18,6),
    sirina DECIMAL(18,6),
    visina DECIMAL(18,6),
    masa DECIMAL(18,6),
    volumen DECIMAL(18,6),
    pakiranje NVARCHAR(50),
    pakiranje_jm NVARCHAR(20),
    pakiranje_masa DECIMAL(18,6),
    pakiranje_barcode NVARCHAR(100),
    pakiranje_trans NVARCHAR(50),
    pakiranje_trans_jm NVARCHAR(20),
    pakiranje_trans_masa DECIMAL(18,6),
    pakiranje_trans_barcode NVARCHAR(100),
    pakiranje_trans_duzina DECIMAL(18,6),
    pakiranje_trans_sirina DECIMAL(18,6),
    pakiranje_trans_visina DECIMAL(18,6),
    naziv_kratki NVARCHAR(255),
    supergrupa_artikla NVARCHAR(50),
    supergrupa_artikla_naziv NVARCHAR(255),
    nadgrupa_artikla NVARCHAR(50),
    nadgrupa_artikla_naziv NVARCHAR(255),
    grupa_artikla_uid NVARCHAR(50),
    grupa_artikla NVARCHAR(50),
    grupa_artikla_naziv NVARCHAR(255),
    masa_netto DECIMAL(18,6),
    pakiranje_duzina DECIMAL(18,6),
    pakiranje_visina DECIMAL(18,6),
    pakiranje_sirina DECIMAL(18,6),
    paleta_kolicina INT,
    proizvodac_uid NVARCHAR(50),
    proizvodac NVARCHAR(50),
    proizvodac_naziv NVARCHAR(255),
    glavni_dobavljac NVARCHAR(50),
    glavni_dobavljac_artikl NVARCHAR(50),
    synced_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (grupa_artikla_uid) REFERENCES GrupeArtikala(grupa_artikla_uid)
);
GO

CREATE INDEX IX_Artikli_Grupa ON Artikli(grupa_artikla_uid);
GO

-- ===================================================
-- 6. Partneri (sva ERP polja)
-- ===================================================
IF OBJECT_ID('Partneri', 'U') IS NOT NULL
    DROP TABLE Partneri;
GO

CREATE TABLE Partneri (
    partner_uid NVARCHAR(50) PRIMARY KEY,
    b2b_partner NVARCHAR(50),
    partner NVARCHAR(50) NOT NULL,
    naziv NVARCHAR(255),
    ime NVARCHAR(100),
    prezime NVARCHAR(100),
    enabled NVARCHAR(1),
    tip_komitenta NVARCHAR(1),
    mobitel NVARCHAR(50),
    adresa NVARCHAR(500),
    maticni_broj NVARCHAR(50),
    oib NVARCHAR(50),
    pdv_broj NVARCHAR(50),
    ziro_racun NVARCHAR(50),
    telefon NVARCHAR(50),
    telefax NVARCHAR(50),
    mjesto_uid NVARCHAR(50),
    mjesto NVARCHAR(50),
    naziv_mjesta NVARCHAR(255),
    postanski_broj NVARCHAR(20),
    b2b_mjesto NVARCHAR(50),
    drzava_uid NVARCHAR(50),
    drzava NVARCHAR(10),
    naziv_drzave NVARCHAR(100),
    b2b_drzava NVARCHAR(50),
    valuta NVARCHAR(10),
    b2b_valuta NVARCHAR(10),
    rabat DECIMAL(18,6),
    limit_iznos DECIMAL(18,6),
    limit_dana INT,
    odgoda_placanja INT,
    iznos_zaduznice DECIMAL(18,6),
    blokiran NVARCHAR(1),
    kontakt_osoba NVARCHAR(255),
    ugovor NVARCHAR(255),
    banka NVARCHAR(255),
    swift NVARCHAR(50),
    e_mail NVARCHAR(255),
    url NVARCHAR(500),
    napomena NVARCHAR(MAX),
    upozorenje NVARCHAR(MAX),
    gln NVARCHAR(50),
    placa_porez NVARCHAR(1),
    cassa_sconto NVARCHAR(1),
    tip_cijene NVARCHAR(10),
    tip_racuna NVARCHAR(50),
    datum_rodenja DATE,
    spol NVARCHAR(1),
    placa_isporuku NVARCHAR(1),
    broj_osigurane_osobe NVARCHAR(50),
    export_cjenika NVARCHAR(1),
    grupacija_uid NVARCHAR(50),
    grupacija NVARCHAR(50),
    naziv_grupacije NVARCHAR(255),
    parent__partner_uid NVARCHAR(50),
    parent__partner NVARCHAR(50),
    parent__partner_b2b NVARCHAR(50),
    komercijalista_uid NVARCHAR(50),
    komercijalista NVARCHAR(50),
    ime_komercijaliste NVARCHAR(255),
    kam_uid NVARCHAR(50),
    kam NVARCHAR(50),
    ime_kam NVARCHAR(255),
    grupa_partnera_uid NVARCHAR(50),
    grupa_partnera NVARCHAR(50),
    naziv_grupe_partnera NVARCHAR(255),
    agent_uid NVARCHAR(50),
    agent NVARCHAR(50),
    naziv_agenta NVARCHAR(255),
    vrsta_isporuke_uid NVARCHAR(50),
    vrsta_isporuke NVARCHAR(50),
    naziv_vrste_isporuke NVARCHAR(255),
    grupa_mjesta_uid NVARCHAR(50),
    grupa_mjesta NVARCHAR(50),
    naziv_grupe_mjesta NVARCHAR(255),
    nivo_partnera_uid NVARCHAR(50),
    nivo_partnera NVARCHAR(50),
    naziv_nivoa_partnera NVARCHAR(255),
    suradnik_uid NVARCHAR(50),
    suradnik NVARCHAR(50),
    naziv_suradnika NVARCHAR(255),
    odakle_uid NVARCHAR(50),
    odakle NVARCHAR(50),
    odakle_naziv NVARCHAR(255),
    synced_at DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX IX_Partneri_PostanskiBroj ON Partneri(postanski_broj);
GO

-- ===================================================
-- 7. PartneriAtributi
-- ===================================================
IF OBJECT_ID('PartneriAtributi', 'U') IS NOT NULL
    DROP TABLE PartneriAtributi;
GO

CREATE TABLE PartneriAtributi (
    partner_atribut_id INT IDENTITY(1,1) PRIMARY KEY,
    partner_uid NVARCHAR(50) NOT NULL,
    atribut_uid NVARCHAR(50),
    atribut_b2b NVARCHAR(50),
    atribut NVARCHAR(50),
    atribut_naziv NVARCHAR(255),
    atribut_tip NVARCHAR(50),
    aktivan NVARCHAR(1),
    redoslijed INT,
    vidljiv NVARCHAR(1),
    grupa_atributa_uid NVARCHAR(50),
    grupa_atributa_b2b NVARCHAR(50),
    grupa_atributa NVARCHAR(50),
    grupa_atributa_naziv NVARCHAR(255),
    vrijednost NVARCHAR(MAX),
    synced_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (partner_uid) REFERENCES Partneri(partner_uid) ON DELETE CASCADE
);
GO

CREATE INDEX IX_PartneriAtributi_Partner ON PartneriAtributi(partner_uid);
GO

-- ===================================================
-- 8. NaloziHeader (samo dozvoljene vrste isporuke!)
-- ===================================================
IF OBJECT_ID('NaloziHeader', 'U') IS NOT NULL
    DROP TABLE NaloziHeader;
GO

CREATE TABLE NaloziHeader (
    nalog_prodaje_uid NVARCHAR(50) PRIMARY KEY,
    nalog_prodaje_b2b NVARCHAR(50),
    broj INT,
    datum DATE,
    rezervacija_od_datuma DATETIME2,
    rezervacija_do_datuma DATE,
    raspored DATE,
    skladiste NVARCHAR(10),
    skladiste_b2b NVARCHAR(10),
    na__skladiste NVARCHAR(10),
    na__skladiste_b2b NVARCHAR(10),
    partner_uid NVARCHAR(50),
    partner NVARCHAR(50),
    partner_b2b NVARCHAR(50),
    korisnik__partner_uid NVARCHAR(50),
    korisnik__partner NVARCHAR(50),
    korisnik__partner_b2b NVARCHAR(50),
    agent__partner_uid NVARCHAR(50),
    agent__partner NVARCHAR(50),
    agent__partner_b2b NVARCHAR(50),
    narudzba NVARCHAR(255),
    kupac_placa_isporuku NVARCHAR(1),
    valuta NVARCHAR(10),
    valuta_b2b NVARCHAR(10),
    tecaj DECIMAL(18,6),
    generalni_rabat NVARCHAR(50),
    placa_porez NVARCHAR(1),
    cassa_sconto NVARCHAR(1),
    poruka_gore NVARCHAR(MAX),
    poruka_dolje NVARCHAR(MAX),
    napomena NVARCHAR(MAX),
    na_uvid NVARCHAR(255),
    referenca_isporuke NVARCHAR(255),
    sa__skladiste NVARCHAR(10),
    sa__skladiste_b2b NVARCHAR(10),
    skl_dokument NVARCHAR(10),
    skl_dokument_b2b NVARCHAR(10),
    status NVARCHAR(10),
    status_b2b NVARCHAR(10),
    komercijalist__radnik NVARCHAR(100),
    komercijalist__radnik_b2b NVARCHAR(100),
    dostavljac_uid NVARCHAR(50),
    dostavljac__radnik NVARCHAR(100),
    dostavljac__radnik_b2b NVARCHAR(100),
    kreirao__radnik_uid NVARCHAR(50),
    kreirao__radnik NVARCHAR(100),
    kreirao__radnik_ime NVARCHAR(255),
    vrsta_isporuke NVARCHAR(50) NOT NULL,
    vrsta_isporuke_b2b NVARCHAR(50),
    izravna_dostava NVARCHAR(1),
    dropoff_sifra NVARCHAR(50),
    dropoff_naziv NVARCHAR(255),
    user_uid NVARCHAR(50),
    username NVARCHAR(100),
    user_b2b NVARCHAR(50),
    tip_racuna_uid NVARCHAR(50),
    tip_racuna NVARCHAR(50),
    tip_racuna_b2b NVARCHAR(50),
    predmet_uid NVARCHAR(50),
    predmet NVARCHAR(50),
    predmet_b2b NVARCHAR(50),
    za_naplatu DECIMAL(18,6),
    zki NVARCHAR(255),
    jir NVARCHAR(255),
    -- Business logic fields
    regija_id INT,
    vozilo_tip NVARCHAR(20),
    total_weight DECIMAL(18,6),
    total_volume DECIMAL(18,6),
    synced_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (vrsta_isporuke) REFERENCES AllowedDeliveryTypes(vrsta_isporuke),
    FOREIGN KEY (regija_id) REFERENCES Regije(regija_id)
);
GO

CREATE INDEX IX_NaloziHeader_Regija ON NaloziHeader(regija_id);
CREATE INDEX IX_NaloziHeader_Raspored ON NaloziHeader(raspored);
CREATE INDEX IX_NaloziHeader_VoziloTip ON NaloziHeader(vozilo_tip);
CREATE INDEX IX_NaloziHeader_Status ON NaloziHeader(status);
GO

-- ===================================================
-- 9. NaloziDetails (stavke naloga)
-- ===================================================
IF OBJECT_ID('NaloziDetails', 'U') IS NOT NULL
    DROP TABLE NaloziDetails;
GO

CREATE TABLE NaloziDetails (
    stavka_uid NVARCHAR(50) PRIMARY KEY,
    nalog_prodaje_uid NVARCHAR(50) NOT NULL,
    artikl NVARCHAR(50),
    artikl_uid NVARCHAR(50),
    artikl_b2b NVARCHAR(50),
    mjesto_troska NVARCHAR(50),
    mjesto_troska_uid NVARCHAR(50),
    mjesto_troska_b2b NVARCHAR(50),
    predmet NVARCHAR(50),
    predmet_uid NVARCHAR(50),
    predmet_b2b NVARCHAR(50),
    opis NVARCHAR(MAX),
    kolicina DECIMAL(18,6),
    pakiranja DECIMAL(18,6),
    cijena DECIMAL(18,6),
    detaljni_opis NVARCHAR(1),
    specifikacija NVARCHAR(MAX),
    rabat DECIMAL(18,6),
    dodatni_rabat NVARCHAR(50),
    redoslijed INT,
    synced_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (nalog_prodaje_uid) REFERENCES NaloziHeader(nalog_prodaje_uid) ON DELETE CASCADE,
    FOREIGN KEY (artikl_uid) REFERENCES Artikli(artikl_uid)
);
GO

CREATE INDEX IX_NaloziDetails_Nalog ON NaloziDetails(nalog_prodaje_uid);
CREATE INDEX IX_NaloziDetails_Artikl ON NaloziDetails(artikl_uid);
GO

-- ===================================================
-- 10. LogistickaPravila
-- ===================================================
IF OBJECT_ID('LogistickaPravila', 'U') IS NOT NULL
    DROP TABLE LogistickaPravila;
GO

CREATE TABLE LogistickaPravila (
    pravilo_id INT IDENTITY(1,1) PRIMARY KEY,
    naziv_pravila NVARCHAR(100),
    regija_id INT NULL,
    grupa_artikla_uid NVARCHAR(50) NULL,
    min_masa DECIMAL(18,6),
    max_masa DECIMAL(18,6),
    min_volumen DECIMAL(18,6),
    max_volumen DECIMAL(18,6),
    vozilo_tip NVARCHAR(20) CHECK (vozilo_tip IN ('KAMION', 'KOMBI')),
    kapacitet DECIMAL(18,6),
    prioritet INT DEFAULT 100,
    aktivan BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (regija_id) REFERENCES Regije(regija_id),
    FOREIGN KEY (grupa_artikla_uid) REFERENCES GrupeArtikala(grupa_artikla_uid)
);
GO

CREATE INDEX IX_LogistickaPravila_Regija ON LogistickaPravila(regija_id);
CREATE INDEX IX_LogistickaPravila_Grupa ON LogistickaPravila(grupa_artikla_uid);
CREATE INDEX IX_LogistickaPravila_Aktivan ON LogistickaPravila(aktivan, prioritet);
GO

-- ===================================================
-- 11. OptimoOrders (generirani payloadi)
-- ===================================================
IF OBJECT_ID('OptimoOrders', 'U') IS NOT NULL
    DROP TABLE OptimoOrders;
GO

CREATE TABLE OptimoOrders (
    nalog_prodaje_uid NVARCHAR(50) PRIMARY KEY,
    payload_json NVARCHAR(MAX),
    regija_id INT,
    vozilo_tip NVARCHAR(20),
    generated_at DATETIME2 DEFAULT GETDATE(),
    sent_to_optimo BIT DEFAULT 0,
    sent_at DATETIME2,
    FOREIGN KEY (nalog_prodaje_uid) REFERENCES NaloziHeader(nalog_prodaje_uid),
    FOREIGN KEY (regija_id) REFERENCES Regije(regija_id)
);
GO

CREATE INDEX IX_OptimoOrders_Regija ON OptimoOrders(regija_id);
CREATE INDEX IX_OptimoOrders_Sent ON OptimoOrders(sent_to_optimo);
GO

-- ===================================================
-- 12. Vozila
-- ===================================================
IF OBJECT_ID('Vozila', 'U') IS NOT NULL
    DROP TABLE Vozila;
GO

CREATE TABLE Vozila (
    vozilo_id INT IDENTITY(1,1) PRIMARY KEY,
    registracija NVARCHAR(20) UNIQUE NOT NULL,
    oznaka NVARCHAR(20),
    tip NVARCHAR(20) CHECK (tip IN ('KAMION', 'KOMBI')) NOT NULL,
    profil_rutiranja NVARCHAR(50) DEFAULT 'Default',
    masa_kg DECIMAL(18,6),
    volumen_m3 DECIMAL(18,6),
    paleta INT,
    aktivan BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX IX_Vozila_Tip ON Vozila(tip);
CREATE INDEX IX_Vozila_Aktivan ON Vozila(aktivan);
GO

-- ===================================================
-- 13. VozilaRegije (Many-to-Many)
-- ===================================================
IF OBJECT_ID('VozilaRegije', 'U') IS NOT NULL
    DROP TABLE VozilaRegije;
GO

CREATE TABLE VozilaRegije (
    vozilo_id INT NOT NULL,
    regija_id INT NOT NULL,
    PRIMARY KEY (vozilo_id, regija_id),
    FOREIGN KEY (vozilo_id) REFERENCES Vozila(vozilo_id) ON DELETE CASCADE,
    FOREIGN KEY (regija_id) REFERENCES Regije(regija_id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_VozilaRegije_Vozilo ON VozilaRegije(vozilo_id);
CREATE INDEX IX_VozilaRegije_Regija ON VozilaRegije(regija_id);
GO

PRINT 'Database schema created successfully!';
GO
