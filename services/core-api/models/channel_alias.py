import uuid

from sqlalchemy import DateTime, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class ChannelAlias(Base):
    __tablename__ = "channel_aliases"
    __table_args__ = (
        UniqueConstraint(
            "raw_name", "logger_model", name="uq_channel_aliases_raw_logger"
        ),
        {"schema": "core"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    raw_name: Mapped[str] = mapped_column(String(200), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(200), nullable=False)
    logger_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
