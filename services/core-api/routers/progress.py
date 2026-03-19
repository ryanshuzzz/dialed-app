"""Progress — lap trends, efficacy, session history."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.progress import (
    EfficacyResponse,
    LapTrendResponse,
    SessionHistoryResponse,
)
from services.progress_service import ProgressService

router = APIRouter(prefix="/progress", tags=["Progress"])


@router.get("", response_model=LapTrendResponse)
async def get_progress_overview(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LapTrendResponse:
    return await ProgressService.get_lap_trends(session, uuid.UUID(user["user_id"]))


@router.get("/efficacy", response_model=EfficacyResponse)
async def get_efficacy(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EfficacyResponse:
    return await ProgressService.get_efficacy(session, uuid.UUID(user["user_id"]))


@router.get("/sessions", response_model=SessionHistoryResponse)
async def get_session_history(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionHistoryResponse:
    return await ProgressService.get_session_history(session, uuid.UUID(user["user_id"]))
