import uuid

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    __table_args__ = (
        Index("ix_maintenance_logs_bike_performed", "bike_id", "performed_at"),
        Index("ix_maintenance_logs_user", "user_id"),
        Index("ix_maintenance_logs_bike_category", "bike_id", "category"),
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
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mileage_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engine_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(
        String(3), nullable=True, server_default="USD"
    )
    performed_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    performed_at: Mapped[str] = mapped_column(Date, nullable=False)
    next_due_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_due_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    bike = relationship("Bike", back_populates="maintenance_logs")
