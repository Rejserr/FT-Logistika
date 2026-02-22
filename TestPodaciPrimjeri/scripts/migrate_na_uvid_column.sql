-- ===================================================
-- Migration script: Update na_uvid column size
-- Changes na_uvid from NVARCHAR(1) to NVARCHAR(255)
-- ===================================================

USE OptimoRout;
GO

-- Check if column exists and update it
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NaloziHeader') AND name = 'na_uvid')
BEGIN
    ALTER TABLE NaloziHeader
    ALTER COLUMN na_uvid NVARCHAR(255);
    
    PRINT 'Column na_uvid updated successfully from NVARCHAR(1) to NVARCHAR(255)';
END
ELSE
BEGIN
    PRINT 'Column na_uvid does not exist';
END
GO
