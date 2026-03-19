"""Garage ownership history — timeline + CRUD."""

from fastapi import APIRouter

router = APIRouter(prefix="/garage/bikes/{bike_id}/ownership", tags=["Ownership"])


@router.get("")
async def ownership_placeholder(bike_id: str) -> dict:
    return {"status": "not implemented"}
