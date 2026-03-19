import uuid

from sqlalchemy import String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    skill_level: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="novice"
    )
    rider_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="street"
    )
    units: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="metric"
    )
    created_at: Mapped[str] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[str] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    auth_tokens = relationship("AuthToken", back_populates="user", lazy="selectin")
    api_keys = relationship("UserApiKey", back_populates="user", lazy="selectin")
    bikes = relationship("Bike", back_populates="user", lazy="selectin")
