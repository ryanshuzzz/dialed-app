import uuid

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class TirePressureLog(Base):
    __tablename__ = "tire_pressure_logs"
    __table_args__ = (
        Index("ix_tire_pressure_logs_bike_recorded", "bike_id", "recorded_at"),
        {"schema": "core"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    bike_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.bikes.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    front_psi: Mapped[float | None] = mapped_column(Float, nullable=True)
    rear_psi: Mapped[float | None] = mapped_column(Float, nullable=True)
    front_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    rear_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    context: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pre_ride"
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    bike = relationship("Bike", back_populates="tire_pressure_logs")
    session = relationship("Session", back_populates="tire_pressure_logs")
