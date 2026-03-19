"""Parses Claude's natural language response into structured changes.

Extracts the top 3 recommended suspension parameter changes from various
response formats (numbered lists, bullet points, prose). Uses regex and
keyword matching to identify parameter names, values, symptoms, and
confidence levels.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger("ai")


@dataclass
class ParsedChange:
    """A single structured change extracted from Claude's response."""

    parameter: str
    suggested_value: str
    symptom: str
    confidence: float
    reasoning: str


# Known suspension parameter names and their canonical forms.
_PARAMETER_ALIASES: dict[str, str] = {
    "front compression": "front.compression",
    "front comp": "front.compression",
    "front rebound": "front.rebound",
    "front preload": "front.preload",
    "front spring rate": "front.spring_rate",
    "front spring": "front.spring_rate",
    "front oil level": "front.oil_level",
    "front ride height": "front.ride_height",
    "rear compression": "rear.compression",
    "rear comp": "rear.compression",
    "rear rebound": "rear.rebound",
    "rear preload": "rear.preload",
    "rear spring rate": "rear.spring_rate",
    "rear spring": "rear.spring_rate",
    "rear ride height": "rear.ride_height",
}

# Regex to match parameter names in dotted notation (front.compression, etc.)
_DOTTED_PARAM = re.compile(
    r"\b(front|rear)\.(compression|rebound|preload|spring_rate|oil_level|ride_height)\b",
    re.I,
)

# Regex to match natural-language parameter references.
_NATURAL_PARAM = re.compile(
    r"\b(front|rear)\s+(compression|comp|rebound|preload|spring\s*rate|spring|oil\s*level|ride\s*height)\b",
    re.I,
)

# Confidence keywords mapped to numeric values.
_CONFIDENCE_MAP: dict[str, float] = {
    "high": 0.85,
    "very high": 0.95,
    "medium": 0.65,
    "moderate": 0.65,
    "low": 0.40,
    "very low": 0.25,
}

_CONFIDENCE_PATTERN = re.compile(
    r"(?:confidence|conf\.?)\s*:?\s*(very\s+high|high|medium|moderate|low|very\s+low|\d+\.?\d*\s*%?)",
    re.I,
)

# Regex to capture value/delta suggestions (clicks, mm, psi, etc.)
_VALUE_PATTERN = re.compile(
    r"(?:→|->|to|by|:)\s*"
    r"([+-]?\s*\d+[\d./–-]*\s*"
    r"(?:clicks?|mm|psi|turns?|N/mm|steps?)?"
    r"(?:\s*\([^)]*\))?)",
    re.I,
)

# Alternate: capture "+2 clicks" style patterns standalone.
_DELTA_PATTERN = re.compile(
    r"([+-]\s*\d+[\d./–-]*\s*(?:clicks?|mm|psi|turns?|N/mm|steps?)"
    r"(?:\s*\([^)]*\))?)",
    re.I,
)

# Pattern to split response into numbered/bulleted items.
_ITEM_SPLIT = re.compile(
    r"(?:^|\n)\s*(?:\d+[\.\)]\s*\**|[-*•]\s*\**|#{1,3}\s*\d*\.?\s*)",
)


def parse_suggestion_response(full_response: str) -> list[ParsedChange]:
    """Parse Claude's response into structured changes.

    Attempts to extract up to 3 structured parameter changes from the
    response text. Handles numbered lists, bullet points, and prose.

    Args:
        full_response: The complete text response from Claude.

    Returns:
        List of ParsedChange objects (up to 3). Returns empty list if
        parsing fails entirely.
    """
    if not full_response or not full_response.strip():
        logger.warning("Empty response from Claude — no changes to parse")
        return []

    try:
        changes = _try_parse_structured(full_response)
        if changes:
            return changes[:3]

        # Fallback: scan the entire response for parameter references.
        changes = _try_parse_freeform(full_response)
        if changes:
            return changes[:3]

        logger.warning(
            "Could not extract structured changes from Claude response "
            "(length=%d chars)",
            len(full_response),
        )
        return []

    except Exception:
        logger.warning(
            "Unexpected error parsing Claude response", exc_info=True
        )
        return []


def _try_parse_structured(response: str) -> list[ParsedChange]:
    """Try to parse a numbered/bulleted list of recommendations."""
    # Split into items by numbered list or bullet markers.
    items = _ITEM_SPLIT.split(response)
    # Filter out empty/short items and the preamble.
    items = [item.strip() for item in items if len(item.strip()) > 20]

    changes: list[ParsedChange] = []

    for item in items:
        change = _extract_change_from_block(item)
        if change:
            changes.append(change)

    return changes


def _try_parse_freeform(response: str) -> list[ParsedChange]:
    """Scan the whole response for parameter mentions and build changes."""
    changes: list[ParsedChange] = []
    seen_params: set[str] = set()

    # Find all parameter references in the text.
    for match in _DOTTED_PARAM.finditer(response):
        param = match.group(0).lower()
        if param in seen_params:
            continue
        seen_params.add(param)

        # Extract surrounding context (±200 chars).
        start = max(0, match.start() - 200)
        end = min(len(response), match.end() + 200)
        context = response[start:end]

        change = _extract_change_from_context(param, context)
        if change:
            changes.append(change)

    # Also try natural language parameter names.
    for match in _NATURAL_PARAM.finditer(response):
        natural = match.group(0).lower()
        param = _PARAMETER_ALIASES.get(natural)
        if not param or param in seen_params:
            continue
        seen_params.add(param)

        start = max(0, match.start() - 200)
        end = min(len(response), match.end() + 200)
        context = response[start:end]

        change = _extract_change_from_context(param, context)
        if change:
            changes.append(change)

    return changes


def _extract_change_from_block(block: str) -> ParsedChange | None:
    """Extract a ParsedChange from a single list item block."""
    # Find the parameter.
    param = _find_parameter(block)
    if not param:
        return None

    value = _find_value(block)
    symptom = _find_symptom(block)
    confidence = _find_confidence(block)
    reasoning = _extract_reasoning(block, param)

    return ParsedChange(
        parameter=param,
        suggested_value=value,
        symptom=symptom,
        confidence=confidence,
        reasoning=reasoning,
    )


def _extract_change_from_context(param: str, context: str) -> ParsedChange | None:
    """Extract a change for a known parameter from surrounding context."""
    value = _find_value(context)
    if not value:
        return None

    symptom = _find_symptom(context)
    confidence = _find_confidence(context)
    reasoning = _extract_reasoning(context, param)

    return ParsedChange(
        parameter=param,
        suggested_value=value,
        symptom=symptom,
        confidence=confidence,
        reasoning=reasoning,
    )


def _find_parameter(text: str) -> str | None:
    """Find a suspension parameter reference in text."""
    # Try dotted notation first.
    match = _DOTTED_PARAM.search(text)
    if match:
        return match.group(0).lower()

    # Try natural language.
    match = _NATURAL_PARAM.search(text)
    if match:
        natural = match.group(0).lower()
        return _PARAMETER_ALIASES.get(natural)

    return None


def _find_value(text: str) -> str:
    """Find the suggested value or delta in text."""
    match = _VALUE_PATTERN.search(text)
    if match:
        return match.group(1).strip()

    match = _DELTA_PATTERN.search(text)
    if match:
        return match.group(1).strip()

    # Look for "X clicks" pattern.
    clicks_match = re.search(
        r"(\d+[\d./–-]*\s*clicks?\s*(?:softer|harder|faster|slower|out|in)?)",
        text,
        re.I,
    )
    if clicks_match:
        return clicks_match.group(1).strip()

    return "see recommendation"


def _find_symptom(text: str) -> str:
    """Extract the symptom/problem being addressed."""
    # Look for "addresses", "fixes", "helps with", "symptom:" patterns.
    symptom_patterns = [
        re.compile(r"(?:symptom|addresses|fixes|helps?\s+with|for)\s*:?\s*([^.\n]{5,80})", re.I),
        re.compile(r"(?:to\s+(?:fix|address|reduce|improve|prevent))\s+([^.\n]{5,80})", re.I),
    ]

    for pattern in symptom_patterns:
        match = pattern.search(text)
        if match:
            return match.group(1).strip().rstrip(",;")

    return "general handling improvement"


def _find_confidence(text: str) -> float:
    """Extract confidence level from text."""
    match = _CONFIDENCE_PATTERN.search(text)
    if match:
        raw = match.group(1).strip().lower()
        # Check if it's a percentage.
        if raw.endswith("%"):
            try:
                return min(1.0, float(raw.rstrip("%")) / 100)
            except ValueError:
                pass
        # Check if it's a decimal.
        try:
            val = float(raw)
            return min(1.0, val if val <= 1.0 else val / 100)
        except ValueError:
            pass
        # Look up keyword.
        return _CONFIDENCE_MAP.get(raw, 0.65)

    return 0.65  # Default to medium confidence.


def _extract_reasoning(text: str, param: str) -> str:
    """Extract reasoning text, trimmed to a reasonable length."""
    # Try to get the sentence(s) containing or following the parameter.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    relevant = []
    found = False
    for sentence in sentences:
        if param in sentence.lower() or found:
            relevant.append(sentence.strip())
            found = True
            if len(relevant) >= 2:
                break

    if relevant:
        reasoning = " ".join(relevant)
        # Trim to 300 chars max.
        if len(reasoning) > 300:
            reasoning = reasoning[:297] + "..."
        return reasoning

    # Fallback: first 200 chars of the block.
    return text[:200].strip() + ("..." if len(text) > 200 else "")
