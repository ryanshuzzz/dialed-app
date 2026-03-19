"""OCR pipeline — extract suspension settings from setup sheet photos.

Uses Claude Vision (claude-sonnet-4-6) to read paper or printed setup
sheets and return structured suspension settings matching the
SuspensionSpec schema.
"""

from __future__ import annotations

import base64
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from dialed_shared.logging import setup_logger

logger = setup_logger("telemetry-ingestion")

_ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
_MODEL = "claude-sonnet-4-6"

_SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
}

# The valid fields for each SuspensionEndSettings object.
_SUSPENSION_FIELDS = {
    "compression",
    "rebound",
    "preload",
    "spring_rate",
    "oil_level",
    "ride_height",
}

_SYSTEM_PROMPT = """\
You are an expert motorcycle suspension technician. You are looking at a photo \
of a paper or printed setup sheet. Extract all suspension settings you can read \
into the JSON structure below. Return ONLY valid JSON, no markdown fences, \
no commentary.

{
  "schema_version": 1,
  "front": {
    "compression": <number or null>,
    "rebound": <number or null>,
    "preload": <number or null>,
    "spring_rate": <number or null>,
    "oil_level": <number or null>,
    "ride_height": <number or null>
  },
  "rear": {
    "compression": <number or null>,
    "rebound": <number or null>,
    "preload": <number or null>,
    "spring_rate": <number or null>,
    "oil_level": <number or null>,
    "ride_height": <number or null>
  },
  "confidence": <float 0-1 indicating how confident you are in the extraction>
}

Rules:
- Values are typically small integers (clicks) or millimetres. Use the number \
as written on the sheet.
- If you cannot read a value, set it to null.
- If the sheet only has front or rear settings, include the other key with all \
null values.
- Set confidence to a value between 0 and 1. Use lower values when the image \
is blurry, partially obscured, or you are guessing.\
"""


@dataclass
class OcrResult:
    """Output of OCR extraction."""

    settings: dict[str, Any]
    confidence: float
    raw_response: str


def _detect_media_type(image_path: str) -> str:
    """Determine the MIME type of an image file.

    Raises ValueError for unsupported formats.
    """
    mime, _ = mimetypes.guess_type(image_path)

    # HEIC is not always in the mimetypes database.
    if mime is None:
        suffix = Path(image_path).suffix.lower()
        if suffix in (".heic", ".heif"):
            mime = "image/heic"

    if mime is None:
        raise ValueError(
            f"Cannot determine image format for {image_path}"
        )

    if mime not in _SUPPORTED_MIME_TYPES:
        raise ValueError(
            f"Unsupported image format: {mime}. "
            f"Supported: {', '.join(sorted(_SUPPORTED_MIME_TYPES))}"
        )

    # Anthropic API accepts image/heic but some versions require jpeg/png/webp/gif.
    # HEIC is supported per Anthropic docs.
    return mime


def _read_and_encode(image_path: str) -> tuple[str, str]:
    """Read an image file and return (base64_data, media_type).

    Raises FileNotFoundError or ValueError on problems.
    """
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    media_type = _detect_media_type(image_path)
    raw_bytes = path.read_bytes()

    if not raw_bytes:
        raise ValueError(f"Image file is empty: {image_path}")

    return base64.standard_b64encode(raw_bytes).decode("ascii"), media_type


def _parse_response(raw_text: str) -> tuple[dict[str, Any], float]:
    """Parse Claude's JSON response into settings dict and confidence.

    Handles minor formatting issues (markdown fences, trailing commas).
    Raises ValueError if the response cannot be parsed.
    """
    import json

    text = raw_text.strip()

    # Strip markdown code fences if Claude included them despite instructions.
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (the fences).
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Failed to parse Claude response as JSON: {exc}. "
            f"Raw response: {raw_text[:500]}"
        ) from exc

    if not isinstance(data, dict):
        raise ValueError(
            f"Expected a JSON object, got {type(data).__name__}"
        )

    confidence = float(data.pop("confidence", 0.5))
    confidence = max(0.0, min(1.0, confidence))

    # Ensure schema_version is present.
    data.setdefault("schema_version", 1)

    # Sanitise front/rear — keep only known fields.
    for end in ("front", "rear"):
        section = data.get(end)
        if section is None:
            data[end] = {f: None for f in _SUSPENSION_FIELDS}
        elif isinstance(section, dict):
            data[end] = {
                f: section.get(f) for f in _SUSPENSION_FIELDS
            }
        else:
            data[end] = {f: None for f in _SUSPENSION_FIELDS}

    return data, confidence


async def extract_setup_sheet(
    image_path: str,
    api_key: str,
) -> OcrResult:
    """Extract suspension settings from a setup sheet photo.

    Args:
        image_path: Path to the image file (JPEG, PNG, HEIC, WebP, GIF).
        api_key: Anthropic API key — either the platform key or a user's
            BYOK key, passed by the worker.

    Returns:
        An ``OcrResult`` with the extracted settings, a confidence score,
        and the raw response text from Claude.

    Raises:
        ValueError: If the image format is unsupported or the response
            cannot be parsed.
        httpx.HTTPStatusError: On API-level errors (rate limit, auth, etc.).
        FileNotFoundError: If the image file does not exist.
    """
    image_b64, media_type = _read_and_encode(image_path)

    payload = {
        "model": _MODEL,
        "max_tokens": 1024,
        "system": _SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract all suspension settings from this setup "
                            "sheet photo. Return only the JSON object."
                        ),
                    },
                ],
            }
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            _ANTHROPIC_API_URL,
            json=payload,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        resp.raise_for_status()

    body = resp.json()

    # Extract the text content from the response.
    raw_text = ""
    for block in body.get("content", []):
        if block.get("type") == "text":
            raw_text += block.get("text", "")

    if not raw_text.strip():
        raise ValueError("Claude returned an empty response for the setup sheet")

    settings, confidence = _parse_response(raw_text)

    logger.info(
        "OCR extraction complete — confidence=%.2f, image=%s",
        confidence,
        image_path,
    )

    return OcrResult(
        settings=settings,
        confidence=confidence,
        raw_response=raw_text,
    )
