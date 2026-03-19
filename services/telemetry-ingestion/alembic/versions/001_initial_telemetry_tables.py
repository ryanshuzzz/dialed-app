"""Initial telemetry tables: telemetry_points, lap_segments, ingestion_jobs.

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

    # -- Enums --
    ingestion_source = sa.Enum(
        "csv", "ocr", "voice", name="ingestion_source", schema="telemetry"
    )
    ingestion_source.create(op.get_bind(), checkfirst=True)

    ingestion_status = sa.Enum(
        "pending", "processing", "complete", "failed",
        name="ingestion_status", schema="telemetry",
    )
    ingestion_status.create(op.get_bind(), checkfirst=True)

    # -- telemetry_points (TimescaleDB hypertable) --
    op.create_table(
        "telemetry_points",
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("gps_speed", sa.Double, nullable=True),
        sa.Column("throttle_pos", sa.Double, nullable=True),
        sa.Column("rpm", sa.Double, nullable=True),
        sa.Column("gear", sa.SmallInteger, nullable=True),
        sa.Column("lean_angle", sa.Double, nullable=True),
        sa.Column("front_brake_psi", sa.Double, nullable=True),
        sa.Column("rear_brake_psi", sa.Double, nullable=True),
        sa.Column("fork_position", sa.Double, nullable=True),
        sa.Column("shock_position", sa.Double, nullable=True),
        sa.Column("coolant_temp", sa.Double, nullable=True),
        sa.Column("oil_temp", sa.Double, nullable=True),
        sa.Column("lat", sa.Double, nullable=True),
        sa.Column("lon", sa.Double, nullable=True),
        sa.Column("extra_channels", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.PrimaryKeyConstraint("time", "session_id"),
        schema="telemetry",
    )

    # Convert to TimescaleDB hypertable
    op.execute("SELECT create_hypertable('telemetry.telemetry_points', 'time')")

    # Composite index for session-scoped time-ordered queries
    op.create_index(
        "ix_telemetry_points_session_time",
        "telemetry_points",
        ["session_id", "time"],
        schema="telemetry",
    )

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

    # -- ingestion_jobs --
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("source", ingestion_source, nullable=False),
        sa.Column("status", ingestion_status, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("result", JSONB, nullable=True),
        sa.Column("error_message", sa.String, nullable=True),
        sa.Column("confidence", sa.Double, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        schema="telemetry",
    )


def downgrade() -> None:
    op.drop_table("ingestion_jobs", schema="telemetry")
    op.drop_table("lap_segments", schema="telemetry")
    op.drop_index("ix_telemetry_points_session_time", table_name="telemetry_points", schema="telemetry")
    op.drop_table("telemetry_points", schema="telemetry")

    op.execute("DROP TYPE IF EXISTS telemetry.ingestion_status")
    op.execute("DROP TYPE IF EXISTS telemetry.ingestion_source")
