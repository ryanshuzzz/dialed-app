"""Garage tracks — full CRUD."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.tracks import TrackCreate, TrackResponse, TrackUpdate
from services.session_service import SessionService

router = APIRouter(prefix="/garage/tracks", tags=["Tracks"])


@router.get("", response_model=list[TrackResponse])
async def list_tracks(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TrackResponse]:
    return await SessionService.list_tracks(session)


@router.post("", response_model=TrackResponse, status_code=status.HTTP_201_CREATED)
async def create_track(
    body: TrackCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TrackResponse:
    return await SessionService.create_track(session, body)


@router.get("/{track_id}", response_model=TrackResponse)
async def get_track(
    track_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TrackResponse:
    return await SessionService.get_track(session, track_id)


@router.patch("/{track_id}", response_model=TrackResponse)
async def update_track(
    track_id: uuid.UUID,
    body: TrackUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TrackResponse:
    return await SessionService.update_track(session, track_id, body)


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(
    track_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await SessionService.delete_track(session, track_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
