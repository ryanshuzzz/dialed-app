"""Admin — channel alias CRUD."""

from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/channel-aliases")
async def admin_placeholder() -> dict:
    return {"status": "not implemented"}
