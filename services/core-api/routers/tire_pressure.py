"""Garage tire pressure logs — CRUD."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/bikes/{bike_id}/tire-pressure", tags=["Tire Pressure"])


@router.get("")
async def tire_pressure_placeholder(bike_id: str) -> dict:
    return {"status": "not implemented"}
