"""Adapts suggestion language to the rider's skill level.

Transforms technical suspension terminology to match what the rider
will understand and find most useful.
"""

from __future__ import annotations

import re

# Mapping of technical terms to novice-friendly explanations.
_NOVICE_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\brebound damping\b", re.I),
        "rebound damping (controls how fast your fork/shock extends back out after hitting a bump)",
    ),
    (
        re.compile(r"\bcompression damping\b", re.I),
        "compression damping (controls how fast your fork/shock compresses when you hit a bump or brake)",
    ),
    (
        re.compile(r"\bpreload\b", re.I),
        "preload (how much the spring is pre-compressed — affects ride height and sag)",
    ),
    (
        re.compile(r"\bsag\b", re.I),
        "sag (how much the suspension compresses under the rider's weight when sitting on the bike)",
    ),
    (
        re.compile(r"\bspring rate\b", re.I),
        "spring rate (how stiff the spring is — measured in N/mm)",
    ),
    (
        re.compile(r"\btrail\b", re.I),
        "trail (the distance between where the front tire touches the ground and where the steering axis hits the ground — more trail = more stability)",
    ),
    (
        re.compile(r"\bhead angle\b", re.I),
        "head angle (the angle of the steering axis — steeper = quicker steering, shallower = more stable)",
    ),
    (
        re.compile(r"\bride height\b", re.I),
        "ride height (the physical height of the suspension — changes the bike's geometry and weight distribution)",
    ),
    (
        re.compile(r"\bchatter\b", re.I),
        "chatter (a rapid vibration you feel through the handlebars or seat, usually at corner entry or exit)",
    ),
    (
        re.compile(r"\bpacking\b", re.I),
        "packing (when the suspension compresses but doesn't fully extend before the next bump, losing travel)",
    ),
    (
        re.compile(r"\bclicks?\s+(?:from|out|in)\b", re.I),
        lambda m: f"{m.group(0)} (each click is one small adjustment step on the damping adjuster)",
    ),
]


def adapt_language(text: str, skill_level: str) -> str:
    """Adapt suggestion text to the rider's skill level.

    Args:
        text: The raw suggestion or prompt text.
        skill_level: One of 'novice', 'intermediate', 'expert'.

    Returns:
        The text adapted for the specified skill level.
    """
    if skill_level == "novice":
        return _adapt_novice(text)
    elif skill_level == "expert":
        return _adapt_expert(text)
    # Intermediate: return as-is (standard technical language).
    return text


def _adapt_novice(text: str) -> str:
    """Add explanations of technical terms for novice riders."""
    result = text
    # Track which terms we've already expanded to avoid double-explaining.
    expanded: set[str] = set()

    for pattern, replacement in _NOVICE_REPLACEMENTS:
        match = pattern.search(result)
        if match and match.group(0).lower() not in expanded:
            expanded.add(match.group(0).lower())
            # Only replace the first occurrence (the explanation is inline).
            if callable(replacement):
                result = pattern.sub(replacement, result, count=1)
            else:
                result = pattern.sub(replacement, result, count=1)

    return result


def _adapt_expert(text: str) -> str:
    """Use precise technical terminology for expert riders.

    Expert riders prefer concise, numerical reasoning without
    hand-holding explanations. Strip any parenthetical explanations
    that may have been added and keep language direct.
    """
    # Remove parenthetical explanations that explain basic concepts.
    result = re.sub(
        r"\s*\([^)]*(?:controls how|how much|the distance|the angle|measured in)[^)]*\)",
        "",
        text,
    )
    return result
