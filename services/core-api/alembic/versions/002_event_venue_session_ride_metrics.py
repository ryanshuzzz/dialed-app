"""Event venue, ride_location, nullable track_id; session ride_metrics

Revision ID: 002
Revises: 001
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("venue", sa.String(10), server_default="track", nullable=False),
        schema="core",
    )
    op.add_column(
        "events",
        sa.Column("ride_location", postgresql.JSONB(), nullable=True),
        schema="core",
    )
    op.alter_column(
        "events",
        "track_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
        schema="core",
    )
    op.add_column(
        "sessions",
        sa.Column("ride_metrics", postgresql.JSONB(), nullable=True),
        schema="core",
    )


def downgrade() -> None:
    op.drop_column("sessions", "ride_metrics", schema="core")
    op.alter_column(
        "events",
        "track_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
        schema="core",
    )
    op.drop_column("events", "ride_location", schema="core")
    op.drop_column("events", "venue", schema="core")
