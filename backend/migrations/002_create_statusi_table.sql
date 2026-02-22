-- ============================================================================
-- Migracija: Kreiranje tablice statusi
-- Datum: 2026-02-06
-- Opis: Tablica za definiranje statusa naloga
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'statusi')
BEGIN
    CREATE TABLE statusi (
        id NVARCHAR(10) NOT NULL PRIMARY KEY,
        naziv NVARCHAR(100) NOT NULL,
        opis NVARCHAR(500) NULL,
        redoslijed INT NOT NULL DEFAULT 0,
        aktivan BIT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT GETUTCDATE(),
        updated_at DATETIME DEFAULT GETUTCDATE()
    );
    PRINT 'Tablica statusi kreirana.';
END
ELSE
BEGIN
    PRINT 'Tablica statusi vec postoji.';
END
GO

-- ============================================================================
-- Default statusi
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '08')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('08', 'Odobreno', 10);
GO

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '101')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('101', 'Poslano u Mantis', 20);
GO

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '102')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('102', 'Preuzeto u Mantis', 30);
GO

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '103')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('103', 'U procesu slaganja', 40);
GO

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '30')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('30', 'Spremno za utovar', 50);
GO

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '31')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('31', 'Na dostavi', 60);
GO

IF NOT EXISTS (SELECT 1 FROM statusi WHERE id = '32')
    INSERT INTO statusi (id, naziv, redoslijed) VALUES ('32', 'Dostavljeno', 70);
GO

PRINT 'Migracija statusi zavrsena.';
GO
