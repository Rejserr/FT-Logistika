"""Add full artikli and grupe_artikala tables

Revision ID: 0004_artikli_i_grupe
Revises: 0003_expand_erp_tables
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


revision = "0004_artikli_i_grupe"
down_revision = "0003_expand_erp_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    utcnow = sa.text("GETUTCDATE()")

    # Drop FK iz nalozi_details na staru artikli tablicu
    op.execute(
        """
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql = @sql + 'ALTER TABLE nalozi_details DROP CONSTRAINT [' + fk.name + '];'
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns c ON fkc.referenced_column_id = c.column_id AND fkc.referenced_object_id = c.object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = 'nalozi_details'
          AND OBJECT_NAME(fk.referenced_object_id) = 'artikli'
          AND c.name = 'artikl_uid';
        IF @sql <> '' EXEC sp_executesql @sql;
        """
    )

    # Drop stara artikli tablica (jednostavnija verzija)
    op.drop_table("artikli")

    # Grupe artikala
    op.create_table(
        "grupe_artikala",
        sa.Column("grupa_artikla_uid", sa.String(50), primary_key=True),
        sa.Column("grupa_artikla", sa.String(50), nullable=False, unique=True),
        sa.Column("grupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column("nadgrupa_artikla", sa.String(50), nullable=True),
        sa.Column("nadgrupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column("supergrupa_artikla", sa.String(50), nullable=True),
        sa.Column("supergrupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    # Artikli – puna ERP struktura
    op.create_table(
        "artikli",
        sa.Column("artikl_uid", sa.String(50), primary_key=True),
        sa.Column("artikl_b2b", sa.String(50), nullable=True),
        sa.Column("artikl", sa.String(50), nullable=False),
        sa.Column("naziv", sa.String(500), nullable=True),
        sa.Column("barcode", sa.String(100), nullable=True),
        sa.Column("jm", sa.String(20), nullable=True),
        sa.Column("vpc", sa.Numeric(18, 6), nullable=True),
        sa.Column("mpc", sa.Numeric(18, 6), nullable=True),
        sa.Column("duzina", sa.Numeric(18, 6), nullable=True),
        sa.Column("sirina", sa.Numeric(18, 6), nullable=True),
        sa.Column("visina", sa.Numeric(18, 6), nullable=True),
        sa.Column("masa", sa.Numeric(18, 6), nullable=True),
        sa.Column("volumen", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje", sa.String(50), nullable=True),
        sa.Column("pakiranje_jm", sa.String(20), nullable=True),
        sa.Column("pakiranje_masa", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_barcode", sa.String(100), nullable=True),
        sa.Column("pakiranje_trans", sa.String(50), nullable=True),
        sa.Column("pakiranje_trans_jm", sa.String(20), nullable=True),
        sa.Column("pakiranje_trans_masa", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_trans_barcode", sa.String(100), nullable=True),
        sa.Column("pakiranje_trans_duzina", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_trans_sirina", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_trans_visina", sa.Numeric(18, 6), nullable=True),
        sa.Column("naziv_kratki", sa.String(255), nullable=True),
        sa.Column("supergrupa_artikla", sa.String(50), nullable=True),
        sa.Column("supergrupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column("nadgrupa_artikla", sa.String(50), nullable=True),
        sa.Column("nadgrupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column(
            "grupa_artikla_uid",
            sa.String(50),
            sa.ForeignKey("grupe_artikala.grupa_artikla_uid"),
            nullable=True,
        ),
        sa.Column("grupa_artikla", sa.String(50), nullable=True),
        sa.Column("grupa_artikla_naziv", sa.String(255), nullable=True),
        sa.Column("masa_netto", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_duzina", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_visina", sa.Numeric(18, 6), nullable=True),
        sa.Column("pakiranje_sirina", sa.Numeric(18, 6), nullable=True),
        sa.Column("paleta_kolicina", sa.Integer(), nullable=True),
        sa.Column("proizvodac_uid", sa.String(50), nullable=True),
        sa.Column("proizvodac", sa.String(50), nullable=True),
        sa.Column("proizvodac_naziv", sa.String(255), nullable=True),
        sa.Column("glavni_dobavljac", sa.String(50), nullable=True),
        sa.Column("glavni_dobavljac_artikl", sa.String(50), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=utcnow),
        sa.Column("updated_at", sa.DateTime(), server_default=utcnow),
    )

    op.create_index("ix_artikli_grupa_artikla_uid", "artikli", ["grupa_artikla_uid"])


def downgrade() -> None:
    op.drop_index("ix_artikli_grupa_artikla_uid", table_name="artikli")
    op.drop_table("artikli")
    op.drop_table("grupe_artikala")

