"""Garage bikes — CRUD with soft delete."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.bikes import (
    BikeCreate,
    BikeDetailResponse,
    BikeResponse,
    BikeUpdate,
)
from services.garage_service import GarageService

router = APIRouter(prefix="/garage/bikes", tags=["Bikes"])


@router.get("", response_model=list[BikeResponse])
async def list_bikes(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[BikeResponse]:
    return await GarageService.list_bikes(session, uuid.UUID(user["user_id"]))


@router.post("", response_model=BikeResponse, status_code=status.HTTP_201_CREATED)
async def create_bike(
    body: BikeCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BikeResponse:
    return await GarageService.create_bike(session, uuid.UUID(user["user_id"]), body)


@router.get("/{bike_id}", response_model=BikeDetailResponse)
async def get_bike(
    bike_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BikeDetailResponse:
    return await GarageService.get_bike_with_summary(
        session, bike_id, uuid.UUID(user["user_id"]),
    )


@router.patch("/{bike_id}", response_model=BikeResponse)
async def update_bike(
    bike_id: uuid.UUID,
    body: BikeUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BikeResponse:
    return await GarageService.update_bike(
        session, bike_id, uuid.UUID(user["user_id"]), body,
    )


@router.delete("/{bike_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bike(
    bike_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await GarageService.delete_bike(session, bike_id, uuid.UUID(user["user_id"]))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
