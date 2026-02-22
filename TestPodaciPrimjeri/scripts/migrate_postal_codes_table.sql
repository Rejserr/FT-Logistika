-- ===================================================
-- Migration script: PostanskiBrojevi table structure
-- Changes PRIMARY KEY from postanski_broj to id
-- Adds UNIQUE constraint on (postanski_broj, mjesto)
-- ===================================================

USE OptimoRout;
GO

-- Step 1: Backup existing data (optional, but recommended)
-- You can create a backup table if needed:
-- SELECT * INTO PostanskiBrojevi_backup FROM PostanskiBrojevi;
-- GO

-- Step 2: Drop existing constraints and indexes
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PostanskiBrojevi_Regija' AND object_id = OBJECT_ID('PostanskiBrojevi'))
    DROP INDEX IX_PostanskiBrojevi_Regija ON PostanskiBrojevi;
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'PK__Postansk__4CC2851719A07C84' AND object_id = OBJECT_ID('PostanskiBrojevi'))
BEGIN
    ALTER TABLE PostanskiBrojevi DROP CONSTRAINT PK__Postansk__4CC2851719A07C84;
END
GO

-- Step 3: Add new id column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'id' AND object_id = OBJECT_ID('PostanskiBrojevi'))
BEGIN
    ALTER TABLE PostanskiBrojevi ADD id INT IDENTITY(1,1);
END
GO

-- Step 4: Set id as PRIMARY KEY
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name LIKE 'PK__Postansk%' AND parent_object_id = OBJECT_ID('PostanskiBrojevi'))
BEGIN
    ALTER TABLE PostanskiBrojevi ADD CONSTRAINT PK_PostanskiBrojevi PRIMARY KEY (id);
END
GO

-- Step 5: Make postanski_broj NOT NULL (if it isn't already)
IF EXISTS (SELECT * FROM sys.columns WHERE name = 'postanski_broj' AND is_nullable = 1 AND object_id = OBJECT_ID('PostanskiBrojevi'))
BEGIN
    -- First, remove any NULL values
    UPDATE PostanskiBrojevi SET postanski_broj = '' WHERE postanski_broj IS NULL;
    ALTER TABLE PostanskiBrojevi ALTER COLUMN postanski_broj NVARCHAR(20) NOT NULL;
END
GO

-- Step 6: Recreate indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PostanskiBrojevi_Regija' AND object_id = OBJECT_ID('PostanskiBrojevi'))
    CREATE INDEX IX_PostanskiBrojevi_Regija ON PostanskiBrojevi(regija_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PostanskiBrojevi_PostanskiBroj' AND object_id = OBJECT_ID('PostanskiBrojevi'))
    CREATE INDEX IX_PostanskiBrojevi_PostanskiBroj ON PostanskiBrojevi(postanski_broj);
GO

-- Step 7: Add UNIQUE constraint on (postanski_broj, mjesto)
-- Note: This will fail if there are duplicates. Remove duplicates first if needed.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PostanskiBrojevi_Unique' AND object_id = OBJECT_ID('PostanskiBrojevi'))
BEGIN
    -- Remove duplicates first (keep the first one)
    WITH CTE AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY postanski_broj, mjesto ORDER BY id) AS rn
        FROM PostanskiBrojevi
    )
    DELETE FROM CTE WHERE rn > 1;
    
    -- Now create unique index
    CREATE UNIQUE INDEX IX_PostanskiBrojevi_Unique ON PostanskiBrojevi(postanski_broj, mjesto);
END
GO

PRINT 'Migration completed successfully!';
GO
