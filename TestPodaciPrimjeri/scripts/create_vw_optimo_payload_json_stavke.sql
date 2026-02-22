-- Kreira view dbo.vw_optimo_payload_json_stavke (po stavkama, za slanje u OptimoRoute)
-- Izvrši ovu skriptu u SQL Server Management Studio

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
                            a.grupa_artikla_naziv AS grupa_artikla
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
