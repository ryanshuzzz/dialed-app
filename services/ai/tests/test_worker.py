"""Tests for worker.handle_job."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from rules_engine import Flag
from services.context_gatherer import SessionContext


# ── Mock helpers ──


def _sample_payload() -> dict:
    return {
        "job_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "internal_token": "test-token",
    }


def _sample_context() -> SessionContext:
    return SessionContext(
        session={"rider_feedback": "front push", "id": str(uuid.uuid4())},
        change_log=[],
        bike={"make": "Ducati", "model": "V4R"},
        suspension_spec={"front": {"compression": 10}},
        track={"name": "Laguna Seca"},
        conditions={},
        user_profile={"skill_level": "intermediate"},
    )


class MockStream:
    """Mock for anthropic client.messages.stream context manager."""

    def __init__(self, chunks: list[str] | None = None):
        self._chunks = chunks or ["Here is my ", "recommendation: ", "front.compression → +2 clicks"]

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    @property
    def text_stream(self):
        return self._aiter()

    async def _aiter(self):
        for chunk in self._chunks:
            yield chunk


def _setup_worker_mocks():
    """Patch all external dependencies of worker.handle_job."""
    patches = {}

    # Mock Redis
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_redis.aclose = AsyncMock()
    patches["redis"] = patch("worker.aioredis.from_url", return_value=mock_redis)

    # Mock _update_job_status
    patches["status"] = patch("worker._update_job_status", new_callable=AsyncMock)

    # Mock ContextGatherer
    mock_gatherer_instance = AsyncMock()
    mock_gatherer_instance.gather = AsyncMock(return_value=_sample_context())
    mock_gatherer_cls = MagicMock(return_value=mock_gatherer_instance)
    patches["gatherer"] = patch("worker.ContextGatherer", mock_gatherer_cls)

    # Mock rules engine
    patches["rules"] = patch(
        "worker.run_rules_engine",
        return_value=[
            Flag("front push", "front.compression", "+2 clicks", 0.9, "diving"),
        ],
    )

    # Mock prompt builder
    patches["prompt"] = patch(
        "worker.build_prompt",
        return_value=("system prompt", "user prompt"),
    )

    # Mock response parser
    from llm.response_parser import ParsedChange
    patches["parser"] = patch(
        "worker.parse_suggestion_response",
        return_value=[
            ParsedChange("front.compression", "+2 clicks", "front push", 0.85, "diving"),
        ],
    )

    # Mock DB session factory
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.__aexit__ = AsyncMock(return_value=False)
    mock_factory_fn = MagicMock(return_value=mock_factory)
    patches["db"] = patch("worker.async_session_factory", mock_factory_fn)

    # Mock Anthropic client
    mock_client = MagicMock()
    mock_client.messages.stream = MagicMock(return_value=MockStream())
    patches["anthropic"] = patch("worker.anthropic.AsyncAnthropic", return_value=mock_client)

    # Mock API key
    patches["api_key"] = patch("worker.ANTHROPIC_API_KEY", "test-key")

    return patches, mock_redis, mock_session


# ── Tests ──


@pytest.mark.asyncio
async def test_handle_job_success():
    """Full pipeline: processing → streaming → complete."""
    from worker import handle_job

    patches, mock_redis, mock_session = _setup_worker_mocks()

    with (
        patches["redis"],
        patches["status"] as mock_status,
        patches["gatherer"],
        patches["rules"],
        patches["prompt"],
        patches["parser"],
        patches["db"],
        patches["anthropic"],
        patches["api_key"],
    ):
        await handle_job(_sample_payload())

        # Verify status transitions
        status_calls = [call.args for call in mock_status.call_args_list]
        statuses = [call[1] for call in status_calls]
        assert "processing" in statuses
        assert "streaming" in statuses
        assert "complete" in statuses

        # Verify suggestion persisted (session.add called)
        assert mock_session.add.call_count >= 1
        assert mock_session.commit.called

        # Verify pubsub events published
        assert mock_redis.publish.call_count >= 3  # processing, streaming, tokens, complete


@pytest.mark.asyncio
async def test_handle_job_failure():
    """Context gathering failure → status=failed, failed event published."""
    from worker import handle_job

    patches, mock_redis, _ = _setup_worker_mocks()

    # Make context gathering raise
    mock_gatherer = AsyncMock()
    mock_gatherer.gather = AsyncMock(side_effect=Exception("Connection refused"))
    with (
        patches["redis"],
        patches["status"] as mock_status,
        patch("worker.ContextGatherer", return_value=mock_gatherer),
        patches["db"],
        patches["api_key"],
    ):
        await handle_job(_sample_payload())

        # Should have set status to failed
        status_calls = [call.args for call in mock_status.call_args_list]
        statuses = [call[1] for call in status_calls]
        assert "failed" in statuses

        # Should have published a failed event
        publish_calls = mock_redis.publish.call_args_list
        published_events = []
        import json
        for call in publish_calls:
            try:
                msg = json.loads(call.args[1])
                published_events.append(msg.get("event"))
            except (json.JSONDecodeError, IndexError):
                pass
        assert "failed" in published_events


@pytest.mark.asyncio
async def test_handle_job_no_api_key():
    """No API key → ValueError, status=failed."""
    from worker import handle_job

    patches, mock_redis, _ = _setup_worker_mocks()

    with (
        patches["redis"],
        patches["status"] as mock_status,
        patches["gatherer"],
        patches["rules"],
        patches["prompt"],
        patches["db"],
        patch("worker.ANTHROPIC_API_KEY", ""),
    ):
        # User profile also has no key
        await handle_job(_sample_payload())

        status_calls = [call.args for call in mock_status.call_args_list]
        statuses = [call[1] for call in status_calls]
        assert "failed" in statuses


@pytest.mark.asyncio
async def test_handle_job_empty_response():
    """Claude returns empty text → suggestion with 0 changes is still created."""
    from worker import handle_job

    patches, mock_redis, mock_session = _setup_worker_mocks()

    # Empty stream
    mock_client = MagicMock()
    mock_client.messages.stream = MagicMock(return_value=MockStream(chunks=[""]))

    from llm.response_parser import ParsedChange
    with (
        patches["redis"],
        patches["status"] as mock_status,
        patches["gatherer"],
        patches["rules"],
        patches["prompt"],
        patch("worker.parse_suggestion_response", return_value=[]),
        patches["db"],
        patch("worker.anthropic.AsyncAnthropic", return_value=mock_client),
        patches["api_key"],
    ):
        await handle_job(_sample_payload())

        status_calls = [call.args for call in mock_status.call_args_list]
        statuses = [call[1] for call in status_calls]
        assert "complete" in statuses
        # Suggestion row still added (just 0 changes)
        assert mock_session.add.called


@pytest.mark.asyncio
async def test_handle_job_publishes_token_events():
    """Each text chunk from Claude is published as a token event."""
    from worker import handle_job
    import json

    patches, mock_redis, _ = _setup_worker_mocks()

    with (
        patches["redis"],
        patches["status"],
        patches["gatherer"],
        patches["rules"],
        patches["prompt"],
        patches["parser"],
        patches["db"],
        patches["anthropic"],
        patches["api_key"],
    ):
        await handle_job(_sample_payload())

        publish_calls = mock_redis.publish.call_args_list
        token_events = []
        for call in publish_calls:
            try:
                msg = json.loads(call.args[1])
                if msg.get("event") == "token":
                    token_events.append(msg)
            except (json.JSONDecodeError, IndexError):
                pass
        # MockStream yields 3 chunks
        assert len(token_events) == 3
