"""Initial core schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS core")

    # ── users ──
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("skill_level", sa.String(20), server_default="novice", nullable=False),
        sa.Column("rider_type", sa.String(20), server_default="street", nullable=False),
        sa.Column("units", sa.String(10), server_default="metric", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        schema="core",
    )

    # ── auth_tokens ──
    op.create_table(
        "auth_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(256), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"], schema="core")

    # ── user_api_keys ──
    op.create_table(
        "user_api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_hash", sa.String(256), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "name", name="uq_user_api_keys_user_name"),
        schema="core",
    )
    op.create_index("ix_user_api_keys_user_id", "user_api_keys", ["user_id"], schema="core")

    # ── bikes ──
    op.create_table(
        "bikes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("make", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("vin", sa.String(17), nullable=True),
        sa.Column("color", sa.String(50), nullable=True),
        sa.Column("mileage_km", sa.Integer(), nullable=True),
        sa.Column("engine_hours", sa.Float(), nullable=True),
        sa.Column("exhaust", sa.Text(), nullable=True),
        sa.Column("ecu", sa.Text(), nullable=True),
        sa.Column("gearing_front", sa.Integer(), nullable=True),
        sa.Column("gearing_rear", sa.Integer(), nullable=True),
        sa.Column("suspension_spec", postgresql.JSONB(), server_default=sa.text("'{\"schema_version\": 1}'::jsonb"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="owned", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index(
        "ix_bikes_user_id_active",
        "bikes",
        ["user_id"],
        schema="core",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ── tracks ──
    op.create_table(
        "tracks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("config", sa.String(100), nullable=True),
        sa.Column("surface_notes", sa.Text(), nullable=True),
        sa.Column("gps_bounds", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    # ── events ──
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bike_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("conditions", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bike_id"], ["core.bikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["core.tracks.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_events_user_bike_track", "events", ["user_id", "bike_id", "track_id"], schema="core")
    op.create_index("ix_events_date", "events", ["date"], schema="core")

    # ── sessions ──
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_type", sa.String(20), nullable=False),
        sa.Column("manual_best_lap_ms", sa.Integer(), nullable=True),
        sa.Column("csv_best_lap_ms", sa.Integer(), nullable=True),
        sa.Column("tire_front", postgresql.JSONB(), nullable=True),
        sa.Column("tire_rear", postgresql.JSONB(), nullable=True),
        sa.Column("rider_feedback", sa.Text(), nullable=True),
        sa.Column("voice_note_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["core.events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_sessions_event", "sessions", ["event_id"], schema="core")
    op.create_index("ix_sessions_user", "sessions", ["user_id"], schema="core")

    # ── maintenance_logs ──
    op.create_table(
        "maintenance_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bike_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mileage_km", sa.Integer(), nullable=True),
        sa.Column("engine_hours", sa.Float(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=True),
        sa.Column("performed_by", sa.String(200), nullable=True),
        sa.Column("performed_at", sa.Date(), nullable=False),
        sa.Column("next_due_km", sa.Integer(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("receipt_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bike_id"], ["core.bikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_maintenance_logs_bike_performed", "maintenance_logs", ["bike_id", "performed_at"], schema="core")
    op.create_index("ix_maintenance_logs_user", "maintenance_logs", ["user_id"], schema="core")
    op.create_index("ix_maintenance_logs_bike_category", "maintenance_logs", ["bike_id", "category"], schema="core")

    # ── tire_pressure_logs ──
    op.create_table(
        "tire_pressure_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bike_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("front_psi", sa.Float(), nullable=True),
        sa.Column("rear_psi", sa.Float(), nullable=True),
        sa.Column("front_temp_c", sa.Float(), nullable=True),
        sa.Column("rear_temp_c", sa.Float(), nullable=True),
        sa.Column("context", sa.String(20), server_default="pre_ride", nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bike_id"], ["core.bikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["core.sessions.id"], ondelete="SET NULL"),
        schema="core",
    )
    op.create_index("ix_tire_pressure_logs_bike_recorded", "tire_pressure_logs", ["bike_id", "recorded_at"], schema="core")
    op.create_index("ix_tire_pressure_logs_user_id", "tire_pressure_logs", ["user_id"], schema="core")

    # ── modifications ──
    op.create_table(
        "modifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bike_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("part_name", sa.String(300), nullable=False),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("part_number", sa.String(100), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=True),
        sa.Column("installed_at", sa.Date(), nullable=False),
        sa.Column("removed_at", sa.Date(), nullable=True),
        sa.Column("mileage_km", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bike_id"], ["core.bikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_modifications_bike_installed", "modifications", ["bike_id", "installed_at"], schema="core")
    op.create_index("ix_modifications_bike_category", "modifications", ["bike_id", "category"], schema="core")
    op.create_index("ix_modifications_user_id", "modifications", ["user_id"], schema="core")

    # ── ownership_history ──
    op.create_table(
        "ownership_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bike_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=True),
        sa.Column("mileage_km", sa.Integer(), nullable=True),
        sa.Column("counterparty", sa.String(300), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bike_id"], ["core.bikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_ownership_history_bike_date", "ownership_history", ["bike_id", "date"], schema="core")
    op.create_index("ix_ownership_history_user_id", "ownership_history", ["user_id"], schema="core")

    # ── setup_snapshots ──
    op.create_table(
        "setup_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("settings", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["core.sessions.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_setup_snapshots_session_id", "setup_snapshots", ["session_id"], schema="core")

    # ── change_log ──
    op.create_table(
        "change_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parameter", sa.String(100), nullable=False),
        sa.Column("from_value", sa.String(200), nullable=True),
        sa.Column("to_value", sa.String(200), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["core.sessions.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_change_log_session_id", "change_log", ["session_id"], schema="core")

    # ── efficacy_stats ──
    op.create_table(
        "efficacy_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("suggestion_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lap_delta_ms", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        schema="core",
    )
    op.create_index("ix_efficacy_stats_user_id", "efficacy_stats", ["user_id"], schema="core")
    op.create_index("ix_efficacy_stats_suggestion_id", "efficacy_stats", ["suggestion_id"], schema="core")

    # ── channel_aliases ──
    op.create_table(
        "channel_aliases",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("raw_name", sa.String(200), nullable=False),
        sa.Column("canonical_name", sa.String(200), nullable=False),
        sa.Column("logger_model", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("raw_name", "logger_model", name="uq_channel_aliases_raw_logger"),
        schema="core",
    )

    # ── updated_at trigger function ──
    op.execute("""
        CREATE OR REPLACE FUNCTION core.set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table in [
        "users", "bikes", "maintenance_logs", "modifications", "sessions", "events", "tracks",
    ]:
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON core.{table}
            FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
        """)


def downgrade() -> None:
    for table in [
        "users", "bikes", "maintenance_logs", "modifications", "sessions", "events", "tracks",
    ]:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON core.{table}")
    op.execute("DROP FUNCTION IF EXISTS core.set_updated_at()")

    for table in [
        "channel_aliases",
        "efficacy_stats",
        "change_log",
        "setup_snapshots",
        "ownership_history",
        "modifications",
        "tire_pressure_logs",
        "maintenance_logs",
        "sessions",
        "events",
        "tracks",
        "bikes",
        "user_api_keys",
        "auth_tokens",
        "users",
    ]:
        op.drop_table(table, schema="core")
