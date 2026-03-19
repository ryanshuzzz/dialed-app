"""Garage tracks — CRUD."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/tracks", tags=["Tracks"])


@router.get("")
async def tracks_placeholder() -> dict:
    return {"status": "not implemented"}
