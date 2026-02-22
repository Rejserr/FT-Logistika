-- Tablica za konfiguraciju grupa artikala
-- Omogućava postavljanje kriterija za svaku grupu artikala (npr. da li se šalje u OptimoRoute)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GrupeArtikalaConfig]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[GrupeArtikalaConfig] (
        [grupa_artikla_naziv] NVARCHAR(255) NOT NULL PRIMARY KEY,
        [salje_se_u_optimo] BIT NOT NULL DEFAULT 1,
        [opis] NVARCHAR(500) NULL,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        [updated_at] DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX [IX_GrupeArtikalaConfig_SaljeSe] ON [dbo].[GrupeArtikalaConfig]([salje_se_u_optimo]);
    
    PRINT 'Tablica GrupeArtikalaConfig kreirana.';
END
ELSE
BEGIN
    PRINT 'Tablica GrupeArtikalaConfig već postoji.';
END
GO

-- Ako tablica postoji, provjeri da li kolona salje_se_u_optimo postoji
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GrupeArtikalaConfig]') AND type in (N'U'))
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[GrupeArtikalaConfig]') AND name = 'salje_se_u_optimo')
    BEGIN
        ALTER TABLE [dbo].[GrupeArtikalaConfig]
        ADD [salje_se_u_optimo] BIT NOT NULL DEFAULT 1;
        
        PRINT 'Kolona salje_se_u_optimo dodana.';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[GrupeArtikalaConfig]') AND name = 'opis')
    BEGIN
        ALTER TABLE [dbo].[GrupeArtikalaConfig]
        ADD [opis] NVARCHAR(500) NULL;
        
        PRINT 'Kolona opis dodana.';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[GrupeArtikalaConfig]') AND name = 'created_at')
    BEGIN
        ALTER TABLE [dbo].[GrupeArtikalaConfig]
        ADD [created_at] DATETIME2 DEFAULT GETDATE();
        
        PRINT 'Kolona created_at dodana.';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[GrupeArtikalaConfig]') AND name = 'updated_at')
    BEGIN
        ALTER TABLE [dbo].[GrupeArtikalaConfig]
        ADD [updated_at] DATETIME2 DEFAULT GETDATE();
        
        PRINT 'Kolona updated_at dodana.';
    END
END
GO
