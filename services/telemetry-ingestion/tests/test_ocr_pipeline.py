"""Tests for pipelines/ocr_pipeline.py — OCR extraction, confidence, error handling."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from pipelines.ocr_pipeline import (
    OcrResult,
    _detect_media_type,
    _parse_response,
    _read_and_encode,
    extract_setup_sheet,
)


# ═══════════════════════ _detect_media_type ══════════════════════════════════


class TestDetectMediaType:
    def test_jpeg(self, test_image_path):
        assert _detect_media_type(test_image_path) == "image/jpeg"

    def test_heic(self, tmp_path):
        path = tmp_path / "photo.heic"
        path.write_bytes(b"\x00" * 10)
        assert _detect_media_type(str(path)) == "image/heic"

    def test_unsupported_format(self, unsupported_image_path):
        with pytest.raises(ValueError, match="Unsupported image format"):
            _detect_media_type(unsupported_image_path)

    def test_unknown_extension(self, tmp_path):
        path = tmp_path / "photo.xyz"
        path.write_bytes(b"\x00" * 10)
        with pytest.raises(ValueError, match="Cannot determine"):
            _detect_media_type(str(path))


# ═══════════════════════ _read_and_encode ════════════════════════════════════


class TestReadAndEncode:
    def test_valid_image(self, test_image_path):
        b64, media_type = _read_and_encode(test_image_path)
        assert len(b64) > 0
        assert media_type == "image/jpeg"

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            _read_and_encode("/nonexistent/path.jpg")

    def test_empty_file(self, empty_image_path):
        with pytest.raises(ValueError, match="empty"):
            _read_and_encode(empty_image_path)


# ═══════════════════════ _parse_response ═════════════════════════════════════


class TestParseResponse:
    def test_valid_json(self):
        raw = json.dumps({
            "schema_version": 1,
            "front": {"compression": 12, "rebound": 8, "preload": 5, "spring_rate": None, "oil_level": 120, "ride_height": None},
            "rear": {"compression": 10, "rebound": 6, "preload": 3, "spring_rate": None, "oil_level": None, "ride_height": None},
            "confidence": 0.85,
        })
        settings, confidence = _parse_response(raw)

        assert settings["schema_version"] == 1
        assert settings["front"]["compression"] == 12
        assert settings["rear"]["rebound"] == 6
        assert confidence == 0.85

    def test_markdown_fences_stripped(self):
        raw = '```json\n{"schema_version": 1, "front": {}, "rear": {}, "confidence": 0.7}\n```'
        settings, confidence = _parse_response(raw)

        assert settings["schema_version"] == 1
        assert confidence == 0.7

    def test_missing_confidence_defaults(self):
        raw = json.dumps({"schema_version": 1, "front": {}, "rear": {}})
        settings, confidence = _parse_response(raw)

        assert confidence == 0.5  # Default.

    def test_confidence_clamped(self):
        raw = json.dumps({"schema_version": 1, "confidence": 1.5})
        _, confidence = _parse_response(raw)
        assert confidence == 1.0

        raw = json.dumps({"schema_version": 1, "confidence": -0.5})
        _, confidence = _parse_response(raw)
        assert confidence == 0.0

    def test_missing_front_rear_filled(self):
        raw = json.dumps({"schema_version": 1, "confidence": 0.8})
        settings, _ = _parse_response(raw)

        assert "front" in settings
        assert "rear" in settings
        assert all(v is None for v in settings["front"].values())

    def test_extra_fields_stripped(self):
        raw = json.dumps({
            "schema_version": 1,
            "front": {"compression": 12, "unknown_field": 99},
            "rear": {},
            "confidence": 0.8,
        })
        settings, _ = _parse_response(raw)
        assert "unknown_field" not in settings["front"]

    def test_invalid_json_raises(self):
        with pytest.raises(ValueError, match="Failed to parse"):
            _parse_response("not json at all")

    def test_non_dict_raises(self):
        with pytest.raises(ValueError, match="Expected a JSON object"):
            _parse_response("[1, 2, 3]")


# ═══════════════════════ extract_setup_sheet ═════════════════════════════════


class TestExtractSetupSheet:
    @pytest.mark.asyncio
    async def test_successful_extraction(self, test_image_path, mock_anthropic_response):
        mock_resp = AsyncMock()
        mock_resp.json.return_value = mock_anthropic_response
        mock_resp.raise_for_status = lambda: None

        with patch("pipelines.ocr_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await extract_setup_sheet(test_image_path, "sk-test-key")

        assert isinstance(result, OcrResult)
        assert result.confidence == 0.85
        assert result.settings["front"]["compression"] == 12
        assert result.settings["rear"]["compression"] == 10
        assert result.settings["schema_version"] == 1

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            await extract_setup_sheet("/nonexistent.jpg", "sk-test")

    @pytest.mark.asyncio
    async def test_empty_api_response(self, test_image_path):
        mock_resp = AsyncMock()
        mock_resp.json.return_value = {"content": [{"type": "text", "text": ""}]}
        mock_resp.raise_for_status = lambda: None

        with patch("pipelines.ocr_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(ValueError, match="empty response"):
                await extract_setup_sheet(test_image_path, "sk-test")

    @pytest.mark.asyncio
    async def test_api_sends_correct_headers(self, test_image_path, mock_anthropic_response):
        mock_resp = AsyncMock()
        mock_resp.json.return_value = mock_anthropic_response
        mock_resp.raise_for_status = lambda: None

        with patch("pipelines.ocr_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            await extract_setup_sheet(test_image_path, "sk-my-key")

        call_kwargs = mock_client.post.call_args
        headers = call_kwargs.kwargs.get("headers", {})
        assert headers["x-api-key"] == "sk-my-key"
        assert headers["anthropic-version"] == "2023-06-01"
