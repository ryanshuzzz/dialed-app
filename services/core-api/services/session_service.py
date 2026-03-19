"""Session service — sessions, setup snapshots, change log, tracks, events."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.errors import (
    ForbiddenException,
    NotFoundException,
    ValidationException,
)

from models.change_log import ChangeLog
from models.event import Event
from models.session import Session
from models.setup_snapshot import SetupSnapshot
from models.track import Track
from schemas.bikes import SuspensionSpec
from schemas.events import (
    ConditionsModel,
    EventCreate,
    EventResponse,
    EventUpdate,
)
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
from schemas.tracks import TrackCreate, TrackResponse, TrackUpdate


class SessionService:

    # ═══════════════════════ TRACKS ═══════════════════════

    @staticmethod
    async def list_tracks(session: AsyncSession) -> list[TrackResponse]:
        result = await session.execute(
            select(Track).order_by(Track.name)
        )
        tracks = result.scalars().all()
        return [TrackResponse.model_validate(t) for t in tracks]

    @staticmethod
    async def create_track(
        session: AsyncSession,
        data: TrackCreate,
    ) -> TrackResponse:
        track = Track(**data.model_dump())
        session.add(track)
        await session.commit()
        await session.refresh(track)
        return TrackResponse.model_validate(track)

    @staticmethod
    async def get_track(
        session: AsyncSession,
        track_id: uuid.UUID,
    ) -> TrackResponse:
        result = await session.execute(
            select(Track).where(Track.id == track_id)
        )
        track = result.scalar_one_or_none()
        if not track:
            raise NotFoundException(error="Track not found")
        return TrackResponse.model_validate(track)

    @staticmethod
    async def update_track(
        session: AsyncSession,
        track_id: uuid.UUID,
        data: TrackUpdate,
    ) -> TrackResponse:
        result = await session.execute(
            select(Track).where(Track.id == track_id)
        )
        track = result.scalar_one_or_none()
        if not track:
            raise NotFoundException(error="Track not found")

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(track, field, value)

        await session.commit()
        await session.refresh(track)
        return TrackResponse.model_validate(track)

    @staticmethod
    async def delete_track(
        session: AsyncSession,
        track_id: uuid.UUID,
    ) -> None:
        result = await session.execute(
            select(Track).where(Track.id == track_id)
        )
        track = result.scalar_one_or_none()
        if not track:
            raise NotFoundException(error="Track not found")

        await session.delete(track)
        await session.commit()

    # ═══════════════════════ EVENTS ═══════════════════════

    @staticmethod
    async def list_events(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        bike_id: uuid.UUID | None = None,
        track_id: uuid.UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[EventResponse]:
        stmt = (
            select(Event)
            .where(Event.user_id == user_id)
            .order_by(Event.date.desc())
        )
        if bike_id:
            stmt = stmt.where(Event.bike_id == bike_id)
        if track_id:
            stmt = stmt.where(Event.track_id == track_id)
        if from_date:
            stmt = stmt.where(Event.date >= from_date)
        if to_date:
            stmt = stmt.where(Event.date <= to_date)

        result = await session.execute(stmt)
        events = result.scalars().all()
        return [EventResponse.model_validate(e) for e in events]

    @staticmethod
    async def create_event(
        session: AsyncSession,
        user_id: uuid.UUID,
        data: EventCreate,
    ) -> EventResponse:
        if data.conditions:
            ConditionsModel.model_validate(data.conditions.model_dump())

        event = Event(
            user_id=user_id,
            bike_id=data.bike_id,
            track_id=data.track_id,
            date=data.date,
            conditions=data.conditions.model_dump() if data.conditions else {},
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        return EventResponse.model_validate(event)

    @staticmethod
    async def get_event(
        session: AsyncSession,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> EventResponse:
        result = await session.execute(
            select(Event).where(Event.id == event_id)
        )
        event = result.scalar_one_or_none()
        if not event:
            raise NotFoundException(error="Event not found")
        if event.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this event")
        return EventResponse.model_validate(event)

    @staticmethod
    async def update_event(
        session: AsyncSession,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        data: EventUpdate,
    ) -> EventResponse:
        result = await session.execute(
            select(Event).where(Event.id == event_id)
        )
        event = result.scalar_one_or_none()
        if not event:
            raise NotFoundException(error="Event not found")
        if event.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this event")

        update_data = data.model_dump(exclude_unset=True)
        if "conditions" in update_data and update_data["conditions"] is not None:
            ConditionsModel.model_validate(update_data["conditions"])
            update_data["conditions"] = data.conditions.model_dump()

        for field, value in update_data.items():
            setattr(event, field, value)

        await session.commit()
        await session.refresh(event)
        return EventResponse.model_validate(event)

    @staticmethod
    async def delete_event(
        session: AsyncSession,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        result = await session.execute(
            select(Event).where(Event.id == event_id)
        )
        event = result.scalar_one_or_none()
        if not event:
            raise NotFoundException(error="Event not found")
        if event.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this event")

        await session.delete(event)
        await session.commit()

    # ═══════════════════════ SESSIONS ═══════════════════════

    @staticmethod
    async def list_sessions(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        event_id: uuid.UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[SessionResponse]:
        stmt = (
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(Session.created_at.desc())
        )
        if event_id:
            stmt = stmt.where(Session.event_id == event_id)
        if from_date or to_date:
            stmt = stmt.join(Event, Session.event_id == Event.id)
            if from_date:
                stmt = stmt.where(Event.date >= from_date)
            if to_date:
                stmt = stmt.where(Event.date <= to_date)

        result = await session.execute(stmt)
        sessions = result.scalars().all()
        return [SessionResponse.model_validate(s) for s in sessions]

    @staticmethod
    async def create_session(
        session: AsyncSession,
        user_id: uuid.UUID,
        data: SessionCreate,
    ) -> SessionResponse:
        # Verify event exists and belongs to user
        event_result = await session.execute(
            select(Event).where(Event.id == data.event_id)
        )
        event = event_result.scalar_one_or_none()
        if not event:
            raise NotFoundException(error="Event not found")
        if event.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this event")

        session_data = data.model_dump()
        if session_data.get("tire_front"):
            session_data["tire_front"] = data.tire_front.model_dump()
        if session_data.get("tire_rear"):
            session_data["tire_rear"] = data.tire_rear.model_dump()

        sess = Session(user_id=user_id, **session_data)
        session.add(sess)
        await session.commit()
        await session.refresh(sess)
        return SessionResponse.model_validate(sess)

    @staticmethod
    async def get_session(
        session: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> SessionDetailResponse:
        result = await session.execute(
            select(Session).where(Session.id == session_id)
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise NotFoundException(error="Session not found")
        if sess.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this session")

        # Fetch snapshots
        snap_result = await session.execute(
            select(SetupSnapshot)
            .where(SetupSnapshot.session_id == session_id)
            .order_by(SetupSnapshot.created_at)
        )
        snapshots = [
            SetupSnapshotResponse.model_validate(s)
            for s in snap_result.scalars().all()
        ]

        # Fetch change log
        cl_result = await session.execute(
            select(ChangeLog)
            .where(ChangeLog.session_id == session_id)
            .order_by(ChangeLog.applied_at)
        )
        changes = [
            ChangeLogResponse.model_validate(c)
            for c in cl_result.scalars().all()
        ]

        session_data = SessionResponse.model_validate(sess).model_dump()
        return SessionDetailResponse(**session_data, snapshots=snapshots, changes=changes)

    @staticmethod
    async def update_session(
        session: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: SessionUpdate,
    ) -> SessionResponse:
        result = await session.execute(
            select(Session).where(Session.id == session_id)
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise NotFoundException(error="Session not found")
        if sess.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this session")

        update_data = data.model_dump(exclude_unset=True)
        if "tire_front" in update_data and update_data["tire_front"] is not None:
            update_data["tire_front"] = data.tire_front.model_dump()
        if "tire_rear" in update_data and update_data["tire_rear"] is not None:
            update_data["tire_rear"] = data.tire_rear.model_dump()

        for field, value in update_data.items():
            setattr(sess, field, value)

        await session.commit()
        await session.refresh(sess)
        return SessionResponse.model_validate(sess)

    # ═══════════════════════ SETUP SNAPSHOTS ═══════════════════════

    @staticmethod
    async def create_setup_snapshot(
        session: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: SetupSnapshotCreate,
    ) -> SetupSnapshotResponse:
        # Verify session exists and belongs to user
        result = await session.execute(
            select(Session).where(Session.id == session_id)
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise NotFoundException(error="Session not found")
        if sess.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this session")

        # Validate suspension spec
        SuspensionSpec.model_validate(data.settings.model_dump())

        snapshot = SetupSnapshot(
            session_id=session_id,
            settings=data.settings.model_dump(),
        )
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        return SetupSnapshotResponse.model_validate(snapshot)

    # ═══════════════════════ CHANGE LOG ═══════════════════════

    @staticmethod
    async def create_change_log_entry(
        session: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ChangeLogCreate,
    ) -> ChangeLogResponse:
        # Verify session exists and belongs to user
        result = await session.execute(
            select(Session).where(Session.id == session_id)
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise NotFoundException(error="Session not found")
        if sess.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this session")

        entry = ChangeLog(
            session_id=session_id,
            parameter=data.parameter,
            from_value=data.from_value,
            to_value=data.to_value,
            rationale=data.rationale,
            applied_at=data.applied_at or datetime.now(timezone.utc),
        )
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return ChangeLogResponse.model_validate(entry)

    @staticmethod
    async def get_change_log(
        session: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> list[ChangeLogResponse]:
        # Verify session exists and belongs to user
        result = await session.execute(
            select(Session).where(Session.id == session_id)
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise NotFoundException(error="Session not found")
        if sess.user_id != user_id:
            raise ForbiddenException(error="You do not have access to this session")

        cl_result = await session.execute(
            select(ChangeLog)
            .where(ChangeLog.session_id == session_id)
            .order_by(ChangeLog.applied_at)
        )
        entries = cl_result.scalars().all()
        return [ChangeLogResponse.model_validate(e) for e in entries]
