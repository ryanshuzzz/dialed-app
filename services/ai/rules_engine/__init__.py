"""Dialed rules engine — deterministic suspension analysis.

Runs three analysis modules, merges their flags, deduplicates by parameter
(keeping the highest-confidence flag for each parameter), and returns a
sorted list.
"""

from __future__ import annotations

from .flag import Flag
from .geometry_correlator import analyse_geometry
from .suspension_tree import analyse_feedback
from .telemetry_patterns import analyse_telemetry

__all__ = [
    "Flag",
    "analyse_feedback",
    "analyse_geometry",
    "analyse_telemetry",
    "run_rules_engine",
]


def run_rules_engine(
    rider_feedback: str | None,
    suspension_spec: dict,
    change_log: list[dict],
    bike_spec: dict,
    track_data: dict | None,
    conditions: dict | None,
    telemetry_analysis: dict | None,
) -> list[Flag]:
    """Run all rules engine modules and return merged, deduplicated flags.

    Args:
        rider_feedback: Free-text rider feedback. May be None.
        suspension_spec: Current suspension spec (SuspensionSpec v1).
        change_log: Changes already made this session.
        bike_spec: Full bike object from Core API.
        track_data: Track object (may be None).
        conditions: Session conditions (may be None).
        telemetry_analysis: Telemetry analysis output (may be None).

    Returns:
        List of Flag objects, deduplicated by parameter (keeping the
        highest-confidence flag per parameter), sorted by confidence
        descending.
    """
    all_flags: list[Flag] = []

    # 1. Suspension decision tree (rider feedback).
    if rider_feedback:
        all_flags.extend(
            analyse_feedback(rider_feedback, suspension_spec, change_log)
        )

    # 2. Geometry correlator (bike spec + track + conditions).
    all_flags.extend(analyse_geometry(bike_spec, track_data, conditions))

    # 3. Telemetry patterns (if telemetry data available).
    all_flags.extend(analyse_telemetry(telemetry_analysis))

    # Deduplicate: keep the highest-confidence flag per parameter.
    seen: dict[str, Flag] = {}
    for flag in all_flags:
        existing = seen.get(flag.parameter)
        if existing is None or flag.confidence > existing.confidence:
            seen[flag.parameter] = flag

    deduped = list(seen.values())

    # Sort by confidence descending.
    deduped.sort(key=lambda f: f.confidence, reverse=True)

    return deduped
