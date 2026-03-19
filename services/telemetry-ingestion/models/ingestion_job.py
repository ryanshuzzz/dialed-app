"""Ingestion job model — tracks async data ingestion state."""

import enum

from sqlalchemy import Column, DateTime, Double, Enum, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class IngestionSource(str, enum.Enum):
    csv = "csv"
    ocr = "ocr"
    voice = "voice"


class IngestionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    complete = "complete"
    failed = "failed"


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = {"schema": "telemetry"}

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    session_id = Column(UUID(as_uuid=True), nullable=False)
    source = Column(
        Enum(IngestionSource, name="ingestion_source", schema="telemetry"),
        nullable=False,
    )
    status = Column(
        Enum(IngestionStatus, name="ingestion_status", schema="telemetry"),
        nullable=False,
        server_default=text("'pending'"),
    )
    result = Column(JSONB, nullable=True)
    error_message = Column(String, nullable=True)
    confidence = Column(Double, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)
