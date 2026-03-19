import uuid

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Bike(Base):
    __tablename__ = "bikes"
    __table_args__ = (
        Index(
            "ix_bikes_user_id_active",
            "user_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
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
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mileage_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engine_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    exhaust: Mapped[str | None] = mapped_column(Text, nullable=True)
    ecu: Mapped[str | None] = mapped_column(Text, nullable=True)
    gearing_front: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gearing_rear: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suspension_spec: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{\"schema_version\": 1}'::jsonb")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="owned"
    )
    deleted_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    user = relationship("User", back_populates="bikes")
    maintenance_logs = relationship("MaintenanceLog", back_populates="bike")
    tire_pressure_logs = relationship("TirePressureLog", back_populates="bike")
    modifications = relationship("Modification", back_populates="bike")
    ownership_history = relationship("OwnershipHistory", back_populates="bike")
    events = relationship("Event", back_populates="bike")
