"""Initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    utcnow = sa.text("GETUTCDATE()")

    op.create_table(
        "settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
    )

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("ime", sa.String(100), nullable=True),
        sa.Column("prezime", sa.String(100), nullable=True),
        sa.Column("email", sa.String(100), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), primary_key=True),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity", sa.String(100), nullable=True),
        sa.Column("entity_id", sa.String(100), nullable=True),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "regije",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("naziv", sa.String(100), nullable=False),
        sa.Column("opis", sa.Text(), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "postanski_brojevi",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("postanski_broj", sa.String(10), nullable=False, unique=True),
        sa.Column("regija_id", sa.Integer(), sa.ForeignKey("regije.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "zone",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("naziv", sa.String(100), nullable=False),
        sa.Column("opis", sa.Text(), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "skladista",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("naziv", sa.String(255), nullable=False),
        sa.Column("adresa", sa.String(255), nullable=True),
        sa.Column("mjesto", sa.String(100), nullable=True),
        sa.Column("postanski_broj", sa.String(20), nullable=True),
        sa.Column("drzava", sa.String(50), nullable=True),
        sa.Column("lat", sa.Numeric(18, 8), nullable=True),
        sa.Column("lng", sa.Numeric(18, 8), nullable=True),
        sa.Column("tip", sa.String(20), nullable=False),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "zone_izvori",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("zona_id", sa.Integer(), sa.ForeignKey("zone.id"), nullable=False),
        sa.Column("izvor_tip", sa.String(20), nullable=False),
        sa.Column("izvor_id", sa.Integer(), nullable=False),
    )

    op.create_table(
        "prioriteti",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("naziv", sa.String(100), nullable=False),
        sa.Column("tezina", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "partneri",
        sa.Column("partner_sifra", sa.String(50), primary_key=True),
        sa.Column("naziv", sa.String(255), nullable=True),
        sa.Column("ime", sa.String(100), nullable=True),
        sa.Column("prezime", sa.String(100), nullable=True),
        sa.Column("adresa", sa.String(255), nullable=True),
        sa.Column("mjesto", sa.String(100), nullable=True),
        sa.Column("drzava", sa.String(50), nullable=True),
        sa.Column("postanski_broj", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "artikli",
        sa.Column("artikl_uid", sa.String(50), primary_key=True),
        sa.Column("artikl", sa.String(50), nullable=True),
        sa.Column("artikl_naziv", sa.String(255), nullable=True),
        sa.Column("grupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column("masa", sa.Numeric(18, 3), nullable=True),
        sa.Column("volumen", sa.Numeric(18, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "vozila_tip",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("naziv", sa.String(100), nullable=False),
        sa.Column("opis", sa.Text(), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "vozila",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("oznaka", sa.String(50), nullable=True),
        sa.Column("naziv", sa.String(100), nullable=True),
        sa.Column("tip_id", sa.Integer(), sa.ForeignKey("vozila_tip.id"), nullable=True),
        sa.Column("nosivost_kg", sa.Numeric(18, 3), nullable=True),
        sa.Column("volumen_m3", sa.Numeric(18, 6), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "vozaci",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ime", sa.String(100), nullable=False),
        sa.Column("prezime", sa.String(100), nullable=False),
        sa.Column("telefon", sa.String(50), nullable=True),
        sa.Column("email", sa.String(100), nullable=True),
        sa.Column("aktivan", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "nalozi_header",
        sa.Column("nalog_uid", sa.String(50), primary_key=True),
        sa.Column("broj", sa.Integer(), nullable=True),
        sa.Column("datum", sa.Date(), nullable=True),
        sa.Column("raspored", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("partner_sifra", sa.String(50), sa.ForeignKey("partneri.partner_sifra"), nullable=True),
        sa.Column("regija_id", sa.Integer(), sa.ForeignKey("regije.id"), nullable=True),
        sa.Column("partner_postanski_broj", sa.String(20), nullable=True),
        sa.Column("prioritet_id", sa.Integer(), sa.ForeignKey("prioriteti.id"), nullable=True),
        sa.Column("time_window_od", sa.Time(), nullable=True),
        sa.Column("time_window_do", sa.Time(), nullable=True),
        sa.Column("izvor_tip", sa.String(20), nullable=True),
        sa.Column("izvor_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "nalozi_details",
        sa.Column("stavka_uid", sa.String(50), primary_key=True),
        sa.Column("nalog_uid", sa.String(50), sa.ForeignKey("nalozi_header.nalog_uid"), nullable=False),
        sa.Column("artikl_uid", sa.String(50), sa.ForeignKey("artikli.artikl_uid"), nullable=True),
        sa.Column("kolicina", sa.Numeric(18, 3), nullable=True),
        sa.Column("cijena", sa.Numeric(18, 2), nullable=True),
        sa.Column("opis", sa.Text(), nullable=True),
    )

    op.create_table(
        "rute",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("datum", sa.Date(), nullable=False),
        sa.Column("status", sa.String(30), nullable=True),
        sa.Column("algoritam", sa.String(50), nullable=True),
        sa.Column("vozilo_id", sa.Integer(), sa.ForeignKey("vozila.id"), nullable=True),
        sa.Column("vozac_id", sa.Integer(), sa.ForeignKey("vozaci.id"), nullable=True),
        sa.Column("izvor_tip", sa.String(20), nullable=True),
        sa.Column("izvor_id", sa.Integer(), nullable=True),
        sa.Column("distance_km", sa.Numeric(18, 3), nullable=True),
        sa.Column("duration_min", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "rute_stops",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ruta_id", sa.Integer(), sa.ForeignKey("rute.id"), nullable=False),
        sa.Column("nalog_uid", sa.String(50), sa.ForeignKey("nalozi_header.nalog_uid"), nullable=False),
        sa.Column("redoslijed", sa.Integer(), nullable=False),
        sa.Column("eta", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(30), nullable=True),
    )

    op.create_table(
        "rute_polylines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ruta_id", sa.Integer(), sa.ForeignKey("rute.id"), nullable=False),
        sa.Column("polyline", sa.Text(), nullable=False),
        sa.Column("distance_km", sa.Numeric(18, 3), nullable=True),
        sa.Column("duration_min", sa.Integer(), nullable=True),
    )

    op.create_table(
        "sync_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("entity", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), server_default=utcnow),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "geocoding_cache",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("address_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("lat", sa.Numeric(18, 8), nullable=True),
        sa.Column("lng", sa.Numeric(18, 8), nullable=True),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_table(
        "distance_matrix_cache",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("origin_hash", sa.String(64), nullable=False),
        sa.Column("dest_hash", sa.String(64), nullable=False),
        sa.Column("distance_m", sa.Integer(), nullable=True),
        sa.Column("duration_s", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )


def downgrade() -> None:
    op.drop_table("distance_matrix_cache")
    op.drop_table("geocoding_cache")
    op.drop_table("sync_log")
    op.drop_table("rute_polylines")
    op.drop_table("rute_stops")
    op.drop_table("rute")
    op.drop_table("nalozi_details")
    op.drop_table("nalozi_header")
    op.drop_table("vozaci")
    op.drop_table("vozila")
    op.drop_table("vozila_tip")
    op.drop_table("artikli")
    op.drop_table("partneri")
    op.drop_table("prioriteti")
    op.drop_table("zone_izvori")
    op.drop_table("skladista")
    op.drop_table("zone")
    op.drop_table("postanski_brojevi")
    op.drop_table("regije")
    op.drop_table("audit_log")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("roles")
    op.drop_table("settings")
