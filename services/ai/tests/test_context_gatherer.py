"""Tests for services.context_gatherer."""

from __future__ import annotations

import uuid

import httpx
import pytest
import pytest_asyncio
import respx

from services.context_gatherer import ContextGatherer, SessionContext


CORE_API_URL = "http://core-api:8001"
TELEMETRY_URL = "http://telemetry-ingestion:8002"
INTERNAL_TOKEN = "test-token"

SESSION_ID = str(uuid.uuid4())
EVENT_ID = str(uuid.uuid4())
BIKE_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())


def _gatherer() -> ContextGatherer:
    return ContextGatherer(
        core_api_url=CORE_API_URL,
        telemetry_url=TELEMETRY_URL,
        internal_token=INTERNAL_TOKEN,
    )


def _mock_session_response() -> dict:
    return {
        "id": SESSION_ID,
        "event_id": EVENT_ID,
        "user_id": USER_ID,
        "session_type": "qualifying",
        "rider_feedback": "front push",
        "csv_best_lap_ms": 98500,
    }


def _mock_event_response() -> dict:
    return {
        "id": EVENT_ID,
        "bike_id": BIKE_ID,
        "track": {"name": "Laguna Seca", "track_type": "technical"},
        "conditions": {"weather": "sunny", "temp_c": 25},
    }


def _mock_bike_response() -> dict:
    return {
        "id": BIKE_ID,
        "make": "Ducati",
        "model": "Panigale V4R",
        "suspension_spec": {"front": {"compression": 12}},
    }


# ── Tests ──


@pytest.mark.asyncio
@respx.mock
async def test_gather_assembles_full_context():
    """Happy path: all Core API calls succeed."""
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}").mock(
        return_value=httpx.Response(200, json=_mock_session_response())
    )
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}/changes").mock(
        return_value=httpx.Response(200, json=[{"parameter": "front.compression", "to_value": "12"}])
    )
    respx.get(f"{CORE_API_URL}/events/{EVENT_ID}").mock(
        return_value=httpx.Response(200, json=_mock_event_response())
    )
    respx.get(f"{CORE_API_URL}/garage/bikes/{BIKE_ID}").mock(
        return_value=httpx.Response(200, json=_mock_bike_response())
    )
    respx.get(f"{CORE_API_URL}/garage/bikes/{BIKE_ID}/maintenance").mock(
        return_value=httpx.Response(200, json=[{"category": "oil_change"}])
    )
    respx.get(f"{CORE_API_URL}/sessions").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/auth/me").mock(
        return_value=httpx.Response(200, json={"skill_level": "intermediate"})
    )
    respx.get(f"{TELEMETRY_URL}/telemetry/{SESSION_ID}/analysis").mock(
        return_value=httpx.Response(200, json={"braking_zones": []})
    )

    ctx = await _gatherer().gather(SESSION_ID)

    assert ctx.session["id"] == SESSION_ID
    assert ctx.bike["make"] == "Ducati"
    assert ctx.suspension_spec == {"front": {"compression": 12}}
    assert len(ctx.change_log) == 1
    assert ctx.track["name"] == "Laguna Seca"
    assert ctx.conditions["weather"] == "sunny"
    assert len(ctx.maintenance) == 1
    assert ctx.user_profile["skill_level"] == "intermediate"
    assert ctx.telemetry_analysis == {"braking_zones": []}


@pytest.mark.asyncio
@respx.mock
async def test_telemetry_failure_graceful():
    """Telemetry service failure returns None, doesn't crash."""
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}").mock(
        return_value=httpx.Response(200, json=_mock_session_response())
    )
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}/changes").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/events/{EVENT_ID}").mock(
        return_value=httpx.Response(200, json=_mock_event_response())
    )
    respx.get(f"{CORE_API_URL}/garage/bikes/{BIKE_ID}").mock(
        return_value=httpx.Response(200, json=_mock_bike_response())
    )
    respx.get(f"{CORE_API_URL}/garage/bikes/{BIKE_ID}/maintenance").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/sessions").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/auth/me").mock(
        return_value=httpx.Response(200, json={})
    )
    # Telemetry returns 500
    respx.get(f"{TELEMETRY_URL}/telemetry/{SESSION_ID}/analysis").mock(
        return_value=httpx.Response(500, json={"error": "Internal error"})
    )

    ctx = await _gatherer().gather(SESSION_ID)

    assert ctx.telemetry_analysis is None
    assert ctx.bike["make"] == "Ducati"  # rest still works


@pytest.mark.asyncio
@respx.mock
async def test_change_log_failure_graceful():
    """Change log 404 → empty list, doesn't crash."""
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}").mock(
        return_value=httpx.Response(200, json=_mock_session_response())
    )
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}/changes").mock(
        return_value=httpx.Response(404, json={"error": "Not found"})
    )
    respx.get(f"{CORE_API_URL}/events/{EVENT_ID}").mock(
        return_value=httpx.Response(200, json=_mock_event_response())
    )
    respx.get(f"{CORE_API_URL}/garage/bikes/{BIKE_ID}").mock(
        return_value=httpx.Response(200, json=_mock_bike_response())
    )
    respx.get(f"{CORE_API_URL}/garage/bikes/{BIKE_ID}/maintenance").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/sessions").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/auth/me").mock(
        return_value=httpx.Response(200, json={})
    )
    respx.get(f"{TELEMETRY_URL}/telemetry/{SESSION_ID}/analysis").mock(
        return_value=httpx.Response(200, json={})
    )

    ctx = await _gatherer().gather(SESSION_ID)

    assert ctx.change_log == []
    assert ctx.session["id"] == SESSION_ID


@pytest.mark.asyncio
@respx.mock
async def test_event_failure_graceful():
    """Event fetch failure → no track/conditions, but doesn't crash."""
    session_data = _mock_session_response()

    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}").mock(
        return_value=httpx.Response(200, json=session_data)
    )
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}/changes").mock(
        return_value=httpx.Response(200, json=[])
    )
    # Event returns 500
    respx.get(f"{CORE_API_URL}/events/{EVENT_ID}").mock(
        return_value=httpx.Response(500, json={"error": "fail"})
    )
    # event_sessions still fetched because event_id is in session data
    respx.get(f"{CORE_API_URL}/sessions").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{CORE_API_URL}/auth/me").mock(
        return_value=httpx.Response(200, json={})
    )
    respx.get(f"{TELEMETRY_URL}/telemetry/{SESSION_ID}/analysis").mock(
        return_value=httpx.Response(200, json={})
    )

    ctx = await _gatherer().gather(SESSION_ID)

    assert ctx.track == {}
    assert ctx.conditions == {}
    assert ctx.bike == {}


@pytest.mark.asyncio
@respx.mock
async def test_internal_token_header_sent():
    """X-Internal-Token header is sent on all requests."""
    session_route = respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}").mock(
        return_value=httpx.Response(200, json={**_mock_session_response(), "event_id": None, "user_id": None})
    )
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}/changes").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{TELEMETRY_URL}/telemetry/{SESSION_ID}/analysis").mock(
        return_value=httpx.Response(200, json={})
    )

    await _gatherer().gather(SESSION_ID)

    assert session_route.calls[0].request.headers["x-internal-token"] == INTERNAL_TOKEN


@pytest.mark.asyncio
@respx.mock
async def test_session_not_found_raises():
    """Session 404 → raises HTTPStatusError."""
    respx.get(f"{CORE_API_URL}/sessions/{SESSION_ID}").mock(
        return_value=httpx.Response(404, json={"error": "Not found"})
    )

    with pytest.raises(httpx.HTTPStatusError):
        await _gatherer().gather(SESSION_ID)
