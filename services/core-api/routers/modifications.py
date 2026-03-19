"""Garage modifications — CRUD with category and status filters."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.modifications import (
    ModificationCreate,
    ModificationResponse,
    ModificationUpdate,
)
from services.garage_service import GarageService

router = APIRouter(prefix="/garage/bikes/{bike_id}/mods", tags=["Modifications"])


@router.get("", response_model=list[ModificationResponse])
async def list_modifications(
    bike_id: uuid.UUID,
    category: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ModificationResponse]:
    return await GarageService.list_modifications(
        session, bike_id, uuid.UUID(user["user_id"]),
        category=category, status=status_filter,
    )


@router.post("", response_model=ModificationResponse, status_code=status.HTTP_201_CREATED)
async def create_modification(
    bike_id: uuid.UUID,
    body: ModificationCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ModificationResponse:
    return await GarageService.create_modification(
        session, bike_id, uuid.UUID(user["user_id"]), body,
    )


@router.get("/{mod_id}", response_model=ModificationResponse)
async def get_modification(
    bike_id: uuid.UUID,
    mod_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ModificationResponse:
    return await GarageService.get_modification(
        session, bike_id, mod_id, uuid.UUID(user["user_id"]),
    )


@router.patch("/{mod_id}", response_model=ModificationResponse)
async def update_modification(
    bike_id: uuid.UUID,
    mod_id: uuid.UUID,
    body: ModificationUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ModificationResponse:
    return await GarageService.update_modification(
        session, bike_id, mod_id, uuid.UUID(user["user_id"]), body,
    )


@router.delete("/{mod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_modification(
    bike_id: uuid.UUID,
    mod_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await GarageService.delete_modification(
        session, bike_id, mod_id, uuid.UUID(user["user_id"]),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
