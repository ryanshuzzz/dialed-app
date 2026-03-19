"""Initial telemetry tables: lap_segments, ingestion_jobs (regular Postgres only).

telemetry_points is a TimescaleDB hypertable and is created separately at startup
via ensure_timescale_schema() in main.py against TIMESCALE_URL.

Revision ID: 001
Revises: None
Create Date: 2026-03-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS telemetry")

    # -- Enums (use raw SQL for IF NOT EXISTS) --
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE telemetry.ingestion_source AS ENUM ('csv', 'ocr', 'voice'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE telemetry.ingestion_status AS ENUM ('pending', 'processing', 'complete', 'failed'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )

    # NOTE: telemetry_points is NOT created here.
    # It lives on TimescaleDB (TIMESCALE_URL) and is provisioned at startup.

    # -- lap_segments --
    op.create_table(
        "lap_segments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lap_number", sa.Integer, nullable=False),
        sa.Column("start_time_ms", sa.Integer, nullable=False),
        sa.Column("end_time_ms", sa.Integer, nullable=False),
        sa.Column("lap_time_ms", sa.Integer, nullable=False),
        sa.Column("beacon_start_s", sa.Double, nullable=True),
        sa.Column("beacon_end_s", sa.Double, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("session_id", "lap_number", name="uq_lap_segments_session_lap"),
        schema="telemetry",
    )

    # -- ingestion_jobs (use raw SQL column types to avoid double-create of enums) --
    op.execute("""
        CREATE TABLE telemetry.ingestion_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL,
            source telemetry.ingestion_source NOT NULL,
            status telemetry.ingestion_status NOT NULL DEFAULT 'pending',
            result JSONB,
            error_message VARCHAR,
            confidence DOUBLE PRECISION,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at TIMESTAMPTZ
        )
    """)


def downgrade() -> None:
    op.drop_table("ingestion_jobs", schema="telemetry")
    op.drop_table("lap_segments", schema="telemetry")

    op.execute("DROP TYPE IF EXISTS telemetry.ingestion_status")
    op.execute("DROP TYPE IF EXISTS telemetry.ingestion_source")
