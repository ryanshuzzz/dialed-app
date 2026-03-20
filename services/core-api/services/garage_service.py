"""Garage service — bikes, maintenance, tire pressure, modifications, ownership."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.errors import (
    NotFoundException,
)

from models.bike import Bike
from models.maintenance_log import MaintenanceLog
from models.modification import Modification
from models.ownership import OwnershipHistory
from models.tire_pressure_log import TirePressureLog
from schemas.bikes import (
    BikeCreate,
    BikeDetailResponse,
    BikeResponse,
    BikeStats,
    BikeUpdate,
    SuspensionSpec,
)
from schemas.maintenance import (
    MaintenanceCreate,
    MaintenanceResponse,
    MaintenanceUpdate,
    UpcomingMaintenanceItem,
    UpcomingMaintenanceResponse,
)
from schemas.modifications import (
    ModificationCreate,
    ModificationResponse,
    ModificationUpdate,
)
from schemas.ownership import OwnershipEventCreate, OwnershipEventResponse
from schemas.tire_pressure import TirePressureCreate, TirePressureResponse

# ─── Helpers ───


async def _get_bike_for_user(
    session: AsyncSession,
    bike_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    allow_deleted: bool = False,
) -> Bike:
    """Fetch a bike, verifying ownership and soft-delete status."""
    stmt = select(Bike).where(Bike.id == bike_id)
    if not allow_deleted:
        stmt = stmt.where(Bike.deleted_at.is_(None))

    result = await session.execute(stmt)
    bike = result.scalar_one_or_none()

    if not bike:
        raise NotFoundException(error="Bike not found")
    if bike.user_id != user_id:
        raise NotFoundException(error="Bike not found")
    return bike


def _validate_suspension_spec(spec: dict | SuspensionSpec | None) -> None:
    """Validate a suspension spec dict or model."""
    if spec is None:
        return
    if isinstance(spec, dict):
        SuspensionSpec.model_validate(spec)
    # If it's already a SuspensionSpec, it was validated at parse time.


class GarageService:

    # ═══════════════════════ BIKES ═══════════════════════

    @staticmethod
    async def list_bikes(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[BikeResponse]:
        result = await session.execute(
            select(Bike)
            .where(Bike.user_id == user_id, Bike.deleted_at.is_(None))
            .order_by(Bike.created_at.desc())
        )
        bikes = result.scalars().all()
        return [BikeResponse.model_validate(b) for b in bikes]

    @staticmethod
    async def create_bike(
        session: AsyncSession,
        user_id: uuid.UUID,
        data: BikeCreate,
    ) -> BikeResponse:
        if data.suspension_spec:
            _validate_suspension_spec(data.suspension_spec)

        bike_data = data.model_dump(exclude_unset=True)
        if "suspension_spec" in bike_data and bike_data["suspension_spec"] is not None:
            bike_data["suspension_spec"] = data.suspension_spec.model_dump()
        elif "suspension_spec" not in bike_data or bike_data["suspension_spec"] is None:
            bike_data["suspension_spec"] = {"schema_version": 1}

        bike = Bike(user_id=user_id, **bike_data)
        session.add(bike)
        await session.commit()
        await session.refresh(bike)
        return BikeResponse.model_validate(bike)

    @staticmethod
    async def get_bike(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> BikeResponse:
        bike = await _get_bike_for_user(session, bike_id, user_id)
        return BikeResponse.model_validate(bike)

    @staticmethod
    async def get_bike_with_summary(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> BikeDetailResponse:
        bike = await _get_bike_for_user(session, bike_id, user_id)

        # Maintenance count + last date
        maint_result = await session.execute(
            select(
                func.count(MaintenanceLog.id),
                func.max(MaintenanceLog.performed_at),
            ).where(MaintenanceLog.bike_id == bike_id)
        )
        maint_row = maint_result.one()
        maintenance_count = maint_row[0] or 0
        last_maintenance_date = maint_row[1]

        # Modification counts
        mod_total_result = await session.execute(
            select(func.count(Modification.id)).where(
                Modification.bike_id == bike_id
            )
        )
        modification_count = mod_total_result.scalar() or 0

        active_mods_result = await session.execute(
            select(func.count(Modification.id)).where(
                Modification.bike_id == bike_id,
                Modification.removed_at.is_(None),
            )
        )
        active_mods_count = active_mods_result.scalar() or 0

        # Session count + best lap
        from models.session import Session as SessionModel
        from models.event import Event

        session_result = await session.execute(
            select(
                func.count(SessionModel.id),
                func.min(
                    func.coalesce(SessionModel.csv_best_lap_ms, SessionModel.manual_best_lap_ms)
                ),
            )
            .join(Event, SessionModel.event_id == Event.id)
            .where(Event.bike_id == bike_id)
        )
        session_row = session_result.one()
        session_count = session_row[0] or 0
        best_lap_ms = session_row[1]

        # Last tire pressure check
        tp_result = await session.execute(
            select(func.max(TirePressureLog.recorded_at)).where(
                TirePressureLog.bike_id == bike_id
            )
        )
        tire_pressure_last_checked = tp_result.scalar()

        stats = BikeStats(
            maintenance_count=maintenance_count,
            last_maintenance_date=last_maintenance_date,
            modification_count=modification_count,
            active_mods_count=active_mods_count,
            session_count=session_count,
            best_lap_ms=best_lap_ms,
            tire_pressure_last_checked=tire_pressure_last_checked,
        )

        bike_data = BikeResponse.model_validate(bike).model_dump()
        return BikeDetailResponse(**bike_data, stats=stats)

    @staticmethod
    async def update_bike(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        data: BikeUpdate,
    ) -> BikeResponse:
        bike = await _get_bike_for_user(session, bike_id, user_id)

        update_data = data.model_dump(exclude_unset=True)
        if "suspension_spec" in update_data and update_data["suspension_spec"] is not None:
            _validate_suspension_spec(data.suspension_spec)
            update_data["suspension_spec"] = data.suspension_spec.model_dump()

        for field, value in update_data.items():
            setattr(bike, field, value)

        await session.commit()
        await session.refresh(bike)
        return BikeResponse.model_validate(bike)

    @staticmethod
    async def delete_bike(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        bike = await _get_bike_for_user(session, bike_id, user_id)
        bike.deleted_at = datetime.now(timezone.utc)
        await session.commit()

    # ═══════════════════════ MAINTENANCE ═══════════════════════

    @staticmethod
    async def list_maintenance(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        category: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[MaintenanceResponse]:
        await _get_bike_for_user(session, bike_id, user_id)

        stmt = (
            select(MaintenanceLog)
            .where(MaintenanceLog.bike_id == bike_id)
            .order_by(MaintenanceLog.performed_at.desc())
        )
        if category:
            stmt = stmt.where(MaintenanceLog.category == category)
        if from_date:
            stmt = stmt.where(MaintenanceLog.performed_at >= from_date)
        if to_date:
            stmt = stmt.where(MaintenanceLog.performed_at <= to_date)

        result = await session.execute(stmt)
        logs = result.scalars().all()
        return [MaintenanceResponse.model_validate(m) for m in logs]

    @staticmethod
    async def create_maintenance(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        data: MaintenanceCreate,
    ) -> MaintenanceResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        log = MaintenanceLog(
            bike_id=bike_id,
            user_id=user_id,
            **data.model_dump(),
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        return MaintenanceResponse.model_validate(log)

    @staticmethod
    async def get_maintenance(
        session: AsyncSession,
        bike_id: uuid.UUID,
        maintenance_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> MaintenanceResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(MaintenanceLog).where(
                MaintenanceLog.id == maintenance_id,
                MaintenanceLog.bike_id == bike_id,
            )
        )
        log = result.scalar_one_or_none()
        if not log:
            raise NotFoundException(error="Maintenance log not found")
        return MaintenanceResponse.model_validate(log)

    @staticmethod
    async def update_maintenance(
        session: AsyncSession,
        bike_id: uuid.UUID,
        maintenance_id: uuid.UUID,
        user_id: uuid.UUID,
        data: MaintenanceUpdate,
    ) -> MaintenanceResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(MaintenanceLog).where(
                MaintenanceLog.id == maintenance_id,
                MaintenanceLog.bike_id == bike_id,
            )
        )
        log = result.scalar_one_or_none()
        if not log:
            raise NotFoundException(error="Maintenance log not found")

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(log, field, value)

        await session.commit()
        await session.refresh(log)
        return MaintenanceResponse.model_validate(log)

    @staticmethod
    async def delete_maintenance(
        session: AsyncSession,
        bike_id: uuid.UUID,
        maintenance_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(MaintenanceLog).where(
                MaintenanceLog.id == maintenance_id,
                MaintenanceLog.bike_id == bike_id,
            )
        )
        log = result.scalar_one_or_none()
        if not log:
            raise NotFoundException(error="Maintenance log not found")

        await session.delete(log)
        await session.commit()

    @staticmethod
    async def get_upcoming_maintenance(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> UpcomingMaintenanceResponse:
        bike = await _get_bike_for_user(session, bike_id, user_id)
        current_mileage = bike.mileage_km
        today = date.today()
        threshold_date = today + timedelta(days=30)

        stmt = (
            select(MaintenanceLog)
            .where(MaintenanceLog.bike_id == bike_id)
            .where(
                (
                    (MaintenanceLog.next_due_km.isnot(None))
                    & (current_mileage is not None)
                    & (MaintenanceLog.next_due_km <= (current_mileage or 0) + 500)
                )
                | (
                    (MaintenanceLog.next_due_date.isnot(None))
                    & (MaintenanceLog.next_due_date <= threshold_date)
                )
            )
        )

        result = await session.execute(stmt)
        logs = result.scalars().all()

        items = []
        for log in logs:
            items.append(
                UpcomingMaintenanceItem(
                    id=log.id,
                    bike_id=log.bike_id,
                    category=log.category,
                    performed_at=log.performed_at,
                    next_due_km=log.next_due_km,
                    next_due_date=log.next_due_date,
                    current_mileage_km=current_mileage,
                )
            )

        # Sort by urgency: closest due first
        def urgency_key(item: UpcomingMaintenanceItem) -> tuple:
            km_urgency = float("inf")
            date_urgency = float("inf")
            if item.next_due_km is not None and current_mileage is not None:
                km_urgency = item.next_due_km - current_mileage
            if item.next_due_date is not None:
                date_urgency = (item.next_due_date - today).days
            return (min(km_urgency, date_urgency),)

        items.sort(key=urgency_key)
        return UpcomingMaintenanceResponse(items=items)

    # ═══════════════════════ TIRE PRESSURE ═══════════════════════

    @staticmethod
    async def list_tire_pressure(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        context: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> list[TirePressureResponse]:
        await _get_bike_for_user(session, bike_id, user_id)

        stmt = (
            select(TirePressureLog)
            .where(TirePressureLog.bike_id == bike_id)
            .order_by(TirePressureLog.recorded_at.desc())
        )
        if context:
            stmt = stmt.where(TirePressureLog.context == context)
        if from_date:
            stmt = stmt.where(TirePressureLog.recorded_at >= from_date)
        if to_date:
            stmt = stmt.where(TirePressureLog.recorded_at <= to_date)

        result = await session.execute(stmt)
        logs = result.scalars().all()
        return [TirePressureResponse.model_validate(tp) for tp in logs]

    @staticmethod
    async def create_tire_pressure(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        data: TirePressureCreate,
    ) -> TirePressureResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        log = TirePressureLog(
            bike_id=bike_id,
            user_id=user_id,
            **data.model_dump(),
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        return TirePressureResponse.model_validate(log)

    @staticmethod
    async def get_tire_pressure(
        session: AsyncSession,
        bike_id: uuid.UUID,
        reading_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> TirePressureResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(TirePressureLog).where(
                TirePressureLog.id == reading_id,
                TirePressureLog.bike_id == bike_id,
            )
        )
        log = result.scalar_one_or_none()
        if not log:
            raise NotFoundException(error="Tire pressure reading not found")
        return TirePressureResponse.model_validate(log)

    @staticmethod
    async def delete_tire_pressure(
        session: AsyncSession,
        bike_id: uuid.UUID,
        reading_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(TirePressureLog).where(
                TirePressureLog.id == reading_id,
                TirePressureLog.bike_id == bike_id,
            )
        )
        log = result.scalar_one_or_none()
        if not log:
            raise NotFoundException(error="Tire pressure reading not found")

        await session.delete(log)
        await session.commit()

    # ═══════════════════════ MODIFICATIONS ═══════════════════════

    @staticmethod
    async def list_modifications(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        category: str | None = None,
        status: str | None = None,
    ) -> list[ModificationResponse]:
        await _get_bike_for_user(session, bike_id, user_id)

        stmt = (
            select(Modification)
            .where(Modification.bike_id == bike_id)
            .order_by(Modification.installed_at.desc())
        )
        if category:
            stmt = stmt.where(Modification.category == category)
        if status == "active":
            stmt = stmt.where(Modification.removed_at.is_(None))
        elif status == "removed":
            stmt = stmt.where(Modification.removed_at.isnot(None))

        result = await session.execute(stmt)
        mods = result.scalars().all()
        return [ModificationResponse.model_validate(m) for m in mods]

    @staticmethod
    async def create_modification(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ModificationCreate,
    ) -> ModificationResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        mod = Modification(
            bike_id=bike_id,
            user_id=user_id,
            **data.model_dump(),
        )
        session.add(mod)
        await session.commit()
        await session.refresh(mod)
        return ModificationResponse.model_validate(mod)

    @staticmethod
    async def get_modification(
        session: AsyncSession,
        bike_id: uuid.UUID,
        mod_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> ModificationResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(Modification).where(
                Modification.id == mod_id,
                Modification.bike_id == bike_id,
            )
        )
        mod = result.scalar_one_or_none()
        if not mod:
            raise NotFoundException(error="Modification not found")
        return ModificationResponse.model_validate(mod)

    @staticmethod
    async def update_modification(
        session: AsyncSession,
        bike_id: uuid.UUID,
        mod_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ModificationUpdate,
    ) -> ModificationResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(Modification).where(
                Modification.id == mod_id,
                Modification.bike_id == bike_id,
            )
        )
        mod = result.scalar_one_or_none()
        if not mod:
            raise NotFoundException(error="Modification not found")

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(mod, field, value)

        await session.commit()
        await session.refresh(mod)
        return ModificationResponse.model_validate(mod)

    @staticmethod
    async def delete_modification(
        session: AsyncSession,
        bike_id: uuid.UUID,
        mod_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(Modification).where(
                Modification.id == mod_id,
                Modification.bike_id == bike_id,
            )
        )
        mod = result.scalar_one_or_none()
        if not mod:
            raise NotFoundException(error="Modification not found")

        await session.delete(mod)
        await session.commit()

    # ═══════════════════════ OWNERSHIP ═══════════════════════

    @staticmethod
    async def list_ownership(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> list[OwnershipEventResponse]:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(OwnershipHistory)
            .where(OwnershipHistory.bike_id == bike_id)
            .order_by(OwnershipHistory.date.desc())
        )
        events = result.scalars().all()
        return [OwnershipEventResponse.model_validate(e) for e in events]

    @staticmethod
    async def create_ownership_event(
        session: AsyncSession,
        bike_id: uuid.UUID,
        user_id: uuid.UUID,
        data: OwnershipEventCreate,
    ) -> OwnershipEventResponse:
        await _get_bike_for_user(session, bike_id, user_id)

        event = OwnershipHistory(
            bike_id=bike_id,
            user_id=user_id,
            **data.model_dump(),
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        return OwnershipEventResponse.model_validate(event)

    @staticmethod
    async def delete_ownership_event(
        session: AsyncSession,
        bike_id: uuid.UUID,
        ownership_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        await _get_bike_for_user(session, bike_id, user_id)

        result = await session.execute(
            select(OwnershipHistory).where(
                OwnershipHistory.id == ownership_id,
                OwnershipHistory.bike_id == bike_id,
            )
        )
        event = result.scalar_one_or_none()
        if not event:
            raise NotFoundException(error="Ownership event not found")

        await session.delete(event)
        await session.commit()
