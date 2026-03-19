import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class ChangeLog(Base):
    __tablename__ = "change_log"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parameter: Mapped[str] = mapped_column(String(100), nullable=False)
    from_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    to_value: Mapped[str] = mapped_column(String(200), nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session = relationship("Session", back_populates="change_log_entries")
