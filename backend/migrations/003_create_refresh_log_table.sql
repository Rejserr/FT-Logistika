-- ============================================================================
-- Migracija: Kreiranje tablice refresh_log
-- Datum: 2026-02-06
-- Opis: Praćenje promjena na nalozima i partnerima kod osvježavanja
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'refresh_log')
BEGIN
    CREATE TABLE refresh_log (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sync_log_id INT NULL,
        nalog_prodaje_uid NVARCHAR(50) NOT NULL,
        partner_uid NVARCHAR(50) NULL,
        tip NVARCHAR(20) NOT NULL,  -- 'HEADER' ili 'PARTNER'
        polja_promijenjena NVARCHAR(MAX) NULL,  -- JSON s listom promijenjenih polja
        stare_vrijednosti NVARCHAR(MAX) NULL,   -- JSON sa starim vrijednostima
        nove_vrijednosti NVARCHAR(MAX) NULL,     -- JSON s novim vrijednostima
        created_at DATETIME DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_refresh_log_nalog ON refresh_log (nalog_prodaje_uid);
    CREATE INDEX IX_refresh_log_sync ON refresh_log (sync_log_id);
    CREATE INDEX IX_refresh_log_created ON refresh_log (created_at DESC);

    PRINT 'Tablica refresh_log kreirana.';
END
ELSE
BEGIN
    PRINT 'Tablica refresh_log vec postoji.';
END
GO

PRINT 'Migracija refresh_log zavrsena.';
GO
