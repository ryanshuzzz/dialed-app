"""Garage events — CRUD with conditions JSONB."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/events", tags=["Events"])


@router.get("")
async def events_placeholder() -> dict:
    return {"status": "not implemented"}
