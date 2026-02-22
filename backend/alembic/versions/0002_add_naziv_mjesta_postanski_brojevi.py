"""Add naziv_mjesta to postanski_brojevi, unique (postanski_broj, naziv_mjesta)

Revision ID: 0002_naziv_mjesta
Revises: 0001_initial
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa

revision = "0002_naziv_mjesta"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Dodaj kolonu naziv_mjesta (nullable za postojeće retke)
    op.add_column(
        "postanski_brojevi",
        sa.Column("naziv_mjesta", sa.String(100), nullable=True),
    )

    # Postavi prazan string za postojeće retke
    op.execute(
        "UPDATE postanski_brojevi SET naziv_mjesta = N'' WHERE naziv_mjesta IS NULL"
    )
    op.alter_column(
        "postanski_brojevi",
        "naziv_mjesta",
        existing_type=sa.String(100),
        nullable=False,
        server_default=sa.text("N''"),
    )

    # Ukloni staru unique ograničenje na postanski_broj (SQL Server: pronađi ime i obriši)
    op.execute("""
        DECLARE @uq SYSNAME;
        SELECT @uq = kc.name
        FROM sys.key_constraints kc
        INNER JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE kc.parent_object_id = OBJECT_ID('postanski_brojevi') AND kc.type = 'UQ'
        AND c.name = 'postanski_broj';
        IF @uq IS NOT NULL
            EXEC('ALTER TABLE postanski_brojevi DROP CONSTRAINT [' + @uq + ']');
    """)

    # Dodaj unique na (postanski_broj, naziv_mjesta)
    op.create_unique_constraint(
        "uq_postanski_brojevi_broj_mjesto",
        "postanski_brojevi",
        ["postanski_broj", "naziv_mjesta"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_postanski_brojevi_broj_mjesto",
        "postanski_brojevi",
        type_="unique",
    )
    op.drop_column("postanski_brojevi", "naziv_mjesta")
    # Napomena: ako postoje duplikati postanski_broj (različita mjesta), unique constraint neće proći
    op.create_unique_constraint(
        "uq_postanski_brojevi_postanski_broj",
        "postanski_brojevi",
        ["postanski_broj"],
    )
