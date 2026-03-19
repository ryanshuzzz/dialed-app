"""Progress — lap trends, efficacy, session history."""

from fastapi import APIRouter

router = APIRouter(prefix="/progress", tags=["Progress"])


@router.get("")
async def progress_placeholder() -> dict:
    return {"status": "not implemented"}
