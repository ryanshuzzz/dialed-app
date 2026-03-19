"""Auth endpoints — register, login, refresh, profile, API keys."""

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("")
async def auth_placeholder() -> dict:
    return {"status": "not implemented"}
