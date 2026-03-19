"""Sessions — CRUD + snapshots + change log."""

from fastapi import APIRouter

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("")
async def sessions_placeholder() -> dict:
    return {"status": "not implemented"}
