"""Analyses telemetry metrics from the Telemetry service.

Interprets computed analysis data (braking zones, fork rebound, TCS events)
and produces data-driven flags. Gracefully handles missing telemetry.
"""

from __future__ import annotations

from .flag import Flag


def analyse_telemetry(analysis_data: dict | None) -> list[Flag]:
    """Analyse telemetry-derived metrics and return data-driven flags.

    Args:
        analysis_data: Output from ``GET /telemetry/:session_id/analysis``.
            Expected keys vary based on what the telemetry service computes.
            May be None if no telemetry data exists for this session.

    Returns:
        List of Flag objects. Empty list if analysis_data is None.
    """
    if not analysis_data:
        return []

    flags: list[Flag] = []

    flags.extend(_analyse_braking(analysis_data))
    flags.extend(_analyse_fork_rebound(analysis_data))
    flags.extend(_analyse_tcs(analysis_data))
    flags.extend(_analyse_throttle(analysis_data))
    flags.extend(_analyse_lean_angle(analysis_data))

    return sorted(flags, key=lambda f: f.confidence, reverse=True)


def _analyse_braking(data: dict) -> list[Flag]:
    """Interpret braking zone consistency data."""
    flags: list[Flag] = []

    braking = data.get("braking_zones")
    if not braking:
        return flags

    # Check for inconsistent braking across zones.
    if isinstance(braking, list):
        for zone in braking:
            zone_id = zone.get("zone") or zone.get("corner") or zone.get("id", "?")
            consistency = zone.get("consistency")
            variance = zone.get("variance")

            # High variance or low consistency → instability flag.
            if consistency is not None and consistency < 0.6:
                flags.append(
                    Flag(
                        symptom=f"inconsistent braking at {zone_id}",
                        parameter="front.compression",
                        suggested_delta="+1–2 clicks (stiffer)",
                        confidence=0.70,
                        reasoning=f"Braking consistency at {zone_id} is {consistency:.0%}. "
                        "Inconsistent braking often indicates the fork is diving "
                        "unpredictably, making brake markers unreliable. Stiffer "
                        "compression provides a more consistent platform.",
                    )
                )
            elif variance is not None and variance > 0.3:
                flags.append(
                    Flag(
                        symptom=f"high braking variance at {zone_id}",
                        parameter="front.compression",
                        suggested_delta="+1 click (stiffer)",
                        confidence=0.60,
                        reasoning=f"Braking variance at {zone_id} is high ({variance:.2f}). "
                        "This suggests the front end is not providing consistent "
                        "feedback under braking.",
                    )
                )

    # Aggregate braking stats.
    avg_consistency = data.get("braking_consistency_avg")
    if avg_consistency is not None and avg_consistency < 0.5:
        flags.append(
            Flag(
                symptom="overall braking instability",
                parameter="front.preload",
                suggested_delta="+1–2 mm preload",
                confidence=0.65,
                reasoning=f"Overall braking consistency is {avg_consistency:.0%}. "
                "More preload raises the front, providing a more stable "
                "platform under heavy braking across all zones.",
            )
        )

    return flags


def _analyse_fork_rebound(data: dict) -> list[Flag]:
    """Interpret fork rebound speed data."""
    flags: list[Flag] = []

    fork_rebound = data.get("fork_rebound")
    if not fork_rebound:
        return flags

    speed = fork_rebound if isinstance(fork_rebound, (int, float)) else None
    if isinstance(fork_rebound, dict):
        speed = fork_rebound.get("avg_speed") or fork_rebound.get("speed")
        too_slow = fork_rebound.get("too_slow", False)
        too_fast = fork_rebound.get("too_fast", False)

        if too_slow:
            flags.append(
                Flag(
                    symptom="slow fork rebound detected",
                    parameter="front.rebound",
                    suggested_delta="-1–2 clicks (faster rebound)",
                    confidence=0.80,
                    reasoning="Telemetry shows the fork is extending too slowly after "
                    "compression events. This causes packing on consecutive bumps "
                    "and reduces available travel.",
                )
            )
        elif too_fast:
            flags.append(
                Flag(
                    symptom="fast fork rebound detected",
                    parameter="front.rebound",
                    suggested_delta="+1–2 clicks (slower rebound)",
                    confidence=0.80,
                    reasoning="Telemetry shows the fork is extending too quickly, "
                    "which can cause headshake and unsettled feeling on corner exit.",
                )
            )

    # Generic speed threshold if raw number provided.
    if speed is not None and not isinstance(fork_rebound, dict):
        if speed < 0.3:
            flags.append(
                Flag(
                    symptom="slow fork rebound (telemetry)",
                    parameter="front.rebound",
                    suggested_delta="-1–2 clicks (faster rebound)",
                    confidence=0.70,
                    reasoning=f"Fork rebound speed metric is {speed:.2f} — below the "
                    "typical range. The fork may pack down over consecutive bumps.",
                )
            )

    return flags


def _analyse_tcs(data: dict) -> list[Flag]:
    """Interpret traction control system intervention data."""
    flags: list[Flag] = []

    tcs = data.get("tcs") or data.get("traction_control")
    if not tcs:
        return flags

    interventions = None
    if isinstance(tcs, dict):
        interventions = tcs.get("interventions") or tcs.get("events") or tcs.get("count")
    elif isinstance(tcs, (int, float)):
        interventions = tcs

    if interventions is not None and interventions > 15:
        flags.append(
            Flag(
                symptom="frequent TCS interventions",
                parameter="rear.rebound",
                suggested_delta="+1–2 clicks (slower rebound)",
                confidence=0.70,
                reasoning=f"TCS triggered {int(interventions)} times this session. "
                "Frequent interventions suggest the rear tire is losing "
                "traction on exit. Slower rebound keeps the tire loaded.",
            )
        )
        flags.append(
            Flag(
                symptom="frequent TCS interventions",
                parameter="throttle_delivery",
                suggested_delta="consider smoother throttle map or TC level adjustment",
                confidence=0.55,
                reasoning=f"With {int(interventions)} TCS events, the issue may also "
                "be throttle delivery rather than purely suspension. "
                "A smoother throttle map reduces abrupt power transitions.",
            )
        )

    # Per-corner TCS hotspots.
    if isinstance(tcs, dict):
        hotspots = tcs.get("hotspots") or tcs.get("by_corner")
        if isinstance(hotspots, list):
            for spot in hotspots:
                corner = spot.get("corner") or spot.get("zone") or "?"
                count = spot.get("count", 0)
                if count > 5:
                    flags.append(
                        Flag(
                            symptom=f"TCS hotspot at {corner}",
                            parameter="rear.rebound",
                            suggested_delta="+1 click (slower rebound)",
                            confidence=0.60,
                            reasoning=f"TCS triggered {count} times at {corner}. "
                            "Localised traction loss at a specific corner suggests "
                            "the rear is unloading on exit at that point.",
                        )
                    )

    return flags


def _analyse_throttle(data: dict) -> list[Flag]:
    """Interpret throttle pickup timing data."""
    flags: list[Flag] = []

    throttle = data.get("throttle_pickup") or data.get("throttle")
    if not throttle:
        return flags

    if isinstance(throttle, dict):
        late_sectors = throttle.get("late_sectors") or throttle.get("late_corners")
        if isinstance(late_sectors, list) and late_sectors:
            sectors_str = ", ".join(str(s) for s in late_sectors[:3])
            flags.append(
                Flag(
                    symptom=f"late throttle pickup in sectors {sectors_str}",
                    parameter="rear.compression",
                    suggested_delta="-1 click (softer)",
                    confidence=0.60,
                    reasoning=f"Throttle pickup is late in {sectors_str}. This may "
                    "indicate the rider lacks confidence in rear grip on exit. "
                    "Slightly softer rear compression improves feel and "
                    "encourages earlier throttle application.",
                )
            )

    return flags


def _analyse_lean_angle(data: dict) -> list[Flag]:
    """Interpret lean angle data for potential geometry issues."""
    flags: list[Flag] = []

    lean = data.get("lean_angle") or data.get("max_lean")
    if not lean:
        return flags

    if isinstance(lean, dict):
        asymmetry = lean.get("asymmetry")
        if asymmetry is not None and abs(asymmetry) > 3.0:
            side = "left" if asymmetry > 0 else "right"
            flags.append(
                Flag(
                    symptom=f"lean angle asymmetry ({side} dominant)",
                    parameter="rear.ride_height",
                    suggested_delta="check rear ride height and linkage alignment",
                    confidence=0.50,
                    reasoning=f"Lean angle shows {abs(asymmetry):.1f}° asymmetry "
                    f"favoring the {side}. This may indicate a ride height "
                    "imbalance or linkage alignment issue.",
                )
            )

    return flags
