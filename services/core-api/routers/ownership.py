"""Garage ownership history — timeline, create, delete."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.ownership import OwnershipEventCreate, OwnershipEventResponse
from services.garage_service import GarageService

router = APIRouter(prefix="/garage/bikes/{bike_id}/ownership", tags=["Ownership"])


@router.get("", response_model=list[OwnershipEventResponse])
async def list_ownership(
    bike_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[OwnershipEventResponse]:
    return await GarageService.list_ownership(
        session, bike_id, uuid.UUID(user["user_id"]),
    )


@router.post("", response_model=OwnershipEventResponse, status_code=status.HTTP_201_CREATED)
async def create_ownership_event(
    bike_id: uuid.UUID,
    body: OwnershipEventCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OwnershipEventResponse:
    return await GarageService.create_ownership_event(
        session, bike_id, uuid.UUID(user["user_id"]), body,
    )


@router.delete("/{ownership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ownership_event(
    bike_id: uuid.UUID,
    ownership_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await GarageService.delete_ownership_event(
        session, bike_id, ownership_id, uuid.UUID(user["user_id"]),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
