"""Garage tire pressure logs — CRUD with context and date filters."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.tire_pressure import TirePressureCreate, TirePressureResponse
from services.garage_service import GarageService

router = APIRouter(prefix="/garage/bikes/{bike_id}/tire-pressure", tags=["Tire Pressure"])


@router.get("", response_model=list[TirePressureResponse])
async def list_tire_pressure(
    bike_id: uuid.UUID,
    context: str | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TirePressureResponse]:
    return await GarageService.list_tire_pressure(
        session, bike_id, uuid.UUID(user["user_id"]),
        context=context, from_date=from_date, to_date=to_date,
    )


@router.post("", response_model=TirePressureResponse, status_code=status.HTTP_201_CREATED)
async def create_tire_pressure(
    bike_id: uuid.UUID,
    body: TirePressureCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TirePressureResponse:
    return await GarageService.create_tire_pressure(
        session, bike_id, uuid.UUID(user["user_id"]), body,
    )


@router.get("/{reading_id}", response_model=TirePressureResponse)
async def get_tire_pressure(
    bike_id: uuid.UUID,
    reading_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TirePressureResponse:
    return await GarageService.get_tire_pressure(
        session, bike_id, reading_id, uuid.UUID(user["user_id"]),
    )


@router.delete("/{reading_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tire_pressure(
    bike_id: uuid.UUID,
    reading_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await GarageService.delete_tire_pressure(
        session, bike_id, reading_id, uuid.UUID(user["user_id"]),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
