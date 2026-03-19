import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_user_bike_track", "user_id", "bike_id", "track_id"),
        Index("ix_events_date", "date"),
        {"schema": "core"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    bike_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.bikes.id", ondelete="CASCADE"),
        nullable=False,
    )
    track_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.tracks.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[str] = mapped_column(Date, nullable=False)
    conditions: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    bike = relationship("Bike", back_populates="events")
    track = relationship("Track", back_populates="events")
    sessions = relationship("Session", back_populates="event")
