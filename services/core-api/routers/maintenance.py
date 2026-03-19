"""Garage maintenance logs — CRUD + upcoming."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.maintenance import (
    MaintenanceCreate,
    MaintenanceResponse,
    MaintenanceUpdate,
    UpcomingMaintenanceResponse,
)
from services.garage_service import GarageService

router = APIRouter(prefix="/garage/bikes/{bike_id}/maintenance", tags=["Maintenance"])


@router.get("", response_model=list[MaintenanceResponse])
async def list_maintenance(
    bike_id: uuid.UUID,
    category: str | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MaintenanceResponse]:
    return await GarageService.list_maintenance(
        session, bike_id, uuid.UUID(user["user_id"]),
        category=category, from_date=from_date, to_date=to_date,
    )


@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance(
    bike_id: uuid.UUID,
    body: MaintenanceCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MaintenanceResponse:
    return await GarageService.create_maintenance(
        session, bike_id, uuid.UUID(user["user_id"]), body,
    )


@router.get("/upcoming", response_model=UpcomingMaintenanceResponse)
async def get_upcoming_maintenance(
    bike_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UpcomingMaintenanceResponse:
    return await GarageService.get_upcoming_maintenance(
        session, bike_id, uuid.UUID(user["user_id"]),
    )


@router.get("/{maintenance_id}", response_model=MaintenanceResponse)
async def get_maintenance(
    bike_id: uuid.UUID,
    maintenance_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MaintenanceResponse:
    return await GarageService.get_maintenance(
        session, bike_id, maintenance_id, uuid.UUID(user["user_id"]),
    )


@router.patch("/{maintenance_id}", response_model=MaintenanceResponse)
async def update_maintenance(
    bike_id: uuid.UUID,
    maintenance_id: uuid.UUID,
    body: MaintenanceUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MaintenanceResponse:
    return await GarageService.update_maintenance(
        session, bike_id, maintenance_id, uuid.UUID(user["user_id"]), body,
    )


@router.delete("/{maintenance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_maintenance(
    bike_id: uuid.UUID,
    maintenance_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await GarageService.delete_maintenance(
        session, bike_id, maintenance_id, uuid.UUID(user["user_id"]),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
