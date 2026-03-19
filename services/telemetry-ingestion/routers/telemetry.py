"""Telemetry endpoints — upload, channels, lap data, analysis."""

from fastapi import APIRouter

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


@router.get("/{session_id}/channels")
async def telemetry_placeholder(session_id: str) -> dict:
    return {"status": "not implemented"}
