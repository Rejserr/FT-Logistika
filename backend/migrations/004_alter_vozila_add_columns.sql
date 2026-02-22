-- ============================================================================
-- Migracija: Dodavanje kolona profil_rutiranja i paleta u tablicu vozila
-- Datum: 2026-02-07
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('vozila') AND name = 'profil_rutiranja')
BEGIN
    ALTER TABLE vozila ADD profil_rutiranja NVARCHAR(200) NULL;
    PRINT 'Kolona profil_rutiranja dodana u vozila.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('vozila') AND name = 'paleta')
BEGIN
    ALTER TABLE vozila ADD paleta INT NULL;
    PRINT 'Kolona paleta dodana u vozila.';
END
GO

PRINT 'Migracija vozila zavrsena.';
GO
