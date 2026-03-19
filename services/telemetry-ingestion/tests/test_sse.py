"""Tests for sse.py — SSE stream delivery for job completion."""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.ingestion_job import IngestionStatus
from tests.conftest import JOB_ID, MockResult, SESSION_ID


# ═══════════════════════ _check_job_terminal ═════════════════════════════════


@pytest.mark.asyncio
async def test_check_terminal_complete():
    """A completed job returns the terminal payload immediately."""
    mock_job = MagicMock()
    mock_job.id = JOB_ID
    mock_job.status = IngestionStatus.complete
    mock_job.result = {"channels_found": ["gps_speed"]}
    mock_job.error_message = None

    with patch("sse._DbSession") as mock_session_cls:
        mock_session = AsyncMock()
        mock_session.execute.return_value = MockResult(scalar=mock_job)
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from sse import _check_job_terminal
        result = await _check_job_terminal(JOB_ID)

    assert result is not None
    assert result["status"] == "complete"
    assert result["result"] == {"channels_found": ["gps_speed"]}


@pytest.mark.asyncio
async def test_check_terminal_failed():
    mock_job = MagicMock()
    mock_job.id = JOB_ID
    mock_job.status = IngestionStatus.failed
    mock_job.result = None
    mock_job.error_message = "CSV parse error"

    with patch("sse._DbSession") as mock_session_cls:
        mock_session = AsyncMock()
        mock_session.execute.return_value = MockResult(scalar=mock_job)
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from sse import _check_job_terminal
        result = await _check_job_terminal(JOB_ID)

    assert result is not None
    assert result["status"] == "failed"
    assert result["error"] == "CSV parse error"


@pytest.mark.asyncio
async def test_check_terminal_pending():
    mock_job = MagicMock()
    mock_job.id = JOB_ID
    mock_job.status = IngestionStatus.pending

    with patch("sse._DbSession") as mock_session_cls:
        mock_session = AsyncMock()
        mock_session.execute.return_value = MockResult(scalar=mock_job)
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from sse import _check_job_terminal
        result = await _check_job_terminal(JOB_ID)

    assert result is None


@pytest.mark.asyncio
async def test_check_terminal_not_found():
    with patch("sse._DbSession") as mock_session_cls:
        mock_session = AsyncMock()
        mock_session.execute.return_value = MockResult(scalar=None)
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from sse import _check_job_terminal
        result = await _check_job_terminal(JOB_ID)

    assert result is None


# ═══════════════════════ stream_job ══════════════════════════════════════════


@pytest.mark.asyncio
async def test_stream_already_complete():
    """If job is already complete, stream yields one event and stops."""
    terminal_data = {"job_id": JOB_ID, "status": "complete", "result": {"ok": True}}

    with patch("sse._check_job_terminal", new_callable=AsyncMock, return_value=terminal_data):
        from sse import stream_job

        events = []
        async for event in stream_job(JOB_ID):
            events.append(event)

    assert len(events) == 1
    data = json.loads(events[0].data)
    assert data["status"] == "complete"


@pytest.mark.asyncio
async def test_stream_already_failed():
    terminal_data = {"job_id": JOB_ID, "status": "failed", "error": "boom"}

    with patch("sse._check_job_terminal", new_callable=AsyncMock, return_value=terminal_data):
        from sse import stream_job

        events = []
        async for event in stream_job(JOB_ID):
            events.append(event)

    assert len(events) == 1
    data = json.loads(events[0].data)
    assert data["status"] == "failed"


@pytest.mark.asyncio
async def test_stream_waits_then_completes():
    """Stream initially returns None (pending), then completes via DB poll."""
    call_count = 0

    async def mock_check_terminal(job_id):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return None  # First call: still pending.
        return {"job_id": job_id, "status": "complete", "result": {"done": True}}

    # Mock Redis pubsub to never fire.
    mock_redis = MagicMock()
    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()

    async def listen_forever():
        await asyncio.sleep(10)  # Will be cancelled.
        yield  # Make it an async generator.

    mock_pubsub.listen = listen_forever
    mock_redis.pubsub.return_value = mock_pubsub
    mock_redis.aclose = AsyncMock()

    with (
        patch("sse._check_job_terminal", side_effect=mock_check_terminal),
        patch("sse.aioredis.from_url", return_value=mock_redis),
        patch("sse.POLL_INTERVAL_S", 0.01),  # Speed up polling.
        patch("sse.SSE_TIMEOUT_S", 2.0),
    ):
        from sse import stream_job

        events = []
        async for event in stream_job(JOB_ID):
            events.append(event)

    # Should get: status event + complete event.
    assert len(events) == 2
    assert json.loads(events[0].data)["status"] == "processing"
    assert json.loads(events[1].data)["status"] == "complete"
