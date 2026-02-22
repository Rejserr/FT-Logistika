"""Expand ERP tables with full Luceed API fields

Revision ID: 0003_expand_erp_tables
Revises: 0002_add_naziv_mjesta_postanski_brojevi
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa

revision = "0003_expand_erp_tables"
down_revision = "0002_naziv_mjesta"
branch_labels = None
depends_on = None


def upgrade() -> None:
    utcnow = sa.text("GETUTCDATE()")

    # -------------------------------------------------------------------------
    # 1. Dropati postojeće tablice (redoslijed bitan zbog FK)
    # -------------------------------------------------------------------------
    # Prvo dropati FK na rute_stops koji referencira nalozi_header
    op.execute("""
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql = @sql + 'ALTER TABLE rute_stops DROP CONSTRAINT [' + fk.name + '];'
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = 'rute_stops'
          AND c.name = 'nalog_uid';
        IF @sql <> '' EXEC sp_executesql @sql;
    """)
    
    op.drop_table("nalozi_details")
    op.drop_table("nalozi_header")
    op.drop_table("partneri")

    # -------------------------------------------------------------------------
    # 2. Kreirati tablicu vrste_isporuke
    # -------------------------------------------------------------------------
    op.create_table(
        "vrste_isporuke",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vrsta_isporuke", sa.String(50), nullable=False, unique=True),
        sa.Column("opis", sa.String(255), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    # Umetnuti početne vrijednosti
    op.execute("""
        INSERT INTO vrste_isporuke (vrsta_isporuke, opis, aktivan) VALUES
        ('B2BD', 'B2B dostava', 1),
        ('B2BD-SLO', 'B2B dostava Slovenija', 1),
        ('VDK', 'Vlastita dostava Hrvatska', 1),
        ('VDK-SLO', 'Vlastita dostava Slovenija', 1);
    """)

    # -------------------------------------------------------------------------
    # 3. Kreirati proširenu tablicu partneri
    # -------------------------------------------------------------------------
    op.create_table(
        "partneri",
        sa.Column("partner_uid", sa.String(50), primary_key=True),
        sa.Column("partner", sa.String(50), nullable=True),  # sifra
        sa.Column("b2b_partner", sa.String(50), nullable=True),
        sa.Column("naziv", sa.String(255), nullable=True),
        sa.Column("ime", sa.String(100), nullable=True),
        sa.Column("prezime", sa.String(100), nullable=True),
        sa.Column("enabled", sa.String(1), nullable=True),
        sa.Column("tip_komitenta", sa.String(10), nullable=True),
        sa.Column("mobitel", sa.String(50), nullable=True),
        sa.Column("adresa", sa.String(255), nullable=True),
        sa.Column("maticni_broj", sa.String(50), nullable=True),
        sa.Column("oib", sa.String(20), nullable=True),
        sa.Column("pdv_broj", sa.String(50), nullable=True),
        sa.Column("ziro_racun", sa.String(50), nullable=True),
        sa.Column("telefon", sa.String(50), nullable=True),
        sa.Column("telefax", sa.String(50), nullable=True),
        sa.Column("mjesto_uid", sa.String(50), nullable=True),
        sa.Column("mjesto", sa.String(50), nullable=True),
        sa.Column("naziv_mjesta", sa.String(100), nullable=True),
        sa.Column("postanski_broj", sa.String(20), nullable=True),
        sa.Column("b2b_mjesto", sa.String(50), nullable=True),
        sa.Column("drzava_uid", sa.String(50), nullable=True),
        sa.Column("drzava", sa.String(10), nullable=True),
        sa.Column("naziv_drzave", sa.String(100), nullable=True),
        sa.Column("b2b_drzava", sa.String(50), nullable=True),
        sa.Column("valuta", sa.String(10), nullable=True),
        sa.Column("b2b_valuta", sa.String(50), nullable=True),
        sa.Column("rabat", sa.Numeric(18, 2), nullable=True),
        sa.Column("limit_iznos", sa.Numeric(18, 2), nullable=True),
        sa.Column("limit_dana", sa.Integer(), nullable=True),
        sa.Column("odgoda_placanja", sa.Integer(), nullable=True),
        sa.Column("iznos_zaduznice", sa.Numeric(18, 2), nullable=True),
        sa.Column("blokiran", sa.String(1), nullable=True),
        sa.Column("kontakt_osoba", sa.String(255), nullable=True),
        sa.Column("ugovor", sa.String(100), nullable=True),
        sa.Column("banka", sa.String(100), nullable=True),
        sa.Column("swift", sa.String(50), nullable=True),
        sa.Column("e_mail", sa.String(255), nullable=True),
        sa.Column("url", sa.String(255), nullable=True),
        sa.Column("napomena", sa.Text(), nullable=True),
        sa.Column("upozorenje", sa.Text(), nullable=True),
        sa.Column("gln", sa.String(50), nullable=True),
        sa.Column("placa_porez", sa.String(1), nullable=True),
        sa.Column("cassa_sconto", sa.String(1), nullable=True),
        sa.Column("tip_cijene", sa.String(10), nullable=True),
        sa.Column("tip_racuna", sa.String(10), nullable=True),
        sa.Column("datum_rodenja", sa.Date(), nullable=True),
        sa.Column("spol", sa.String(1), nullable=True),
        sa.Column("placa_isporuku", sa.String(1), nullable=True),
        sa.Column("broj_osigurane_osobe", sa.String(50), nullable=True),
        sa.Column("export_cjenika", sa.String(1), nullable=True),
        sa.Column("grupacija_uid", sa.String(50), nullable=True),
        sa.Column("grupacija", sa.String(50), nullable=True),
        sa.Column("naziv_grupacije", sa.String(255), nullable=True),
        sa.Column("parent__partner_uid", sa.String(50), nullable=True),
        sa.Column("parent__partner", sa.String(50), nullable=True),
        sa.Column("parent__partner_b2b", sa.String(50), nullable=True),
        sa.Column("komercijalista_uid", sa.String(50), nullable=True),
        sa.Column("komercijalista", sa.String(50), nullable=True),
        sa.Column("ime_komercijaliste", sa.String(255), nullable=True),
        sa.Column("kam_uid", sa.String(50), nullable=True),
        sa.Column("kam", sa.String(50), nullable=True),
        sa.Column("ime_kam", sa.String(255), nullable=True),
        sa.Column("grupa_partnera_uid", sa.String(50), nullable=True),
        sa.Column("grupa_partnera", sa.String(50), nullable=True),
        sa.Column("naziv_grupe_partnera", sa.String(255), nullable=True),
        sa.Column("agent_uid", sa.String(50), nullable=True),
        sa.Column("agent", sa.String(50), nullable=True),
        sa.Column("naziv_agenta", sa.String(255), nullable=True),
        sa.Column("vrsta_isporuke_uid", sa.String(50), nullable=True),
        sa.Column("vrsta_isporuke", sa.String(50), nullable=True),
        sa.Column("naziv_vrste_isporuke", sa.String(255), nullable=True),
        sa.Column("grupa_mjesta_uid", sa.String(50), nullable=True),
        sa.Column("grupa_mjesta", sa.String(50), nullable=True),
        sa.Column("naziv_grupe_mjesta", sa.String(255), nullable=True),
        sa.Column("nivo_partnera_uid", sa.String(50), nullable=True),
        sa.Column("nivo_partnera", sa.String(50), nullable=True),
        sa.Column("naziv_nivoa_partnera", sa.String(255), nullable=True),
        sa.Column("suradnik_uid", sa.String(50), nullable=True),
        sa.Column("suradnik", sa.String(50), nullable=True),
        sa.Column("naziv_suradnika", sa.String(255), nullable=True),
        sa.Column("odakle_uid", sa.String(50), nullable=True),
        sa.Column("odakle", sa.String(50), nullable=True),
        sa.Column("odakle_naziv", sa.String(255), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )
    
    # Index na partner (šifra) za brže pretraživanje
    op.create_index("ix_partneri_partner", "partneri", ["partner"])

    # -------------------------------------------------------------------------
    # 4. Kreirati proširenu tablicu nalozi_header
    # -------------------------------------------------------------------------
    op.create_table(
        "nalozi_header",
        sa.Column("nalog_prodaje_uid", sa.String(50), primary_key=True),
        sa.Column("nalog_prodaje_b2b", sa.String(50), nullable=True),
        sa.Column("broj", sa.Integer(), nullable=True),
        sa.Column("datum", sa.Date(), nullable=True),
        sa.Column("rezervacija_od_datuma", sa.DateTime(), nullable=True),
        sa.Column("rezervacija_do_datuma", sa.Date(), nullable=True),
        sa.Column("raspored", sa.Date(), nullable=True),  # datum isporuke
        sa.Column("skladiste", sa.String(50), nullable=True),
        sa.Column("skladiste_b2b", sa.String(50), nullable=True),
        sa.Column("na__skladiste", sa.String(50), nullable=True),
        sa.Column("na__skladiste_b2b", sa.String(50), nullable=True),
        sa.Column("partner_uid", sa.String(50), sa.ForeignKey("partneri.partner_uid"), nullable=True),
        sa.Column("partner", sa.String(50), nullable=True),
        sa.Column("partner_b2b", sa.String(50), nullable=True),
        sa.Column("korisnik__partner_uid", sa.String(50), nullable=True),
        sa.Column("korisnik__partner", sa.String(50), nullable=True),
        sa.Column("korisnik__partner_b2b", sa.String(50), nullable=True),
        sa.Column("agent__partner_uid", sa.String(50), nullable=True),
        sa.Column("agent__partner", sa.String(50), nullable=True),
        sa.Column("agent__partner_b2b", sa.String(50), nullable=True),
        sa.Column("narudzba", sa.String(100), nullable=True),
        sa.Column("kupac_placa_isporuku", sa.String(1), nullable=True),
        sa.Column("valuta", sa.String(10), nullable=True),
        sa.Column("valuta_b2b", sa.String(50), nullable=True),
        sa.Column("tecaj", sa.Numeric(18, 6), nullable=True),
        sa.Column("generalni_rabat", sa.String(50), nullable=True),
        sa.Column("placa_porez", sa.String(1), nullable=True),
        sa.Column("cassa_sconto", sa.String(1), nullable=True),
        sa.Column("poruka_gore", sa.Text(), nullable=True),
        sa.Column("poruka_dolje", sa.Text(), nullable=True),
        sa.Column("napomena", sa.Text(), nullable=True),
        sa.Column("na_uvid", sa.String(50), nullable=True),
        sa.Column("referenca_isporuke", sa.String(100), nullable=True),
        sa.Column("sa__skladiste", sa.String(50), nullable=True),
        sa.Column("sa__skladiste_b2b", sa.String(50), nullable=True),
        sa.Column("skl_dokument", sa.String(10), nullable=True),
        sa.Column("skl_dokument_b2b", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("status_b2b", sa.String(50), nullable=True),
        sa.Column("komercijalist__radnik", sa.String(100), nullable=True),
        sa.Column("komercijalist__radnik_b2b", sa.String(50), nullable=True),
        sa.Column("dostavljac_uid", sa.String(50), nullable=True),
        sa.Column("dostavljac__radnik", sa.String(100), nullable=True),
        sa.Column("dostavljac__radnik_b2b", sa.String(50), nullable=True),
        sa.Column("kreirao__radnik_uid", sa.String(50), nullable=True),
        sa.Column("kreirao__radnik", sa.String(100), nullable=True),
        sa.Column("kreirao__radnik_ime", sa.String(255), nullable=True),
        sa.Column("vrsta_isporuke", sa.String(50), nullable=True),
        sa.Column("vrsta_isporuke_b2b", sa.String(50), nullable=True),
        sa.Column("izravna_dostava", sa.String(1), nullable=True),
        sa.Column("dropoff_sifra", sa.String(50), nullable=True),
        sa.Column("dropoff_naziv", sa.String(255), nullable=True),
        sa.Column("user_uid", sa.String(50), nullable=True),
        sa.Column("username", sa.String(100), nullable=True),
        sa.Column("user_b2b", sa.String(50), nullable=True),
        sa.Column("tip_racuna_uid", sa.String(50), nullable=True),
        sa.Column("tip_racuna", sa.String(20), nullable=True),
        sa.Column("tip_racuna_b2b", sa.String(50), nullable=True),
        sa.Column("predmet_uid", sa.String(50), nullable=True),
        sa.Column("predmet", sa.String(50), nullable=True),
        sa.Column("predmet_b2b", sa.String(50), nullable=True),
        sa.Column("za_naplatu", sa.Numeric(18, 2), nullable=True),
        sa.Column("zki", sa.String(100), nullable=True),
        sa.Column("jir", sa.String(100), nullable=True),
        # Interna polja koja mi računamo
        sa.Column("regija_id", sa.Integer(), sa.ForeignKey("regije.id"), nullable=True),
        sa.Column("vozilo_tip", sa.String(50), nullable=True),
        sa.Column("total_weight", sa.Numeric(18, 3), nullable=True),
        sa.Column("total_volume", sa.Numeric(18, 6), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    # Indexi za brže pretraživanje
    op.create_index("ix_nalozi_header_datum", "nalozi_header", ["datum"])
    op.create_index("ix_nalozi_header_raspored", "nalozi_header", ["raspored"])
    op.create_index("ix_nalozi_header_status", "nalozi_header", ["status"])
    op.create_index("ix_nalozi_header_vrsta_isporuke", "nalozi_header", ["vrsta_isporuke"])
    op.create_index("ix_nalozi_header_partner_uid", "nalozi_header", ["partner_uid"])

    # -------------------------------------------------------------------------
    # 5. Kreirati proširenu tablicu nalozi_details
    # -------------------------------------------------------------------------
    op.create_table(
        "nalozi_details",
        sa.Column("stavka_uid", sa.String(50), primary_key=True),
        sa.Column("nalog_prodaje_uid", sa.String(50), sa.ForeignKey("nalozi_header.nalog_prodaje_uid"), nullable=False),
        sa.Column("artikl", sa.String(50), nullable=True),
        sa.Column("artikl_uid", sa.String(50), sa.ForeignKey("artikli.artikl_uid"), nullable=True),
        sa.Column("artikl_b2b", sa.String(50), nullable=True),
        sa.Column("mjesto_troska", sa.String(50), nullable=True),
        sa.Column("mjesto_troska_uid", sa.String(50), nullable=True),
        sa.Column("mjesto_troska_b2b", sa.String(50), nullable=True),
        sa.Column("predmet", sa.String(50), nullable=True),
        sa.Column("predmet_uid", sa.String(50), nullable=True),
        sa.Column("predmet_b2b", sa.String(50), nullable=True),
        sa.Column("opis", sa.Text(), nullable=True),
        sa.Column("kolicina", sa.Numeric(18, 3), nullable=True),
        sa.Column("pakiranja", sa.Numeric(18, 3), nullable=True),
        sa.Column("cijena", sa.Numeric(18, 2), nullable=True),
        sa.Column("detaljni_opis", sa.String(1), nullable=True),
        sa.Column("specifikacija", sa.Text(), nullable=True),
        sa.Column("rabat", sa.Numeric(18, 2), nullable=True),
        sa.Column("dodatni_rabat", sa.String(50), nullable=True),
        sa.Column("redoslijed", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    # Index za brže dohvaćanje stavki po nalogu
    op.create_index("ix_nalozi_details_nalog_prodaje_uid", "nalozi_details", ["nalog_prodaje_uid"])

    # -------------------------------------------------------------------------
    # 6. Ponovno kreirati FK na rute_stops
    # -------------------------------------------------------------------------
    op.execute("""
        ALTER TABLE rute_stops 
        ADD CONSTRAINT FK_rute_stops_nalog_prodaje_uid 
        FOREIGN KEY (nalog_uid) REFERENCES nalozi_header(nalog_prodaje_uid);
    """)


def downgrade() -> None:
    # Kompleksni downgrade - vraćanje na staru strukturu
    # Za sada samo dropamo nove tablice
    op.execute("""
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql = @sql + 'ALTER TABLE rute_stops DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
        FROM sys.foreign_keys fk
        WHERE OBJECT_NAME(fk.parent_object_id) = 'rute_stops';
        EXEC sp_executesql @sql;
    """)
    
    op.drop_table("nalozi_details")
    op.drop_table("nalozi_header")
    op.drop_table("partneri")
    op.drop_table("vrste_isporuke")
    
    # Ovdje bi trebalo recreirati stare tablice, ali za sada nije potrebno
