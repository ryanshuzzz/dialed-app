"""Garage events — CRUD with conditions JSONB and filters."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.events import EventCreate, EventResponse, EventUpdate
from services.session_service import SessionService

router = APIRouter(prefix="/garage/events", tags=["Events"])


@router.get("", response_model=list[EventResponse])
async def list_events(
    bike_id: uuid.UUID | None = Query(None),
    track_id: uuid.UUID | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[EventResponse]:
    return await SessionService.list_events(
        session, uuid.UUID(user["user_id"]),
        bike_id=bike_id, track_id=track_id,
        from_date=from_date, to_date=to_date,
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EventResponse:
    return await SessionService.create_event(
        session, uuid.UUID(user["user_id"]), body,
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EventResponse:
    return await SessionService.get_event(
        session, event_id, uuid.UUID(user["user_id"]),
    )


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EventResponse:
    return await SessionService.update_event(
        session, event_id, uuid.UUID(user["user_id"]), body,
    )


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await SessionService.delete_event(
        session, event_id, uuid.UUID(user["user_id"]),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
