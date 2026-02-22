-- ============================================================================
-- Migracija: Kreiranje tablica kriterije_sku i artikli_kriterija
-- Datum: 2026-02-09
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'kriterije_sku')
BEGIN
    CREATE TABLE kriterije_sku (
        id INT IDENTITY(1,1) PRIMARY KEY,
        naziv NVARCHAR(100) NOT NULL,
        opis NVARCHAR(500) NULL,
        created_at DATETIME DEFAULT GETUTCDATE(),
        updated_at DATETIME DEFAULT GETUTCDATE()
    );

    INSERT INTO kriterije_sku (naziv, opis) VALUES
        (N'Raster', N'Artikl velikih dimenzija, niske mase - zahtijeva posebnu pozornost kod rutiranja');

    PRINT 'Tablica kriterije_sku kreirana i popunjena.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'artikli_kriterija')
BEGIN
    CREATE TABLE artikli_kriterija (
        id INT IDENTITY(1,1) PRIMARY KEY,
        artikl NVARCHAR(50) NOT NULL,        -- sifra artikla (referenca na artikli.artikl)
        artikl_naziv NVARCHAR(500) NULL,     -- denormalizirano za lakse citanje
        kriterija_id INT NOT NULL,           -- FK na kriterije_sku.id
        created_at DATETIME DEFAULT GETUTCDATE(),
        updated_at DATETIME DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ak_kriterija FOREIGN KEY (kriterija_id) REFERENCES kriterije_sku(id),
        CONSTRAINT UQ_ak_artikl_kriterija UNIQUE (artikl, kriterija_id)
    );

    CREATE INDEX IX_artikli_kriterija_artikl ON artikli_kriterija (artikl);
    CREATE INDEX IX_artikli_kriterija_kriterija ON artikli_kriterija (kriterija_id);

    PRINT 'Tablica artikli_kriterija kreirana.';
END
GO

PRINT 'Migracija artikli kriterija zavrsena.';
GO
