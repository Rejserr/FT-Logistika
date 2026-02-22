-- ============================================================
-- 010: Kreiranje tablice mantis_sscc
-- Cache za Mantis WMS SSCC podatke (v_CST_OrderProgress)
-- ============================================================

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'mantis_sscc'
)
BEGIN
    CREATE TABLE [dbo].[mantis_sscc] (
        [id]                          INT IDENTITY(1,1) PRIMARY KEY,
        [order_code]                  VARCHAR(50)   NOT NULL,
        [nalog_prodaje_uid]           VARCHAR(50)   NULL,
        [order_shipment_code]         VARCHAR(50)   NULL,
        [product_id]                  INT           NULL,
        [product]                     NVARCHAR(500) NULL,
        [quantity]                    DECIMAL(18,6) NULL,
        [item_status_id]              INT           NULL,
        [item_status_code]            VARCHAR(20)   NULL,
        [item_status_code2]           VARCHAR(20)   NULL,
        [item_status]                 NVARCHAR(100) NULL,
        [zone]                        VARCHAR(50)   NULL,
        [zone_id]                     INT           NULL,
        [location]                    VARCHAR(100)  NULL,
        [sscc]                        VARCHAR(50)   NULL,
        [psscc]                       VARCHAR(50)   NULL,
        [order_shipment_status_id]    INT           NULL,
        [order_shipment_status_code]  VARCHAR(20)   NULL,
        [order_shipment_status]       NVARCHAR(100) NULL,
        [customer]                    NVARCHAR(255) NULL,
        [receiver]                    NVARCHAR(255) NULL,
        [memo]                        NVARCHAR(MAX) NULL,
        [assigned_user]               VARCHAR(100)  NULL,
        [agency]                      VARCHAR(100)  NULL,
        [city]                        NVARCHAR(100) NULL,
        [synced_at]                   DATETIME      NOT NULL,
        [created_at]                  DATETIME      NOT NULL DEFAULT GETUTCDATE(),
        [updated_at]                  DATETIME      NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_mantis_sscc_order_code ON [dbo].[mantis_sscc] ([order_code]);
    CREATE INDEX IX_mantis_sscc_nalog_uid ON [dbo].[mantis_sscc] ([nalog_prodaje_uid]);
    CREATE INDEX IX_mantis_sscc_sscc ON [dbo].[mantis_sscc] ([sscc]);

    PRINT 'Tablica mantis_sscc kreirana.';
END
ELSE
BEGIN
    PRINT 'Tablica mantis_sscc vec postoji.';
END
GO
