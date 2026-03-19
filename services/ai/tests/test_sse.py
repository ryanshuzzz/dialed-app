"""Tests for sse module."""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio


def _mock_request(disconnected: bool = False) -> MagicMock:
    """Create a mock Request with is_disconnected."""
    request = MagicMock()
    request.is_disconnected = AsyncMock(return_value=disconnected)
    return request


# ── Terminal state tests ──


@pytest.mark.asyncio
async def test_terminal_not_found():
    """Job not found in DB → yields failed event with 'Job not found'."""
    from sse import _check_terminal_state

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_factory = MagicMock()
    mock_factory.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.__aexit__ = AsyncMock(return_value=False)

    with patch("sse.async_session_factory", return_value=mock_factory):
        event = await _check_terminal_state(str(uuid.uuid4()))

    assert event is not None
    assert event["event"] == "failed"
    data = json.loads(event["data"])
    assert "not found" in data["error_message"].lower()


@pytest.mark.asyncio
async def test_terminal_failed():
    """Job with status=failed → yields failed event."""
    from sse import _check_terminal_state

    mock_job = MagicMock()
    mock_job.status = "failed"
    mock_job.error_message = "Something went wrong"

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_job
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_factory = MagicMock()
    mock_factory.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.__aexit__ = AsyncMock(return_value=False)

    with patch("sse.async_session_factory", return_value=mock_factory):
        event = await _check_terminal_state(str(uuid.uuid4()))

    assert event is not None
    assert event["event"] == "failed"
    data = json.loads(event["data"])
    assert data["error_message"] == "Something went wrong"


@pytest.mark.asyncio
async def test_terminal_complete():
    """Job with status=complete → yields complete event with suggestion data."""
    from sse import _check_terminal_state

    mock_job = MagicMock()
    mock_job.status = "complete"
    mock_job.session_id = uuid.uuid4()

    # Mock suggestion query
    mock_suggestion = MagicMock()
    mock_suggestion.id = uuid.uuid4()
    mock_suggestion.session_id = mock_job.session_id

    mock_session = AsyncMock()

    # First execute: job lookup, second: suggestion lookup, third: changes lookup
    mock_job_result = MagicMock()
    mock_job_result.scalar_one_or_none.return_value = mock_job

    mock_suggestion_result = MagicMock()
    mock_suggestion_result.scalar_one_or_none.return_value = mock_suggestion

    mock_changes_result = MagicMock()
    mock_changes_result.scalars.return_value.all.return_value = []

    mock_session.execute = AsyncMock(
        side_effect=[mock_job_result, mock_suggestion_result, mock_changes_result]
    )

    mock_factory = MagicMock()
    mock_factory.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.__aexit__ = AsyncMock(return_value=False)

    with patch("sse.async_session_factory", return_value=mock_factory):
        event = await _check_terminal_state(str(uuid.uuid4()))

    assert event is not None
    assert event["event"] == "complete"
    data = json.loads(event["data"])
    assert "suggestion_id" in data
    assert "changes" in data


@pytest.mark.asyncio
async def test_terminal_in_progress_returns_none():
    """Job with status=processing → returns None (not terminal)."""
    from sse import _check_terminal_state

    mock_job = MagicMock()
    mock_job.status = "processing"

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_job
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_factory = MagicMock()
    mock_factory.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.__aexit__ = AsyncMock(return_value=False)

    with patch("sse.async_session_factory", return_value=mock_factory):
        event = await _check_terminal_state(str(uuid.uuid4()))

    assert event is None


# ── Event generator tests ──


@pytest.mark.asyncio
async def test_pubsub_relay():
    """Redis pubsub messages are relayed as SSE events."""
    from sse import _event_generator

    # Mock terminal state check → None (not terminal)
    with patch("sse._check_terminal_state", new_callable=AsyncMock, return_value=None):
        # Mock Redis client and pubsub
        mock_pubsub = AsyncMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.aclose = AsyncMock()

        messages = [
            {"type": "message", "data": json.dumps({"event": "status", "data": {"status": "processing"}})},
            {"type": "message", "data": json.dumps({"event": "token", "data": "chunk1"})},
            {"type": "message", "data": json.dumps({"event": "complete", "data": {"suggestion_id": "123", "changes": []}})},
        ]
        call_count = 0

        async def get_message_side_effect(**kwargs):
            nonlocal call_count
            if call_count < len(messages):
                msg = messages[call_count]
                call_count += 1
                return msg
            return None

        mock_pubsub.get_message = AsyncMock(side_effect=get_message_side_effect)

        mock_redis = MagicMock()
        mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
        mock_redis.aclose = AsyncMock()

        request = _mock_request(disconnected=False)

        with patch("sse.aioredis.from_url", return_value=mock_redis):
            events = []
            async for event in _event_generator(str(uuid.uuid4()), request):
                events.append(event)

    assert len(events) == 3
    assert events[0]["event"] == "status"
    assert events[1]["event"] == "token"
    assert events[2]["event"] == "complete"


@pytest.mark.asyncio
async def test_client_disconnect_stops_stream():
    """When client disconnects, generator stops."""
    from sse import _event_generator

    with patch("sse._check_terminal_state", new_callable=AsyncMock, return_value=None):
        mock_pubsub = AsyncMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.aclose = AsyncMock()
        mock_pubsub.get_message = AsyncMock(return_value=None)

        mock_redis = MagicMock()
        mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
        mock_redis.aclose = AsyncMock()

        # Client disconnects immediately
        request = _mock_request(disconnected=True)

        with patch("sse.aioredis.from_url", return_value=mock_redis):
            events = []
            async for event in _event_generator(str(uuid.uuid4()), request):
                events.append(event)

    assert len(events) == 0
