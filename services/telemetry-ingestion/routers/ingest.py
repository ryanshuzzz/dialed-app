"""Ingestion endpoints — CSV, OCR, voice upload + job status + SSE stream."""

from fastapi import APIRouter

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.get("/jobs/{job_id}")
async def ingest_placeholder(job_id: str) -> dict:
    return {"status": "not implemented"}
