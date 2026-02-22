-- ============================================================================
-- Migracija: Kreiranje tablice settings
-- Datum: 2026-02-06
-- Opis: Tablica za spremanje globalnih postavki aplikacije
-- ============================================================================

-- Kreiranje tablice settings ako ne postoji
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'settings')
BEGIN
    CREATE TABLE settings (
        [key] NVARCHAR(100) NOT NULL PRIMARY KEY,
        [value] NVARCHAR(MAX) NULL
    );
    PRINT 'Tablica settings kreirana.';
END
ELSE
BEGIN
    PRINT 'Tablica settings već postoji.';
END
GO

-- ============================================================================
-- Default vrijednosti za izračun palete
-- ============================================================================

-- PALETA_DUZINA_MM
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'PALETA_DUZINA_MM')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('PALETA_DUZINA_MM', '1200');
    PRINT 'Dodana postavka PALETA_DUZINA_MM = 1200';
END
GO

-- PALETA_SIRINA_MM
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'PALETA_SIRINA_MM')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('PALETA_SIRINA_MM', '800');
    PRINT 'Dodana postavka PALETA_SIRINA_MM = 800';
END
GO

-- PALETA_VISINA_MM
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'PALETA_VISINA_MM')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('PALETA_VISINA_MM', '1800');
    PRINT 'Dodana postavka PALETA_VISINA_MM = 1800';
END
GO

-- PALETA_MAX_TEZINA_KG
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'PALETA_MAX_TEZINA_KG')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('PALETA_MAX_TEZINA_KG', '1200');
    PRINT 'Dodana postavka PALETA_MAX_TEZINA_KG = 1200';
END
GO

-- PALETA_MAX_VISINA_ARTIKLA_MM
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'PALETA_MAX_VISINA_ARTIKLA_MM')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('PALETA_MAX_VISINA_ARTIKLA_MM', '2000');
    PRINT 'Dodana postavka PALETA_MAX_VISINA_ARTIKLA_MM = 2000';
END
GO

-- ============================================================================
-- Ostale default postavke
-- ============================================================================

-- DEFAULT_SERVICE_TIME_MINUTES
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'DEFAULT_SERVICE_TIME_MINUTES')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('DEFAULT_SERVICE_TIME_MINUTES', '15');
    PRINT 'Dodana postavka DEFAULT_SERVICE_TIME_MINUTES = 15';
END
GO

-- MAX_STOPS_PER_ROUTE
IF NOT EXISTS (SELECT 1 FROM settings WHERE [key] = 'MAX_STOPS_PER_ROUTE')
BEGIN
    INSERT INTO settings ([key], [value]) VALUES ('MAX_STOPS_PER_ROUTE', '20');
    PRINT 'Dodana postavka MAX_STOPS_PER_ROUTE = 20';
END
GO

PRINT 'Migracija završena.';
GO
