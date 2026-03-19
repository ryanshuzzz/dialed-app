"""TimescaleDB hypertable model for 20Hz telemetry samples."""

from sqlalchemy import Column, DateTime, Double, Index, SmallInteger, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"
    __table_args__ = (
        Index("ix_telemetry_points_session_time", "session_id", "time"),
        {"schema": "telemetry"},
    )

    # TimescaleDB hypertable partition key — no UUID primary key
    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    session_id = Column(UUID(as_uuid=True), nullable=False, primary_key=True)

    # 13 core channel columns
    gps_speed = Column(Double, nullable=True)
    throttle_pos = Column(Double, nullable=True)
    rpm = Column(Double, nullable=True)
    gear = Column(SmallInteger, nullable=True)
    lean_angle = Column(Double, nullable=True)
    front_brake_psi = Column(Double, nullable=True)
    rear_brake_psi = Column(Double, nullable=True)
    fork_position = Column(Double, nullable=True)
    shock_position = Column(Double, nullable=True)
    coolant_temp = Column(Double, nullable=True)
    oil_temp = Column(Double, nullable=True)
    lat = Column(Double, nullable=True)
    lon = Column(Double, nullable=True)

    # JSONB overflow for non-core channels
    extra_channels = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
