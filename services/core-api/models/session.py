import uuid

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_sessions_event", "event_id"),
        Index("ix_sessions_user", "user_id"),
        {"schema": "core"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.events.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_type: Mapped[str] = mapped_column(String(20), nullable=False)
    manual_best_lap_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    csv_best_lap_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tire_front: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tire_rear: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rider_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_note_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ride_metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    event = relationship("Event", back_populates="sessions")
    setup_snapshots = relationship("SetupSnapshot", back_populates="session")
    change_log_entries = relationship("ChangeLog", back_populates="session")
    tire_pressure_logs = relationship("TirePressureLog", back_populates="session")
