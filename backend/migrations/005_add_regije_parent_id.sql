-- ============================================================================
-- Migracija: Dodavanje parent_id kolone u tablicu regije za hijerarhiju
-- Datum: 2026-02-09
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('regije') AND name = 'parent_id')
BEGIN
    ALTER TABLE regije ADD parent_id INT NULL;

    ALTER TABLE regije ADD CONSTRAINT FK_regije_parent
        FOREIGN KEY (parent_id) REFERENCES regije(id);

    CREATE INDEX IX_regije_parent ON regije (parent_id);

    PRINT 'Kolona parent_id dodana u regije.';
END
GO

PRINT 'Migracija regije hijerarhija zavrsena.';
GO
