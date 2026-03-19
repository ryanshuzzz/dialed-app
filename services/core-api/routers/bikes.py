"""Garage bikes — CRUD with soft delete."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/bikes", tags=["Bikes"])


@router.get("")
async def bikes_placeholder() -> dict:
    return {"status": "not implemented"}
