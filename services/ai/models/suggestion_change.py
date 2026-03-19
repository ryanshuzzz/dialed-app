import uuid

from sqlalchemy import DateTime, Double, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class SuggestionChange(Base):
    __tablename__ = "suggestion_changes"
    __table_args__ = (
        Index("ix_suggestion_changes_suggestion", "suggestion_id"),
        {"schema": "ai"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    suggestion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai.suggestions.id", ondelete="CASCADE"),
        nullable=False,
    )
    parameter: Mapped[str] = mapped_column(String(100), nullable=False)
    suggested_value: Mapped[str] = mapped_column(String(200), nullable=False)
    symptom: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Double, nullable=True)
    applied_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'not_applied'"),
    )
    actual_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    outcome_lap_delta_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    applied_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    suggestion = relationship("Suggestion", back_populates="changes")
