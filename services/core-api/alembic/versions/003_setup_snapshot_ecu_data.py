"""Add ecu_data JSONB column to setup_snapshots

Revision ID: 003
Revises: 002
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "setup_snapshots",
        sa.Column("ecu_data", postgresql.JSONB(), nullable=True),
        schema="core",
    )


def downgrade() -> None:
    op.drop_column("setup_snapshots", "ecu_data", schema="core")
