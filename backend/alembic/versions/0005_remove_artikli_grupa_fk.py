"""Remove FK from artikli.grupa_artikla_uid to grupe_artikala

Revision ID: 0005_remove_artikli_grupa_fk
Revises: 0004_artikli_i_grupe
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


revision = "0005_remove_artikli_grupa_fk"
down_revision = "0004_artikli_i_grupe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Dinamički ukloni sve FK-ove iz artikli prema grupe_artikala
    op.execute(
        """
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql = @sql + 'ALTER TABLE artikli DROP CONSTRAINT [' + fk.name + '];'
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = 'artikli'
          AND OBJECT_NAME(fk.referenced_object_id) = 'grupe_artikala'
          AND c.name = 'grupa_artikla_uid';
        IF @sql <> '' EXEC sp_executesql @sql;
        """
    )


def downgrade() -> None:
    # Ne pokušavamo automatski ponovno kreirati FK jer bi mogli postojati "siročad" redovi.
    pass

