-- SQL Server view: JSON payload per nalog (header + detalji + regija + grupe artikala)
-- Kreira view dbo.vw_optimo_payload_json s jednim JSON payloadom po nalogu

CREATE OR ALTER VIEW dbo.vw_optimo_payload_json
AS
SELECT
    h.nalog_prodaje_uid,
    JSON_QUERY(
        (
            SELECT
                h.nalog_prodaje_uid AS id,
                CONVERT(date, h.raspored) AS [date],
                JSON_QUERY(
                    (
                        SELECT
                            COALESCE(p.naziv, LTRIM(RTRIM(COALESCE(p.ime, '') + ' ' + COALESCE(p.prezime, '')))) AS [name],
                            p.adresa AS [address],
                            p.postanski_broj AS [postcode],
                            p.naziv_mjesta AS [city],
                            p.drzava AS [country]
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [location],
                CAST(h.total_weight AS decimal(18, 3)) AS [load1],
                CAST(h.total_volume / 1000000.0 AS decimal(18, 6)) AS [load2],
                JSON_QUERY(
                    CASE 
                        WHEN (
                            SELECT COUNT(*) 
                            FROM (
                                SELECT r.naziv_regije AS value WHERE r.regija_id IS NOT NULL
                                UNION ALL
                                SELECT h.vozilo_tip AS value WHERE h.vozilo_tip IS NOT NULL
                                UNION ALL
                                SELECT h.vrsta_isporuke AS value WHERE h.vrsta_isporuke IS NOT NULL
                            ) AS tag_values
                        ) > 0
                        THEN (
                            SELECT
                                '[' + STRING_AGG(QUOTENAME(value, '"'), ',') + ']'
                            FROM (
                                SELECT r.naziv_regije AS value WHERE r.regija_id IS NOT NULL
                                UNION ALL
                                SELECT h.vozilo_tip AS value WHERE h.vozilo_tip IS NOT NULL
                                UNION ALL
                                SELECT h.vrsta_isporuke AS value WHERE h.vrsta_isporuke IS NOT NULL
                            ) AS tag_values
                        )
                        ELSE NULL
                    END
                ) AS [tags],
                JSON_QUERY(
                    (
                        SELECT
                            h.nalog_prodaje_uid AS nalog_uid,
                            h.broj,
                            h.datum,
                            h.raspored,
                            h.status,
                            h.vrsta_isporuke,
                            h.vozilo_tip
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [customFields.header],
                JSON_QUERY(
                    (
                        SELECT
                            r.regija_id,
                            r.naziv_regije
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [customFields.regija],
                JSON_QUERY(
                    (
                        SELECT
                            d.stavka_uid,
                            d.artikl,
                            d.artikl_uid,
                            a.naziv AS artikl_naziv,
                            CAST(d.kolicina AS decimal(18, 3)) AS kolicina,
                            CAST(d.cijena AS decimal(18, 2)) AS cijena,
                            d.opis,
                            CAST(a.masa AS decimal(18, 3)) AS artikl_masa,
                            CAST(a.volumen / 1000000.0 AS decimal(18, 6)) AS artikl_volumen
                        FROM dbo.NaloziDetails d
                        LEFT JOIN dbo.Artikli a ON a.artikl_uid = d.artikl_uid
                        WHERE d.nalog_prodaje_uid = h.nalog_prodaje_uid
                        FOR JSON PATH
                    )
                ) AS [customFields.stavke],
                JSON_QUERY(
                    CASE
                        WHEN (
                            SELECT COUNT(*)
                            FROM (
                                SELECT DISTINCT
                                    a.grupa_artikla_naziv AS value
                                FROM dbo.NaloziDetails d
                                LEFT JOIN dbo.Artikli a ON a.artikl_uid = d.artikl_uid
                                WHERE d.nalog_prodaje_uid = h.nalog_prodaje_uid
                                  AND a.grupa_artikla_naziv IS NOT NULL
                            ) AS grupa_values
                        ) > 0
                        THEN (
                            SELECT
                                '[' + STRING_AGG(QUOTENAME(value, '"'), ',') + ']'
                            FROM (
                                SELECT DISTINCT
                                    a.grupa_artikla_naziv AS value
                                FROM dbo.NaloziDetails d
                                LEFT JOIN dbo.Artikli a ON a.artikl_uid = d.artikl_uid
                                WHERE d.nalog_prodaje_uid = h.nalog_prodaje_uid
                                  AND a.grupa_artikla_naziv IS NOT NULL
                            ) AS grupa_values
                        )
                        ELSE NULL
                    END
                ) AS [customFields.grupe_artikala]
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
    ) AS payload_json
FROM dbo.NaloziHeader h
LEFT JOIN dbo.Partneri p ON p.partner_uid = h.partner_uid
LEFT JOIN dbo.Regije r ON r.regija_id = h.regija_id;

GO

CREATE OR ALTER VIEW dbo.vw_optimo_payload_json_stavke
AS
SELECT
    d.nalog_prodaje_uid,
    d.stavka_uid,
    JSON_QUERY(
        (
            SELECT
                d.stavka_uid AS [orderNo],
                CONVERT(date, h.raspored) AS [date],
                'D' AS [type],
                CAST(ISNULL(a.masa, 0) * ISNULL(d.kolicina, 1) AS decimal(18, 3)) AS [load1],
                CAST(ISNULL(a.volumen, 0) / 1000000.0 * ISNULL(d.kolicina, 1) AS decimal(18, 6)) AS [load2],
                JSON_QUERY(
                    (
                        SELECT
                            COALESCE(p.naziv, LTRIM(RTRIM(COALESCE(p.ime, '') + ' ' + COALESCE(p.prezime, '')))) AS [locationName],
                            p.adresa AS [address],
                            p.postanski_broj AS [postcode],
                            p.naziv_mjesta AS [city],
                            p.drzava AS [country]
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [location],
                JSON_QUERY(
                    CASE 
                        WHEN (
                            SELECT COUNT(*) 
                            FROM (
                                SELECT r.naziv_regije AS value WHERE r.regija_id IS NOT NULL
                                UNION ALL
                                SELECT h.vozilo_tip AS value WHERE h.vozilo_tip IS NOT NULL
                                UNION ALL
                                SELECT h.vrsta_isporuke AS value WHERE h.vrsta_isporuke IS NOT NULL
                            ) AS tag_values
                        ) > 0
                        THEN (
                            SELECT
                                '[' + STRING_AGG(QUOTENAME(value, '"'), ',') + ']'
                            FROM (
                                SELECT r.naziv_regije AS value WHERE r.regija_id IS NOT NULL
                                UNION ALL
                                SELECT h.vozilo_tip AS value WHERE h.vozilo_tip IS NOT NULL
                                UNION ALL
                                SELECT h.vrsta_isporuke AS value WHERE h.vrsta_isporuke IS NOT NULL
                            ) AS tag_values
                        )
                        ELSE NULL
                    END
                ) AS [tags],
                h.nalog_prodaje_uid AS [group_orders],
                JSON_QUERY(
                    (
                        SELECT
                            h.nalog_prodaje_uid AS nalog_uid,
                            h.broj,
                            h.datum,
                            h.raspored,
                            h.status,
                            h.vrsta_isporuke,
                            h.vozilo_tip,
                            h.na_uvid,
                            r.regija_id,
                            r.naziv_regije,
                            d.stavka_uid,
                            d.artikl,
                            d.artikl_uid,
                            a.naziv AS artikl_naziv,
                            CAST(d.kolicina AS decimal(18, 3)) AS kolicina,
                            CAST(d.cijena AS decimal(18, 2)) AS cijena,
                            d.opis,
                            CAST(a.masa AS decimal(18, 3)) AS artikl_masa,
                            CAST(a.volumen / 1000000.0 AS decimal(18, 6)) AS artikl_volumen,
                            a.grupa_artikla_naziv AS grupa_artikla,
                            COALESCE(p.naziv, LTRIM(RTRIM(COALESCE(p.ime, '') + ' ' + COALESCE(p.prezime, '')))) AS naziv_korisnika,
                            p.adresa AS korisnik_adresa,
                            p.naziv_mjesta AS korisnik_mjesto,
                            p.drzava AS korisnik_drzava,
                            p.postanski_broj AS postanski_broj
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [customFields]
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
    ) AS payload_json
FROM dbo.NaloziDetails d
JOIN dbo.NaloziHeader h ON h.nalog_prodaje_uid = d.nalog_prodaje_uid
LEFT JOIN dbo.Partneri p ON p.partner_uid = h.partner_uid
LEFT JOIN dbo.Regije r ON r.regija_id = h.regija_id
LEFT JOIN dbo.Artikli a ON a.artikl_uid = d.artikl_uid;

GO

-- View koji generira JSON gotovo identičan onome što šaljemo na OptimoRoute (po grupi artikala)
-- Grupira sve stavke koje pripadaju istoj grupi artikala u jedan order
CREATE OR ALTER VIEW dbo.vw_optimo_send_payload_json_stavke
AS
WITH GrupiraneStavke AS (
    SELECT
        d.nalog_prodaje_uid,
        ISNULL(a.grupa_artikla_naziv, 'NEDEFINIRANO') AS grupa_artikla_naziv,
        -- Suma težine i volumena za sve stavke u grupi
        SUM(CAST(ISNULL(a.masa, 0) * ISNULL(d.kolicina, 1) AS decimal(18, 3))) AS total_load1,
        SUM(CAST(ISNULL(a.volumen, 0) / 1000000.0 * ISNULL(d.kolicina, 1) AS decimal(18, 6))) AS total_load2,
        -- String sa svim artiklima iz grupe odvojenim sa ||
        STRING_AGG(
            CONCAT(
                'artikl ',
                ISNULL(d.artikl, ''),
                CASE WHEN a.naziv IS NOT NULL THEN ' artikl_naziv: ' + a.naziv ELSE '' END,
                ' kolicina:',
                FORMAT(CAST(d.kolicina AS decimal(18, 3)), '0.###', 'en-US')
            ),
            ' || '
        ) WITHIN GROUP (ORDER BY d.stavka_uid) AS stavke_string
    FROM dbo.NaloziDetails d
    JOIN dbo.NaloziHeader h ON h.nalog_prodaje_uid = d.nalog_prodaje_uid
    LEFT JOIN dbo.Artikli a ON a.artikl_uid = d.artikl_uid
    LEFT JOIN dbo.GrupeArtikalaConfig gac ON LTRIM(RTRIM(gac.grupa_artikla_naziv)) = LTRIM(RTRIM(ISNULL(a.grupa_artikla_naziv, 'NEDEFINIRANO')))
    WHERE 
        -- Uključi samo grupe koje se šalju u OptimoRoute
        -- Ako nema konfiguracije (gac.grupa_artikla_naziv IS NULL), pretpostavljamo da se šalje (default: DA)
        -- Ako postoji konfiguracija, provjeri salje_se_u_optimo flag
        (gac.grupa_artikla_naziv IS NULL OR ISNULL(gac.salje_se_u_optimo, 1) = 1)
    GROUP BY d.nalog_prodaje_uid, ISNULL(a.grupa_artikla_naziv, 'NEDEFINIRANO')
)
SELECT
    gs.nalog_prodaje_uid,
    gs.grupa_artikla_naziv,
    JSON_QUERY(
        (
            SELECT
                'CREATE' AS [operation],
                -- orderNo: nalog_uid + '-' + hash grupe (prvih 10 znakova, bez posebnih znakova)
                CONCAT(
                    gs.nalog_prodaje_uid,
                    '-',
                    LEFT(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(gs.grupa_artikla_naziv, ' ', ''),
                                    '.', ''
                                ),
                                '-', ''
                            ),
                            '/', ''
                        ),
                        10
                    )
                ) AS [orderNo],
                CONVERT(date, h.raspored) AS [date],
                'D' AS [type],
                gs.total_load1 AS [load1],
                gs.total_load2 AS [load2],
                JSON_QUERY(
                    (
                        SELECT
                            -- Adresa u jednom stringu (kao što šaljemo u create_order)
                            CONCAT(
                                ISNULL(p.adresa, ''),
                                CASE 
                                    WHEN p.postanski_broj IS NOT NULL OR p.naziv_mjesta IS NOT NULL OR p.drzava IS NOT NULL
                                        THEN CONCAT(
                                            CASE WHEN p.adresa IS NOT NULL THEN ', ' ELSE '' END,
                                            ISNULL(p.postanski_broj, ''),
                                            CASE WHEN p.naziv_mjesta IS NOT NULL THEN ' ' + p.naziv_mjesta ELSE '' END,
                                            CASE WHEN p.drzava IS NOT NULL THEN ', ' + p.drzava ELSE '' END
                                        )
                                    ELSE ''
                                END
                            ) AS [address],
                            COALESCE(p.naziv, LTRIM(RTRIM(COALESCE(p.ime, '') + ' ' + COALESCE(p.prezime, '')))) AS [locationName]
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [location],
                CONCAT('Nalog ', gs.nalog_prodaje_uid, ' / grupa ', gs.grupa_artikla_naziv) AS [notes],
                JSON_QUERY(
                    (
                        SELECT
                            h.nalog_prodaje_uid AS group_orders,
                            r.naziv_regije AS tag_regija,
                            h.vozilo_tip AS tag_vozilo_tip,
                            h.vrsta_isporuke AS tag_vrsta_isporuke,
                            h.nalog_prodaje_uid AS nalog_uid,
                            h.broj,
                            h.datum,
                            h.raspored,
                            h.status,
                            h.vrsta_isporuke,
                            h.vozilo_tip,
                            h.na_uvid,
                            r.regija_id,
                            r.naziv_regije,
                            gs.grupa_artikla_naziv AS grupa_artikla,
                            COALESCE(p.naziv, LTRIM(RTRIM(COALESCE(p.ime, '') + ' ' + COALESCE(p.prezime, '')))) AS naziv_korisnika,
                            p.adresa AS korisnik_adresa,
                            p.naziv_mjesta AS korisnik_mjesto,
                            p.drzava AS korisnik_drzava,
                            p.postanski_broj AS postanski_broj,
                            gs.stavke_string AS stavke
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                ) AS [customFields]
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
    ) AS payload_json_send
FROM GrupiraneStavke gs
JOIN dbo.NaloziHeader h ON h.nalog_prodaje_uid = gs.nalog_prodaje_uid
LEFT JOIN dbo.Partneri p ON p.partner_uid = h.partner_uid
LEFT JOIN dbo.Regije r ON r.regija_id = h.regija_id;
