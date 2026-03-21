"""Session service — sessions, setup snapshots, change log, tracks, events."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import date, datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.errors import (
    ForbiddenException,
    NotFoundException,
    ValidationException,
)

logger = logging.getLogger(__name__)

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
    EventVenue,
)
from schemas.sessions import (
    ROAD_SESSION_TYPES,
    TRACK_SESSION_TYPES,
    ChangeLogCreate,
    ChangeLogResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
    SessionType,
    SessionUpdate,
    SetupSnapshotCreate,
    SetupSnapshotResponse,
)
from schemas.tracks import TrackCreate, TrackResponse, TrackUpdate


async def _publish_session_created(sess: "Session") -> None:  # noqa: F821
    """Publish a session.created event to the Redis Stream of the same name.

    Fields: session_id, event_id, user_id, session_type.
    Failures are logged and swallowed so they never roll back a committed session.
    """
    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379")
    client = aioredis.from_url(redis_url, decode_responses=True)
    try:
        await client.xadd(
            "session.created",
            {
                "session_id": str(sess.id),
                "event_id": str(sess.event_id),
                "user_id": str(sess.user_id),
                "session_type": str(sess.session_type),
            },
        )
        logger.info(
            "Published session.created event for session_id=%s", sess.id
        )
    except Exception:
        logger.exception(
            "Failed to publish session.created event for session_id=%s", sess.id
        )
    finally:
        await client.aclose()


class SessionService:

    @staticmethod
    def _normalize_new_event(data: EventCreate) -> tuple[str, uuid.UUID | None, dict | None]:
        """Return (venue, track_id, ride_location dict or None)."""
        venue = data.venue
        if venue is None:
            if data.track_id is not None:
                venue = EventVenue.track
            elif data.ride_location is not None:
                venue = EventVenue.road
            else:
                raise ValidationException(
                    error="Provide track_id for a track event or ride_location for a road event",
                )
        if venue == EventVenue.track:
            if data.track_id is None:
                raise ValidationException(error="track_id is required for track events")
            return venue.value, data.track_id, None
        if data.track_id is not None:
            raise ValidationException(error="track_id must be null for road events")
        if data.ride_location is None:
            raise ValidationException(error="ride_location is required for road events")
        loc = data.ride_location
        has_label = loc.label and str(loc.label).strip()
        has_sources = loc.sources and len(loc.sources) > 0
        if not has_label and not has_sources:
            raise ValidationException(
                error="ride_location must include a label or at least one source",
            )
        return venue.value, None, loc.model_dump()

    @staticmethod
    def _assert_event_consistency(
        venue: str,
        track_id: uuid.UUID | None,
        ride_location: dict | None,
    ) -> None:
        if venue == EventVenue.track.value:
            if track_id is None:
                raise ValidationException(error="Track events require track_id")
        elif venue == EventVenue.road.value:
            if track_id is not None:
                raise ValidationException(error="Road events cannot have track_id")
            if ride_location is None:
                raise ValidationException(error="Road events require ride_location")
            has_label = ride_location.get("label") and str(ride_location["label"]).strip()
            has_sources = ride_location.get("sources") and len(ride_location["sources"]) > 0
            if not has_label and not has_sources:
                raise ValidationException(
                    error="ride_location must include a label or at least one source",
                )

    @staticmethod
    def _assert_session_type_for_event(session_type: SessionType, event_venue: str) -> None:
        if event_venue == EventVenue.track.value:
            if session_type not in TRACK_SESSION_TYPES:
                raise ValidationException(
                    error="session_type must be practice, qualifying, race, or trackday for track events",
                )
        elif event_venue == EventVenue.road.value:
            if session_type not in ROAD_SESSION_TYPES:
                raise ValidationException(
                    error="session_type must be road, commute, or tour for road events",
                )

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
        venue: str | None = None,
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
        if venue is not None:
            stmt = stmt.where(Event.venue == venue)
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

        v_str, tid, rloc = SessionService._normalize_new_event(data)
        event = Event(
            user_id=user_id,
            bike_id=data.bike_id,
            venue=v_str,
            track_id=tid,
            ride_location=rloc,
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
        if "ride_location" in update_data and update_data["ride_location"] is not None:
            update_data["ride_location"] = data.ride_location.model_dump()

        for field, value in update_data.items():
            setattr(event, field, value)

        SessionService._assert_event_consistency(
            event.venue,
            event.track_id,
            event.ride_location,
        )

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
        bike_id: uuid.UUID | None = None,
        venue: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[SessionResponse]:
        stmt = select(Session).where(Session.user_id == user_id)
        need_event = (
            bike_id is not None
            or venue is not None
            or from_date is not None
            or to_date is not None
        )
        if need_event:
            stmt = stmt.join(Event, Session.event_id == Event.id)
        if event_id:
            stmt = stmt.where(Session.event_id == event_id)
        if bike_id is not None:
            stmt = stmt.where(Event.bike_id == bike_id)
        if venue is not None:
            stmt = stmt.where(Event.venue == venue)
        if from_date is not None:
            stmt = stmt.where(Event.date >= from_date)
        if to_date is not None:
            stmt = stmt.where(Event.date <= to_date)

        stmt = stmt.order_by(Session.created_at.desc())

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

        SessionService._assert_session_type_for_event(data.session_type, event.venue)

        session_data = data.model_dump()
        if session_data.get("tire_front"):
            session_data["tire_front"] = data.tire_front.model_dump()
        if session_data.get("tire_rear"):
            session_data["tire_rear"] = data.tire_rear.model_dump()
        if session_data.get("ride_metrics"):
            session_data["ride_metrics"] = data.ride_metrics.model_dump()

        sess = Session(user_id=user_id, **session_data)
        session.add(sess)
        await session.commit()
        await session.refresh(sess)

        await _publish_session_created(sess)

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
        if "ride_metrics" in update_data and update_data["ride_metrics"] is not None:
            update_data["ride_metrics"] = data.ride_metrics.model_dump()

        for field, value in update_data.items():
            setattr(sess, field, value)

        if "session_type" in update_data:
            ev_result = await session.execute(select(Event).where(Event.id == sess.event_id))
            ev = ev_result.scalar_one()
            SessionService._assert_session_type_for_event(
                SessionType(sess.session_type),
                ev.venue,
            )

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
            ecu_data=data.ecu_data,
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
