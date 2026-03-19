"""Sessions — CRUD + setup snapshots + change log."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.sessions import (
    ChangeLogCreate,
    ChangeLogResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
    SessionUpdate,
    SetupSnapshotCreate,
    SetupSnapshotResponse,
)
from services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    event_id: uuid.UUID | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SessionResponse]:
    return await SessionService.list_sessions(
        session, uuid.UUID(user["user_id"]),
        event_id=event_id, from_date=from_date, to_date=to_date,
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session_endpoint(
    body: SessionCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionResponse:
    return await SessionService.create_session(
        session, uuid.UUID(user["user_id"]), body,
    )


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(
    session_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionDetailResponse:
    return await SessionService.get_session(
        session, session_id, uuid.UUID(user["user_id"]),
    )


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionResponse:
    return await SessionService.update_session(
        session, session_id, uuid.UUID(user["user_id"]), body,
    )


# ── Setup Snapshots ──


@router.post(
    "/{session_id}/snapshot",
    response_model=SetupSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_snapshot(
    session_id: uuid.UUID,
    body: SetupSnapshotCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SetupSnapshotResponse:
    return await SessionService.create_setup_snapshot(
        session, session_id, uuid.UUID(user["user_id"]), body,
    )


# ── Change Log ──


@router.get("/{session_id}/changes", response_model=list[ChangeLogResponse])
async def list_changes(
    session_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ChangeLogResponse]:
    return await SessionService.get_change_log(
        session, session_id, uuid.UUID(user["user_id"]),
    )


@router.post(
    "/{session_id}/changes",
    response_model=ChangeLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_change(
    session_id: uuid.UUID,
    body: ChangeLogCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChangeLogResponse:
    return await SessionService.create_change_log_entry(
        session, session_id, uuid.UUID(user["user_id"]), body,
    )
