"""Lap segment model — computed lap boundaries within a session."""

from sqlalchemy import Column, DateTime, Double, Integer, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class LapSegment(Base):
    __tablename__ = "lap_segments"
    __table_args__ = (
        UniqueConstraint("session_id", "lap_number", name="uq_lap_segments_session_lap"),
        {"schema": "telemetry"},
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    session_id = Column(UUID(as_uuid=True), nullable=False)
    lap_number = Column(Integer, nullable=False)
    start_time_ms = Column(Integer, nullable=False)
    end_time_ms = Column(Integer, nullable=False)
    lap_time_ms = Column(Integer, nullable=False)
    beacon_start_s = Column(Double, nullable=True)
    beacon_end_s = Column(Double, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
