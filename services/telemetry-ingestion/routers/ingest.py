"""Ingestion endpoints — CSV, OCR, voice upload + job status + SSE stream + confirm."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db_session
from dialed_shared.auth import get_current_user
from dialed_shared.errors import DialedException, NotFoundException, ValidationException
from dialed_shared.logging import setup_logger
from dialed_shared.redis_tasks import push_job
from models.ingestion_job import IngestionJob, IngestionSource, IngestionStatus
from pipelines.voice_pipeline import extract_entities
from schemas.ingestion import (
    ConfirmRequest,
    ConfirmResponse,
    IngestionJobCreated,
    IngestionJobResponse,
    VoiceTranscriptRequest,
    VoiceTranscriptResponse,
)
from sse import create_sse_response

logger = setup_logger("telemetry-ingestion")

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
CORE_API_URL = os.environ.get("CORE_API_URL", "http://core-api:8001")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/storage/uploads")


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_ingestion_job(
    db: AsyncSession,
    session_id: str,
    source: IngestionSource,
    user_id: str,
    file: UploadFile,
    allowed_extensions: set[str],
) -> tuple[str, str]:
    """Create an ingestion_job row, save the file, push to Redis.

    Returns (job_id, file_path).
    """
    # Validate file extension.
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()
    if allowed_extensions and ext not in allowed_extensions:
        raise ValidationException(
            f"Unsupported file type: {ext}. "
            f"Allowed: {', '.join(sorted(allowed_extensions))}"
        )

    job_id = str(uuid.uuid4())

    # Save uploaded file to disk.
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
    content = await file.read()
    if not content:
        raise ValidationException("Uploaded file is empty")

    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB row.
    job = IngestionJob(
        id=job_id,
        session_id=session_id,
        source=source,
        status=IngestionStatus.pending,
    )
    db.add(job)
    await db.commit()

    # Push to Redis queue.
    await push_job(
        redis_url=REDIS_URL,
        queue_name="dialed:ingestion",
        payload={
            "job_id": job_id,
            "session_id": session_id,
            "user_id": user_id,
            "source": source.value,
            "file_path": file_path,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    logger.info("Created ingestion job %s (source=%s, session=%s)", job_id, source.value, session_id)
    return job_id, file_path


# ── Upload endpoints ─────────────────────────────────────────────────────────


@router.post("/csv", status_code=202, response_model=IngestionJobCreated)
async def ingest_csv(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
) -> IngestionJobCreated:
    """Upload a CSV data logger file for async ingestion."""
    allowed = {".csv", ".txt"}
    ext = os.path.splitext(file.filename or "upload")[1].lower()
    if ext not in allowed:
        raise DialedException(
            error=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(allowed))}",
            code="INVALID_FILE_FORMAT",
            status_code=400,
        )
    job_id, _ = await _create_ingestion_job(
        db=db,
        session_id=session_id,
        source=IngestionSource.csv,
        user_id=user["user_id"],
        file=file,
        allowed_extensions=set(),  # already validated above
    )
    return IngestionJobCreated(job_id=job_id)


@router.post("/ocr", status_code=202, response_model=IngestionJobCreated)
async def ingest_ocr(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
) -> IngestionJobCreated:
    """Upload a setup sheet photo for OCR extraction."""
    job_id, _ = await _create_ingestion_job(
        db=db,
        session_id=session_id,
        source=IngestionSource.ocr,
        user_id=user["user_id"],
        file=file,
        allowed_extensions={".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"},
    )
    return IngestionJobCreated(job_id=job_id)


@router.post("/voice", status_code=202, response_model=IngestionJobCreated)
async def ingest_voice(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
) -> IngestionJobCreated:
    """Upload an audio voice note for transcription."""
    job_id, _ = await _create_ingestion_job(
        db=db,
        session_id=session_id,
        source=IngestionSource.voice,
        user_id=user["user_id"],
        file=file,
        allowed_extensions={".wav", ".mp3", ".m4a", ".ogg", ".webm"},
    )
    return IngestionJobCreated(job_id=job_id)


@router.post("/voice/transcript", response_model=VoiceTranscriptResponse)
async def ingest_voice_transcript(
    body: VoiceTranscriptRequest,
    user: dict = Depends(get_current_user),
) -> VoiceTranscriptResponse:
    """Extract entities from a pre-transcribed voice note without audio upload.

    Skips the Whisper transcription step and runs entity extraction directly
    on the supplied transcript text. The extracted entities are returned for
    user review — no ingestion job is created and nothing is auto-saved.
    The caller should present the result for confirmation.
    """
    result = extract_entities(body.transcript)

    logger.info(
        "Voice transcript entity extraction — session=%s, mentions=%d, confidence=%.2f",
        body.session_id,
        len(result.setting_mentions),
        result.confidence,
    )

    return VoiceTranscriptResponse(
        session_id=body.session_id,
        transcript=result.transcript,
        setting_mentions=result.setting_mentions,
        lap_times=result.lap_times,
        feedback=result.feedback,
        confidence=result.confidence,
    )


# ── Job status ───────────────────────────────────────────────────────────────


@router.get("/jobs/{job_id}", response_model=IngestionJobResponse)
async def get_ingestion_job(
    job_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
) -> IngestionJobResponse:
    """Get ingestion job status."""
    stmt = select(IngestionJob).where(IngestionJob.id == job_id)
    row = (await db.execute(stmt)).scalar_one_or_none()

    if row is None:
        raise NotFoundException("Ingestion job not found")

    return IngestionJobResponse.model_validate(row)


# ── SSE stream ───────────────────────────────────────────────────────────────


@router.get("/jobs/{job_id}/stream")
async def stream_ingestion_job(
    job_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    """SSE stream for ingestion job completion."""
    # Verify the job exists before opening the stream.
    stmt = select(IngestionJob.id).where(IngestionJob.id == job_id)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise NotFoundException("Ingestion job not found")

    return create_sse_response(job_id)


# ── Confirm ──────────────────────────────────────────────────────────────────


@router.post("/jobs/{job_id}/confirm", response_model=ConfirmResponse)
async def confirm_ingestion_job(
    job_id: str,
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
) -> ConfirmResponse:
    """Confirm or correct extracted data from OCR/voice jobs."""
    stmt = select(IngestionJob).where(IngestionJob.id == job_id)
    job = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        raise NotFoundException("Ingestion job not found")

    if job.source == IngestionSource.csv:
        raise ValidationException("CSV jobs do not require confirmation")

    if job.status != IngestionStatus.complete:
        raise ValidationException(
            f"Job is not in 'complete' status (current: {job.status.value})"
        )

    if job.result is None:
        raise ValidationException("Job has no extracted result to confirm")

    session_id = str(job.session_id)

    # Determine the data to write — either the original result or corrections.
    if body.confirmed and body.corrections is None:
        data_to_write = job.result
        confirm_status = "confirmed"
    else:
        data_to_write = body.corrections if body.corrections else job.result
        confirm_status = "corrected"

    # Forward confirmed data to Core API to write to the session's setup snapshot.
    internal_token = user.get("_raw_token", "")
    # Re-read the token from the request isn't possible here, so we create one.
    from dialed_shared.auth import create_internal_token

    internal_secret = os.environ.get("INTERNAL_SECRET", "")
    token = create_internal_token(user["user_id"], internal_secret)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{CORE_API_URL}/sessions/{session_id}",
                json={"setup_snapshot": data_to_write},
                headers={"X-Internal-Token": token},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError:
        logger.exception("Failed to write confirmed data to session %s", session_id)
        raise
    except Exception:
        logger.exception("Failed to reach Core API for session %s", session_id)
        raise

    logger.info(
        "Confirmed job %s (%s) — writing to session %s",
        job_id, confirm_status, session_id,
    )

    return ConfirmResponse(status=confirm_status, session_id=session_id)
