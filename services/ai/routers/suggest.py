"""Suggestion endpoints — request, stream, list, detail, change tracking."""

from fastapi import APIRouter

router = APIRouter(prefix="/suggest", tags=["Suggestions"])


@router.get("/session/{session_id}")
async def suggest_placeholder(session_id: str) -> dict:
    return {"status": "not implemented"}
