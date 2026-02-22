"""Povećaj duljinu kolone glavni_dobavljac_artikl na 255

Revision ID: 0006_extend_glavni_dobavljac_artikl
Revises: 0005_remove_artikli_grupa_fk
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


revision = "0006_glavni_dobavljac_artikl"
down_revision = "0005_remove_artikli_grupa_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "artikli",
        "glavni_dobavljac_artikl",
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "artikli",
        "glavni_dobavljac_artikl",
        existing_type=sa.String(length=255),
        type_=sa.String(length=50),
        existing_nullable=True,
    )

