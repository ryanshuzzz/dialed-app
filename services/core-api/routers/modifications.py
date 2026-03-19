"""Garage modifications — CRUD."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/bikes/{bike_id}/mods", tags=["Modifications"])


@router.get("")
async def modifications_placeholder(bike_id: str) -> dict:
    return {"status": "not implemented"}
