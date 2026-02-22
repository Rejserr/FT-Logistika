-- ============================================================================
-- Migracija: Kreiranje tablica za rutiranje i arhivu naloga
-- Datum: 2026-02-11
--
-- Tablice:
--   1. nalozi_header_rutiranje  - nalozi prebaceni za rutiranje
--   2. nalozi_details_rutiranje - stavke naloga u rutiranju
--   3. nalozi_header_arhiva     - arhiv dostavljenih naloga (izvjestaji)
--   4. nalozi_details_arhiva    - stavke arhiviranih naloga
-- ============================================================================

-- 1. nalozi_header_rutiranje
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nalozi_header_rutiranje')
BEGIN
    CREATE TABLE nalozi_header_rutiranje (
        -- Sve kolone iz nalozi_header (identicne)
        nalog_prodaje_uid NVARCHAR(50) NOT NULL PRIMARY KEY,
        nalog_prodaje_b2b NVARCHAR(50) NULL,
        broj INT NULL,
        datum DATE NULL,
        rezervacija_od_datuma DATETIME NULL,
        rezervacija_do_datuma DATE NULL,
        raspored DATE NULL,
        skladiste NVARCHAR(50) NULL,
        skladiste_b2b NVARCHAR(50) NULL,
        na__skladiste NVARCHAR(50) NULL,
        na__skladiste_b2b NVARCHAR(50) NULL,
        partner_uid NVARCHAR(50) NULL,
        partner NVARCHAR(50) NULL,
        partner_b2b NVARCHAR(50) NULL,
        korisnik__partner_uid NVARCHAR(50) NULL,
        korisnik__partner NVARCHAR(50) NULL,
        korisnik__partner_b2b NVARCHAR(50) NULL,
        agent__partner_uid NVARCHAR(50) NULL,
        agent__partner NVARCHAR(50) NULL,
        agent__partner_b2b NVARCHAR(50) NULL,
        narudzba NVARCHAR(100) NULL,
        kupac_placa_isporuku NVARCHAR(1) NULL,
        valuta NVARCHAR(10) NULL,
        valuta_b2b NVARCHAR(50) NULL,
        tecaj DECIMAL(18,6) NULL,
        generalni_rabat NVARCHAR(50) NULL,
        placa_porez NVARCHAR(1) NULL,
        cassa_sconto NVARCHAR(1) NULL,
        poruka_gore NVARCHAR(MAX) NULL,
        poruka_dolje NVARCHAR(MAX) NULL,
        napomena NVARCHAR(MAX) NULL,
        na_uvid NVARCHAR(50) NULL,
        referenca_isporuke NVARCHAR(100) NULL,
        sa__skladiste NVARCHAR(50) NULL,
        sa__skladiste_b2b NVARCHAR(50) NULL,
        skl_dokument NVARCHAR(10) NULL,
        skl_dokument_b2b NVARCHAR(50) NULL,
        status NVARCHAR(20) NULL,
        status_b2b NVARCHAR(50) NULL,
        komercijalist__radnik NVARCHAR(100) NULL,
        komercijalist__radnik_b2b NVARCHAR(50) NULL,
        dostavljac_uid NVARCHAR(50) NULL,
        dostavljac__radnik NVARCHAR(100) NULL,
        dostavljac__radnik_b2b NVARCHAR(50) NULL,
        kreirao__radnik_uid NVARCHAR(50) NULL,
        kreirao__radnik NVARCHAR(100) NULL,
        kreirao__radnik_ime NVARCHAR(255) NULL,
        vrsta_isporuke NVARCHAR(50) NULL,
        vrsta_isporuke_b2b NVARCHAR(50) NULL,
        izravna_dostava NVARCHAR(1) NULL,
        dropoff_sifra NVARCHAR(50) NULL,
        dropoff_naziv NVARCHAR(255) NULL,
        user_uid NVARCHAR(50) NULL,
        username NVARCHAR(100) NULL,
        user_b2b NVARCHAR(50) NULL,
        tip_racuna_uid NVARCHAR(50) NULL,
        tip_racuna NVARCHAR(20) NULL,
        tip_racuna_b2b NVARCHAR(50) NULL,
        predmet_uid NVARCHAR(50) NULL,
        predmet NVARCHAR(50) NULL,
        predmet_b2b NVARCHAR(50) NULL,
        za_naplatu DECIMAL(18,2) NULL,
        zki NVARCHAR(100) NULL,
        jir NVARCHAR(100) NULL,
        regija_id INT NULL,
        vozilo_tip NVARCHAR(50) NULL,
        total_weight DECIMAL(18,3) NULL,
        total_volume DECIMAL(18,6) NULL,
        synced_at DATETIME NULL,
        created_at DATETIME DEFAULT GETUTCDATE(),
        updated_at DATETIME DEFAULT GETUTCDATE(),
        -- Dodatne kolone za rutiranje
        ruta_id INT NULL,
        status_rutiranja NVARCHAR(30) NOT NULL DEFAULT 'CEKA_RUTU',
        prebaceno_at DATETIME DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_nhr_ruta_id ON nalozi_header_rutiranje (ruta_id);
    CREATE INDEX IX_nhr_status_rutiranja ON nalozi_header_rutiranje (status_rutiranja);
    CREATE INDEX IX_nhr_raspored ON nalozi_header_rutiranje (raspored);
    CREATE INDEX IX_nhr_partner_uid ON nalozi_header_rutiranje (partner_uid);

    PRINT 'Tablica nalozi_header_rutiranje kreirana.';
END
GO

-- 2. nalozi_details_rutiranje
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nalozi_details_rutiranje')
BEGIN
    CREATE TABLE nalozi_details_rutiranje (
        stavka_uid NVARCHAR(50) NOT NULL PRIMARY KEY,
        nalog_prodaje_uid NVARCHAR(50) NOT NULL,
        artikl NVARCHAR(50) NULL,
        artikl_uid NVARCHAR(50) NULL,
        artikl_b2b NVARCHAR(50) NULL,
        mjesto_troska NVARCHAR(50) NULL,
        mjesto_troska_uid NVARCHAR(50) NULL,
        mjesto_troska_b2b NVARCHAR(50) NULL,
        predmet NVARCHAR(50) NULL,
        predmet_uid NVARCHAR(50) NULL,
        predmet_b2b NVARCHAR(50) NULL,
        opis NVARCHAR(MAX) NULL,
        kolicina DECIMAL(18,3) NULL,
        pakiranja DECIMAL(18,3) NULL,
        cijena DECIMAL(18,2) NULL,
        detaljni_opis NVARCHAR(1) NULL,
        specifikacija NVARCHAR(MAX) NULL,
        rabat DECIMAL(18,2) NULL,
        dodatni_rabat NVARCHAR(50) NULL,
        redoslijed INT NULL,
        synced_at DATETIME NULL,
        created_at DATETIME DEFAULT GETUTCDATE(),
        updated_at DATETIME DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ndr_header FOREIGN KEY (nalog_prodaje_uid)
            REFERENCES nalozi_header_rutiranje(nalog_prodaje_uid) ON DELETE CASCADE
    );

    CREATE INDEX IX_ndr_nalog_uid ON nalozi_details_rutiranje (nalog_prodaje_uid);

    PRINT 'Tablica nalozi_details_rutiranje kreirana.';
END
GO

-- 3. nalozi_header_arhiva
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nalozi_header_arhiva')
BEGIN
    CREATE TABLE nalozi_header_arhiva (
        -- ID za arhiv (autoincrement, jer isti nalog moze biti dostavljen vise puta kod prerutiranja)
        id INT IDENTITY(1,1) PRIMARY KEY,
        -- Sve kolone iz nalozi_header
        nalog_prodaje_uid NVARCHAR(50) NOT NULL,
        nalog_prodaje_b2b NVARCHAR(50) NULL,
        broj INT NULL,
        datum DATE NULL,
        rezervacija_od_datuma DATETIME NULL,
        rezervacija_do_datuma DATE NULL,
        raspored DATE NULL,
        skladiste NVARCHAR(50) NULL,
        skladiste_b2b NVARCHAR(50) NULL,
        na__skladiste NVARCHAR(50) NULL,
        na__skladiste_b2b NVARCHAR(50) NULL,
        partner_uid NVARCHAR(50) NULL,
        partner NVARCHAR(50) NULL,
        partner_b2b NVARCHAR(50) NULL,
        korisnik__partner_uid NVARCHAR(50) NULL,
        korisnik__partner NVARCHAR(50) NULL,
        korisnik__partner_b2b NVARCHAR(50) NULL,
        agent__partner_uid NVARCHAR(50) NULL,
        agent__partner NVARCHAR(50) NULL,
        agent__partner_b2b NVARCHAR(50) NULL,
        narudzba NVARCHAR(100) NULL,
        kupac_placa_isporuku NVARCHAR(1) NULL,
        valuta NVARCHAR(10) NULL,
        valuta_b2b NVARCHAR(50) NULL,
        tecaj DECIMAL(18,6) NULL,
        generalni_rabat NVARCHAR(50) NULL,
        placa_porez NVARCHAR(1) NULL,
        cassa_sconto NVARCHAR(1) NULL,
        poruka_gore NVARCHAR(MAX) NULL,
        poruka_dolje NVARCHAR(MAX) NULL,
        napomena NVARCHAR(MAX) NULL,
        na_uvid NVARCHAR(50) NULL,
        referenca_isporuke NVARCHAR(100) NULL,
        sa__skladiste NVARCHAR(50) NULL,
        sa__skladiste_b2b NVARCHAR(50) NULL,
        skl_dokument NVARCHAR(10) NULL,
        skl_dokument_b2b NVARCHAR(50) NULL,
        status NVARCHAR(20) NULL,
        status_b2b NVARCHAR(50) NULL,
        komercijalist__radnik NVARCHAR(100) NULL,
        komercijalist__radnik_b2b NVARCHAR(50) NULL,
        dostavljac_uid NVARCHAR(50) NULL,
        dostavljac__radnik NVARCHAR(100) NULL,
        dostavljac__radnik_b2b NVARCHAR(50) NULL,
        kreirao__radnik_uid NVARCHAR(50) NULL,
        kreirao__radnik NVARCHAR(100) NULL,
        kreirao__radnik_ime NVARCHAR(255) NULL,
        vrsta_isporuke NVARCHAR(50) NULL,
        vrsta_isporuke_b2b NVARCHAR(50) NULL,
        izravna_dostava NVARCHAR(1) NULL,
        dropoff_sifra NVARCHAR(50) NULL,
        dropoff_naziv NVARCHAR(255) NULL,
        user_uid NVARCHAR(50) NULL,
        username NVARCHAR(100) NULL,
        user_b2b NVARCHAR(50) NULL,
        tip_racuna_uid NVARCHAR(50) NULL,
        tip_racuna NVARCHAR(20) NULL,
        tip_racuna_b2b NVARCHAR(50) NULL,
        predmet_uid NVARCHAR(50) NULL,
        predmet NVARCHAR(50) NULL,
        predmet_b2b NVARCHAR(50) NULL,
        za_naplatu DECIMAL(18,2) NULL,
        zki NVARCHAR(100) NULL,
        jir NVARCHAR(100) NULL,
        regija_id INT NULL,
        vozilo_tip NVARCHAR(50) NULL,
        total_weight DECIMAL(18,3) NULL,
        total_volume DECIMAL(18,6) NULL,
        synced_at DATETIME NULL,
        created_at DATETIME NULL,
        updated_at DATETIME NULL,
        -- Podaci o ruti
        ruta_id INT NULL,
        ruta_datum DATE NULL,
        ruta_algoritam NVARCHAR(50) NULL,
        vozilo_id INT NULL,
        vozilo_oznaka NVARCHAR(100) NULL,
        vozac_id INT NULL,
        vozac_ime NVARCHAR(200) NULL,
        -- Podaci o dostavi
        redoslijed_dostave INT NULL,
        eta DATETIME NULL,
        vrijeme_dostave DATETIME NULL,
        status_dostave NVARCHAR(30) NULL,
        razlog_nedostave NVARCHAR(500) NULL,
        napomena_dostave NVARCHAR(MAX) NULL,
        gps_lat_dostave DECIMAL(18,8) NULL,
        gps_lng_dostave DECIMAL(18,8) NULL,
        -- Statistika rute
        distance_od_prethodnog_km DECIMAL(18,3) NULL,
        trajanje_od_prethodnog_min INT NULL,
        ukupna_distance_rute_km DECIMAL(18,3) NULL,
        ukupno_trajanje_rute_min INT NULL,
        broj_stopova_na_ruti INT NULL,
        -- Meta
        arhivirano_at DATETIME DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_nha_nalog_uid ON nalozi_header_arhiva (nalog_prodaje_uid);
    CREATE INDEX IX_nha_ruta_id ON nalozi_header_arhiva (ruta_id);
    CREATE INDEX IX_nha_ruta_datum ON nalozi_header_arhiva (ruta_datum);
    CREATE INDEX IX_nha_status_dostave ON nalozi_header_arhiva (status_dostave);
    CREATE INDEX IX_nha_partner_uid ON nalozi_header_arhiva (partner_uid);
    CREATE INDEX IX_nha_arhivirano ON nalozi_header_arhiva (arhivirano_at);

    PRINT 'Tablica nalozi_header_arhiva kreirana.';
END
GO

-- 4. nalozi_details_arhiva
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nalozi_details_arhiva')
BEGIN
    CREATE TABLE nalozi_details_arhiva (
        id INT IDENTITY(1,1) PRIMARY KEY,
        -- Referenca na arhiv header
        arhiva_header_id INT NOT NULL,
        -- Sve kolone iz nalozi_details
        stavka_uid NVARCHAR(50) NOT NULL,
        nalog_prodaje_uid NVARCHAR(50) NOT NULL,
        artikl NVARCHAR(50) NULL,
        artikl_uid NVARCHAR(50) NULL,
        artikl_b2b NVARCHAR(50) NULL,
        mjesto_troska NVARCHAR(50) NULL,
        mjesto_troska_uid NVARCHAR(50) NULL,
        mjesto_troska_b2b NVARCHAR(50) NULL,
        predmet NVARCHAR(50) NULL,
        predmet_uid NVARCHAR(50) NULL,
        predmet_b2b NVARCHAR(50) NULL,
        opis NVARCHAR(MAX) NULL,
        kolicina DECIMAL(18,3) NULL,
        pakiranja DECIMAL(18,3) NULL,
        cijena DECIMAL(18,2) NULL,
        detaljni_opis NVARCHAR(1) NULL,
        specifikacija NVARCHAR(MAX) NULL,
        rabat DECIMAL(18,2) NULL,
        dodatni_rabat NVARCHAR(50) NULL,
        redoslijed INT NULL,
        synced_at DATETIME NULL,
        created_at DATETIME NULL,
        updated_at DATETIME NULL,
        arhivirano_at DATETIME DEFAULT GETUTCDATE(),
        CONSTRAINT FK_nda_header FOREIGN KEY (arhiva_header_id)
            REFERENCES nalozi_header_arhiva(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_nda_header_id ON nalozi_details_arhiva (arhiva_header_id);
    CREATE INDEX IX_nda_nalog_uid ON nalozi_details_arhiva (nalog_prodaje_uid);

    PRINT 'Tablica nalozi_details_arhiva kreirana.';
END
GO

-- Ukloni FK constraint na rute_stops.nalog_uid -> nalozi_header (jer se nalozi brisu iz originala)
IF EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('rute_stops')
    AND name LIKE '%nalog%'
)
BEGIN
    DECLARE @fk_name NVARCHAR(200);
    SELECT @fk_name = name FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('rute_stops')
    AND name LIKE '%nalog%';

    EXEC('ALTER TABLE rute_stops DROP CONSTRAINT ' + @fk_name);
    PRINT 'FK constraint na rute_stops.nalog_uid uklonjen: ' + @fk_name;
END
GO

PRINT 'Migracija 007 zavrsena.';
GO
