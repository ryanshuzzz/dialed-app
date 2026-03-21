"""Gathers all context needed for suggestion generation from Core API and Telemetry.

Makes async HTTP calls to collect session detail, change log, bike spec,
maintenance history, event sessions, track info, conditions, and optionally
telemetry analysis. Packages everything into a SessionContext dataclass.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger("ai")

_CORE_TIMEOUT = 10.0  # seconds
_TELEMETRY_TIMEOUT = 30.0  # seconds


@dataclass
class SessionContext:
    """All gathered context for a single suggestion generation job."""

    # Core session data
    session: dict = field(default_factory=dict)
    change_log: list[dict] = field(default_factory=list)

    # Bike data
    bike: dict = field(default_factory=dict)
    suspension_spec: dict = field(default_factory=dict)
    maintenance: list[dict] = field(default_factory=list)

    # Event & track data
    event_sessions: list[dict] = field(default_factory=list)
    track: dict = field(default_factory=dict)
    conditions: dict = field(default_factory=dict)

    # Telemetry (optional)
    telemetry_analysis: dict | None = None

    # User profile
    user_profile: dict = field(default_factory=dict)


class ContextGatherer:
    """Gathers context from Core API and Telemetry service via HTTP."""

    def __init__(
        self,
        core_api_url: str,
        telemetry_url: str,
        internal_token: str,
    ) -> None:
        self._core_api_url = core_api_url.rstrip("/")
        self._telemetry_url = telemetry_url.rstrip("/")
        self._headers = {"X-Internal-Token": internal_token}

    async def gather(self, session_id: str) -> SessionContext:
        """Gather all context needed for suggestion generation.

        Args:
            session_id: The session to gather context for.

        Returns:
            SessionContext with all available data populated.

        Raises:
            httpx.HTTPStatusError: If required Core API calls fail (session
                detail or bike detail).
        """
        ctx = SessionContext()

        async with httpx.AsyncClient(
            headers=self._headers, timeout=_CORE_TIMEOUT
        ) as client:
            # Phase 1: session detail + change log (independent, parallel)
            ctx.session, ctx.change_log = await self._fetch_session_and_changes(
                client, session_id
            )

            # Extract IDs for phase 2
            event_id = ctx.session.get("event_id")
            bike_id = None
            user_id = ctx.session.get("user_id")

            # Session may have bike_id directly, or we get it from the event
            if event_id:
                event = await self._fetch_event(client, event_id)
                if event:
                    bike_id = event.get("bike_id")
                    ctx.track = event.get("track", {}) or {}
                    ctx.conditions = event.get("conditions", {}) or {}
                    # If track is just an ID, try to fetch full track
                    track_id = event.get("track_id")
                    if track_id and not ctx.track:
                        ctx.track = await self._fetch_track(client, track_id)

            # Phase 2: bike, maintenance, event sessions (parallel)
            if bike_id:
                ctx.bike = await self._fetch_bike(client, bike_id)
                ctx.suspension_spec = ctx.bike.get("suspension_spec", {}) or {}
                ctx.maintenance = await self._fetch_maintenance(client, bike_id)

            if event_id:
                ctx.event_sessions = await self._fetch_event_sessions(
                    client, event_id
                )

            # User profile for skill_level / rider_type
            if user_id:
                ctx.user_profile = await self._fetch_user_profile(client, user_id)

        # Phase 3: Telemetry (separate client with longer timeout, optional)
        ctx.telemetry_analysis = await self._fetch_telemetry(session_id)

        return ctx

    # ── Core API fetchers ──

    async def _fetch_session_and_changes(
        self, client: httpx.AsyncClient, session_id: str
    ) -> tuple[dict, list[dict]]:
        """Fetch session detail and change log."""
        session_url = f"{self._core_api_url}/sessions/{session_id}"
        changes_url = f"{self._core_api_url}/sessions/{session_id}/changes"

        session_resp = await client.get(session_url)
        session_resp.raise_for_status()
        session_data = session_resp.json()

        try:
            changes_resp = await client.get(changes_url)
            changes_resp.raise_for_status()
            change_log = changes_resp.json()
            if not isinstance(change_log, list):
                change_log = change_log.get("items", [])
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Failed to fetch change log for session %s: %s", session_id, exc)
            change_log = []

        return session_data, change_log

    async def _fetch_event(self, client: httpx.AsyncClient, event_id: str) -> dict | None:
        """Fetch event detail (includes track_id, conditions)."""
        try:
            resp = await client.get(f"{self._core_api_url}/garage/events/{event_id}")
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Failed to fetch event %s: %s", event_id, exc)
            return None

    async def _fetch_track(self, client: httpx.AsyncClient, track_id: str) -> dict:
        """Fetch track detail."""
        try:
            resp = await client.get(f"{self._core_api_url}/garage/tracks/{track_id}")
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Failed to fetch track %s: %s", track_id, exc)
            return {}

    async def _fetch_bike(self, client: httpx.AsyncClient, bike_id: str) -> dict:
        """Fetch bike detail including suspension_spec."""
        resp = await client.get(f"{self._core_api_url}/garage/bikes/{bike_id}")
        resp.raise_for_status()
        return resp.json()

    async def _fetch_maintenance(
        self, client: httpx.AsyncClient, bike_id: str
    ) -> list[dict]:
        """Fetch recent maintenance logs for the bike."""
        try:
            resp = await client.get(
                f"{self._core_api_url}/garage/bikes/{bike_id}/maintenance"
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return data.get("items", [])
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Failed to fetch maintenance for bike %s: %s", bike_id, exc)
            return []

    async def _fetch_event_sessions(
        self, client: httpx.AsyncClient, event_id: str
    ) -> list[dict]:
        """Fetch all sessions for the same event (for progression context)."""
        try:
            resp = await client.get(
                f"{self._core_api_url}/sessions",
                params={"event_id": event_id},
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return data.get("items", [])
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Failed to fetch event sessions for event %s: %s", event_id, exc)
            return []

    async def _fetch_user_profile(
        self, client: httpx.AsyncClient, user_id: str
    ) -> dict:
        """Fetch user profile for skill_level and rider_type."""
        try:
            resp = await client.get(f"{self._core_api_url}/auth/me")
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Failed to fetch user profile: %s", exc)
            return {}

    # ── Telemetry fetcher ──

    async def _fetch_telemetry(self, session_id: str) -> dict | None:
        """Fetch telemetry analysis, gracefully handling failures.

        Uses a separate client with a longer timeout. If the telemetry
        service is unavailable or returns an error, returns None and logs
        a warning — the suggestion will be generated without telemetry.
        """
        try:
            async with httpx.AsyncClient(
                headers=self._headers, timeout=_TELEMETRY_TIMEOUT
            ) as client:
                resp = await client.get(
                    f"{self._telemetry_url}/telemetry/{session_id}/analysis"
                )
                resp.raise_for_status()
                return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException) as exc:
            logger.warning(
                "Telemetry unavailable for session %s (continuing without): %s",
                session_id,
                exc,
            )
            return None
