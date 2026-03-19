"""Voice pipeline — transcribe rider audio notes and extract entities.

Uses OpenAI Whisper API for transcription and deterministic regex/keyword
parsing for entity extraction (no AI on the extraction step — fast and
predictable).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from dialed_shared.logging import setup_logger

logger = setup_logger("telemetry-ingestion")

_WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions"
_WHISPER_MODEL = "whisper-1"

_SUPPORTED_AUDIO_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".ogg",
    ".webm",
    ".mp4",
    ".mpeg",
    ".mpga",
}

# Maps colloquial names to canonical suspension parameter paths.
_PARAMETER_ALIASES: dict[str, str] = {
    # Front
    "front compression": "front.compression",
    "front comp": "front.compression",
    "front rebound": "front.rebound",
    "front preload": "front.preload",
    "front spring": "front.spring_rate",
    "front spring rate": "front.spring_rate",
    "front oil level": "front.oil_level",
    "front oil": "front.oil_level",
    "front ride height": "front.ride_height",
    "fork compression": "front.compression",
    "fork comp": "front.compression",
    "fork rebound": "front.rebound",
    "fork preload": "front.preload",
    "fork spring": "front.spring_rate",
    "fork oil level": "front.oil_level",
    "fork oil": "front.oil_level",
    "fork ride height": "front.ride_height",
    # Rear
    "rear compression": "rear.compression",
    "rear comp": "rear.compression",
    "rear rebound": "rear.rebound",
    "rear preload": "rear.preload",
    "rear spring": "rear.spring_rate",
    "rear spring rate": "rear.spring_rate",
    "rear ride height": "rear.ride_height",
    "shock compression": "rear.compression",
    "shock comp": "rear.compression",
    "shock rebound": "rear.rebound",
    "shock preload": "rear.preload",
    "shock spring": "rear.spring_rate",
    "shock ride height": "rear.ride_height",
    # Short forms (context-dependent — front/rear inferred later)
    "compression": "compression",
    "comp": "compression",
    "rebound": "rebound",
    "preload": "preload",
    "spring rate": "spring_rate",
    "oil level": "oil_level",
    "ride height": "ride_height",
}

# Regex for "N clicks" / "N turns" style values.
_CLICKS_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:clicks?|turns?|notch(?:es)?)",
    re.IGNORECASE,
)

# Regex for setting change mentions: "added/removed N clicks of <param>"
_CHANGE_PATTERN = re.compile(
    r"(?P<action>add(?:ed)?|remov(?:ed?|ing)|took\s+out|put\s+in|went)"
    r"\s+(?P<amount>\d+(?:\.\d+)?)\s*"
    r"(?:clicks?|turns?|notch(?:es)?|mm)?"
    r"\s*(?:of\s+|on\s+|to\s+|from\s+)?"
    r"(?:the\s+)?"
    r"(?P<param>[a-z][a-z ]*\b)",
    re.IGNORECASE,
)

# Regex for absolute setting mentions: "<param> to/at/is N"
_ABSOLUTE_PATTERN = re.compile(
    r"(?P<param>(?:front|rear|fork|shock)\s+(?:compression|comp|rebound|preload|spring(?:\s+rate)?|oil(?:\s+level)?|ride\s+height))"
    r"\s+(?:to|at|is|was|set\s+(?:to|at))\s+"
    r"(?P<value>\d+(?:\.\d+)?)",
    re.IGNORECASE,
)

# Lap time mentions: "1:23.456" or "1 minute 23" style.
_LAP_TIME_PATTERN = re.compile(
    r"(?P<minutes>\d{1,2}):(?P<seconds>\d{2}(?:\.\d{1,3})?)",
)
_LAP_TIME_VERBAL = re.compile(
    r"(?P<minutes>\d{1,2})\s*(?:minute|min)s?\s*"
    r"(?P<seconds>\d{1,2}(?:\.\d{1,3})?)\s*(?:second|sec)?s?",
    re.IGNORECASE,
)


@dataclass
class SettingMention:
    """A single setting change or value extracted from transcript."""

    parameter: str  # canonical path e.g. "front.compression"
    value: str  # raw value string e.g. "2 clicks"
    action: str | None = None  # "added", "removed", "set", etc.


@dataclass
class VoiceResult:
    """Output of voice note processing."""

    transcript: str
    feedback: str | None
    setting_mentions: list[dict[str, Any]]
    lap_times: list[str]
    confidence: float


# ── Transcription ────────────────────────────────────────────────────────────


def _validate_audio_file(audio_path: str) -> Path:
    """Validate the audio file exists and is a supported format."""
    path = Path(audio_path)

    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    if path.stat().st_size == 0:
        raise ValueError(f"Audio file is empty: {audio_path}")

    suffix = path.suffix.lower()
    if suffix not in _SUPPORTED_AUDIO_EXTENSIONS:
        raise ValueError(
            f"Unsupported audio format: {suffix}. "
            f"Supported: {', '.join(sorted(_SUPPORTED_AUDIO_EXTENSIONS))}"
        )

    return path


async def transcribe_voice_note(
    audio_path: str,
    api_key: str,
) -> str:
    """Transcribe an audio file using the OpenAI Whisper API.

    Args:
        audio_path: Path to the audio file on disk.
        api_key: OpenAI API key — platform key or user's BYOK key.

    Returns:
        The raw transcript text.

    Raises:
        FileNotFoundError: If the audio file does not exist.
        ValueError: If the file is empty or an unsupported format.
        httpx.HTTPStatusError: On API errors.
    """
    path = _validate_audio_file(audio_path)

    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(path, "rb") as audio_file:
            resp = await client.post(
                _WHISPER_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": (path.name, audio_file, "application/octet-stream")},
                data={
                    "model": _WHISPER_MODEL,
                    "response_format": "text",
                    "language": "en",
                },
            )
            resp.raise_for_status()

    transcript = resp.text.strip()

    if not transcript:
        raise ValueError("Whisper returned an empty transcript")

    logger.info(
        "Transcription complete — %d chars, file=%s",
        len(transcript),
        audio_path,
    )

    return transcript


# ── Entity extraction (deterministic) ────────────────────────────────────────


def _resolve_parameter(raw_param: str) -> str | None:
    """Resolve a raw parameter mention to a canonical parameter path."""
    cleaned = raw_param.strip().lower()
    # Try exact match first.
    canonical = _PARAMETER_ALIASES.get(cleaned)
    if canonical:
        return canonical

    # Try progressively shorter prefixes (handles trailing words).
    words = cleaned.split()
    for length in range(len(words), 0, -1):
        attempt = " ".join(words[:length])
        canonical = _PARAMETER_ALIASES.get(attempt)
        if canonical:
            return canonical

    return None


def _extract_setting_mentions(transcript: str) -> list[SettingMention]:
    """Extract all setting change and absolute value mentions."""
    mentions: list[SettingMention] = []
    seen: set[str] = set()

    # Pattern 1: change mentions ("added 2 clicks of front rebound")
    for m in _CHANGE_PATTERN.finditer(transcript):
        action_raw = m.group("action").lower().strip()
        amount = m.group("amount")
        param_raw = m.group("param")

        canonical = _resolve_parameter(param_raw)
        if canonical is None:
            continue

        action = "added" if any(w in action_raw for w in ("add", "put", "went")) else "removed"
        key = f"{canonical}:{amount}:{action}"
        if key not in seen:
            seen.add(key)
            mentions.append(
                SettingMention(
                    parameter=canonical,
                    value=f"{amount} clicks",
                    action=action,
                )
            )

    # Pattern 2: absolute value mentions ("front compression to 12")
    for m in _ABSOLUTE_PATTERN.finditer(transcript):
        param_raw = m.group("param")
        value = m.group("value")

        canonical = _resolve_parameter(param_raw)
        if canonical is None:
            continue

        key = f"{canonical}:{value}:set"
        if key not in seen:
            seen.add(key)
            mentions.append(
                SettingMention(
                    parameter=canonical,
                    value=value,
                    action="set",
                )
            )

    return mentions


def _extract_lap_times(transcript: str) -> list[str]:
    """Extract lap time mentions from the transcript."""
    times: list[str] = []

    for m in _LAP_TIME_PATTERN.finditer(transcript):
        minutes = m.group("minutes")
        seconds = m.group("seconds")
        times.append(f"{minutes}:{seconds}")

    for m in _LAP_TIME_VERBAL.finditer(transcript):
        minutes = m.group("minutes")
        seconds = m.group("seconds")
        times.append(f"{minutes}:{seconds}")

    # Deduplicate while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for t in times:
        if t not in seen:
            seen.add(t)
            unique.append(t)

    return unique


def _extract_feedback(transcript: str) -> str | None:
    """Extract rider feedback — the full transcript minus pure data mentions.

    For now, returns the full transcript as feedback since the whole note
    is typically the rider's subjective impressions. Returns None only if
    the transcript is trivially short.
    """
    if len(transcript.strip()) < 10:
        return None
    return transcript.strip()


def _compute_confidence(
    mentions: list[SettingMention],
    transcript: str,
) -> float:
    """Heuristic confidence score for the extraction.

    Higher when we found structured mentions; lower for vague/short notes.
    """
    if not transcript.strip():
        return 0.0

    score = 0.5  # Baseline — we got a transcript.

    # Boost for each structured mention found.
    mention_boost = min(len(mentions) * 0.1, 0.3)
    score += mention_boost

    # Boost for longer, more detailed transcripts.
    word_count = len(transcript.split())
    if word_count > 50:
        score += 0.1
    elif word_count > 20:
        score += 0.05

    return min(score, 1.0)


def extract_entities(transcript: str) -> VoiceResult:
    """Parse a transcript for structured entities.

    Uses regex patterns and keyword matching — no AI call, fast and
    deterministic.

    Args:
        transcript: Raw transcript text from Whisper.

    Returns:
        A ``VoiceResult`` with the transcript, extracted feedback,
        setting mentions, lap times, and a confidence score.
    """
    mentions = _extract_setting_mentions(transcript)
    lap_times = _extract_lap_times(transcript)
    feedback = _extract_feedback(transcript)
    confidence = _compute_confidence(mentions, transcript)

    # Serialise SettingMention objects to dicts for JSON storage.
    mention_dicts = [
        {
            "parameter": m.parameter,
            "value": m.value,
            "action": m.action,
        }
        for m in mentions
    ]

    logger.info(
        "Entity extraction — %d setting mentions, %d lap times, confidence=%.2f",
        len(mention_dicts),
        len(lap_times),
        confidence,
    )

    return VoiceResult(
        transcript=transcript,
        feedback=feedback,
        setting_mentions=mention_dicts,
        lap_times=lap_times,
        confidence=confidence,
    )
