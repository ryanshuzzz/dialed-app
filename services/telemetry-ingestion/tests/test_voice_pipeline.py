"""Tests for pipelines/voice_pipeline.py — transcription and entity extraction."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from pipelines.voice_pipeline import (
    _validate_audio_file,
    extract_entities,
    transcribe_voice_note,
)


# ═══════════════════════ _validate_audio_file ════════════════════════════════


class TestValidateAudioFile:
    def test_valid_mp3(self, test_audio_path):
        path = _validate_audio_file(test_audio_path)
        assert path.suffix == ".mp3"

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            _validate_audio_file("/nonexistent/audio.mp3")

    def test_empty_file(self, tmp_path):
        path = tmp_path / "empty.mp3"
        path.write_bytes(b"")
        with pytest.raises(ValueError, match="empty"):
            _validate_audio_file(str(path))

    def test_unsupported_format(self, tmp_path):
        path = tmp_path / "audio.aac"
        path.write_bytes(b"\x00" * 100)
        with pytest.raises(ValueError, match="Unsupported audio format"):
            _validate_audio_file(str(path))


# ═══════════════════════ transcribe_voice_note ═══════════════════════════════


class TestTranscribeVoiceNote:
    @pytest.mark.asyncio
    async def test_successful_transcription(self, test_audio_path, mock_whisper_transcript):
        mock_resp = AsyncMock()
        mock_resp.text = mock_whisper_transcript
        mock_resp.raise_for_status = lambda: None

        with patch("pipelines.voice_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await transcribe_voice_note(test_audio_path, "sk-openai-key")

        assert "front rebound" in result
        assert "1:32.456" in result

    @pytest.mark.asyncio
    async def test_empty_transcript_raises(self, test_audio_path):
        mock_resp = AsyncMock()
        mock_resp.text = ""
        mock_resp.raise_for_status = lambda: None

        with patch("pipelines.voice_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(ValueError, match="empty transcript"):
                await transcribe_voice_note(test_audio_path, "sk-key")

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            await transcribe_voice_note("/nonexistent.mp3", "sk-key")

    @pytest.mark.asyncio
    async def test_sends_correct_auth_header(self, test_audio_path, mock_whisper_transcript):
        mock_resp = AsyncMock()
        mock_resp.text = mock_whisper_transcript
        mock_resp.raise_for_status = lambda: None

        with patch("pipelines.voice_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            await transcribe_voice_note(test_audio_path, "sk-byok-key")

        headers = mock_client.post.call_args.kwargs.get("headers", {})
        assert headers["Authorization"] == "Bearer sk-byok-key"


# ═══════════════════════ extract_entities ═════════════════════════════════════


class TestExtractEntities:
    def test_change_mentions(self, mock_whisper_transcript):
        result = extract_entities(mock_whisper_transcript)

        params = {m["parameter"] for m in result.setting_mentions}
        assert "front.rebound" in params

        # Check action and value.
        rebound_mention = next(m for m in result.setting_mentions if m["parameter"] == "front.rebound")
        assert rebound_mention["action"] == "added"
        assert "2" in rebound_mention["value"]

    def test_absolute_mentions(self, mock_whisper_transcript):
        result = extract_entities(mock_whisper_transcript)

        params = {m["parameter"] for m in result.setting_mentions}
        # "Front compression is at 12" should be detected.
        assert "front.compression" in params

    def test_lap_times_extracted(self, mock_whisper_transcript):
        result = extract_entities(mock_whisper_transcript)

        assert "1:32.456" in result.lap_times

    def test_feedback_returned(self, mock_whisper_transcript):
        result = extract_entities(mock_whisper_transcript)

        assert result.feedback is not None
        assert len(result.feedback) > 10

    def test_confidence_with_mentions(self, mock_whisper_transcript):
        result = extract_entities(mock_whisper_transcript)

        # With multiple mentions + a long transcript, confidence should be > 0.5.
        assert result.confidence > 0.5

    def test_empty_transcript(self):
        result = extract_entities("")

        assert result.transcript == ""
        assert result.confidence == 0.0
        assert result.setting_mentions == []
        assert result.lap_times == []

    def test_short_transcript_no_feedback(self):
        result = extract_entities("ok")

        assert result.feedback is None
        assert result.confidence == 0.5  # Baseline.

    def test_verbal_lap_time(self):
        result = extract_entities("My best time was 1 minute 28 seconds today")

        assert "1:28" in result.lap_times

    def test_fork_alias(self):
        result = extract_entities("I added 3 clicks of fork rebound")

        params = {m["parameter"] for m in result.setting_mentions}
        assert "front.rebound" in params

    def test_shock_alias(self):
        result = extract_entities("shock compression to 14")

        params = {m["parameter"] for m in result.setting_mentions}
        assert "rear.compression" in params

    def test_removed_action(self):
        result = extract_entities("removed 1 click of rear rebound")

        mention = next(m for m in result.setting_mentions if m["parameter"] == "rear.rebound")
        assert mention["action"] == "removed"

    def test_no_duplicates(self):
        result = extract_entities(
            "added 2 clicks of front rebound. I added 2 clicks of front rebound again."
        )

        rebound_mentions = [m for m in result.setting_mentions if m["parameter"] == "front.rebound"]
        assert len(rebound_mentions) == 1
