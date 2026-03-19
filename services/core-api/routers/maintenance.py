"""Garage maintenance logs — CRUD + upcoming."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/bikes/{bike_id}/maintenance", tags=["Maintenance"])


@router.get("")
async def maintenance_placeholder(bike_id: str) -> dict:
    return {"status": "not implemented"}
