"""Correlates bike geometry and gearing with track and conditions.

Produces flags for geometry-level adjustments that aren't captured by
rider complaint keywords — e.g. gearing mismatches, wet weather baseline
shifts, and altitude/temperature effects.
"""

from __future__ import annotations

from .flag import Flag


def analyse_geometry(
    bike_spec: dict,
    track_data: dict | None,
    conditions: dict | None,
) -> list[Flag]:
    """Analyse bike geometry against track and conditions.

    Args:
        bike_spec: Full bike object from Core API (includes gearing_front,
            gearing_rear, suspension_spec, etc.).
        track_data: Track object from Core API (includes track_type,
            length_km, turns, etc.). May be None.
        conditions: Session conditions dict (weather, temperature,
            altitude, surface). May be None.

    Returns:
        List of geometry-based Flag objects.
    """
    flags: list[Flag] = []

    flags.extend(_analyse_gearing(bike_spec, track_data))
    flags.extend(_analyse_conditions(conditions))
    flags.extend(_analyse_altitude_temperature(conditions))

    return sorted(flags, key=lambda f: f.confidence, reverse=True)


def _analyse_gearing(bike_spec: dict, track_data: dict | None) -> list[Flag]:
    """Check gearing ratio against track type."""
    flags: list[Flag] = []

    front_sprocket = bike_spec.get("gearing_front")
    rear_sprocket = bike_spec.get("gearing_rear")
    if not front_sprocket or not rear_sprocket:
        return flags

    ratio = rear_sprocket / front_sprocket
    track_type = (track_data or {}).get("track_type", "").lower() if track_data else ""

    if not track_type:
        return flags

    # Tight/technical tracks benefit from shorter (higher numerical) ratios.
    # Fast/flowing tracks benefit from taller (lower numerical) ratios.
    is_tight = any(
        kw in track_type for kw in ("tight", "technical", "kart", "short")
    )
    is_fast = any(
        kw in track_type for kw in ("fast", "flowing", "long", "high-speed")
    )

    if is_tight and ratio < 2.8:
        flags.append(
            Flag(
                symptom="gearing too tall for tight track",
                parameter="gearing",
                suggested_delta="consider +1–2 teeth on rear sprocket for shorter gearing",
                confidence=0.65,
                reasoning=f"Current ratio {ratio:.2f} is tall for a tight/technical track. "
                "Shorter gearing improves drive out of slow corners.",
            )
        )
    elif is_fast and ratio > 3.3:
        flags.append(
            Flag(
                symptom="gearing too short for fast track",
                parameter="gearing",
                suggested_delta="consider -1–2 teeth on rear sprocket for taller gearing",
                confidence=0.65,
                reasoning=f"Current ratio {ratio:.2f} is short for a fast/flowing track. "
                "Taller gearing reduces unnecessary shifting on long straights.",
            )
        )

    # Check if track has many turns relative to length — another indicator.
    turns = (track_data or {}).get("turns")
    length_km = (track_data or {}).get("length_km")
    if turns and length_km and length_km > 0:
        turns_per_km = turns / length_km
        if turns_per_km > 8 and ratio < 2.8:
            flags.append(
                Flag(
                    symptom="gearing mismatch for turn-dense layout",
                    parameter="gearing",
                    suggested_delta="shorter gearing (+1 rear tooth)",
                    confidence=0.55,
                    reasoning=f"Track has {turns_per_km:.1f} turns/km — a dense layout that "
                    "rewards shorter gearing for quicker drive out of corners.",
                )
            )

    return flags


def _analyse_conditions(conditions: dict | None) -> list[Flag]:
    """Produce flags based on weather/surface conditions."""
    flags: list[Flag] = []
    if not conditions:
        return flags

    weather = (conditions.get("weather") or "").lower()
    surface = (conditions.get("surface") or "").lower()

    is_wet = any(kw in weather for kw in ("rain", "wet", "damp", "drizzle"))
    is_wet = is_wet or any(kw in surface for kw in ("wet", "damp", "greasy"))

    if is_wet:
        flags.append(
            Flag(
                symptom="wet conditions — softer baseline",
                parameter="front.compression",
                suggested_delta="-2–3 clicks (softer)",
                confidence=0.75,
                reasoning="In wet conditions the reduced grip means the tires need more "
                "mechanical compliance. Softer compression lets the fork absorb "
                "surface water and irregularities that would break traction.",
            )
        )
        flags.append(
            Flag(
                symptom="wet conditions — softer baseline",
                parameter="rear.compression",
                suggested_delta="-2–3 clicks (softer)",
                confidence=0.75,
                reasoning="Same principle as the front — the rear needs to track the "
                "surface closely in low-grip conditions.",
            )
        )
        flags.append(
            Flag(
                symptom="wet conditions — tire pressure",
                parameter="tire_pressure",
                suggested_delta="lower front and rear by 1–2 psi",
                confidence=0.70,
                reasoning="Lower tire pressure increases the contact patch in wet "
                "conditions, improving mechanical grip.",
            )
        )

    return flags


def _analyse_altitude_temperature(conditions: dict | None) -> list[Flag]:
    """Flag altitude and temperature effects on performance."""
    flags: list[Flag] = []
    if not conditions:
        return flags

    temperature_c = conditions.get("temperature_c") or conditions.get("temperature")
    altitude_m = conditions.get("altitude_m") or conditions.get("altitude")

    # High altitude — engine loses power, may need gearing adjustment.
    if altitude_m is not None:
        try:
            alt = float(altitude_m)
        except (TypeError, ValueError):
            alt = 0.0
        if alt > 1500:
            flags.append(
                Flag(
                    symptom="high altitude power loss",
                    parameter="gearing",
                    suggested_delta="consider -1 tooth rear for altitude compensation",
                    confidence=0.50,
                    reasoning=f"At {alt:.0f}m altitude, naturally aspirated engines lose "
                    "roughly 3% power per 300m above sea level. Shorter gearing "
                    "can partially compensate on corner exit.",
                )
            )

    # Extreme heat — tire pressure rises during the session.
    if temperature_c is not None:
        try:
            temp = float(temperature_c)
        except (TypeError, ValueError):
            temp = 20.0
        if temp > 35:
            flags.append(
                Flag(
                    symptom="high ambient temperature",
                    parameter="tire_pressure",
                    suggested_delta="start 1–2 psi lower than usual",
                    confidence=0.55,
                    reasoning=f"At {temp:.0f}°C the tires will build more pressure during the "
                    "session. Starting lower prevents over-pressure mid-session "
                    "which reduces grip.",
                )
            )
        elif temp < 10:
            flags.append(
                Flag(
                    symptom="cold ambient temperature",
                    parameter="tire_pressure",
                    suggested_delta="start 1–2 psi higher than usual",
                    confidence=0.55,
                    reasoning=f"At {temp:.0f}°C the tires will take longer to reach operating "
                    "temperature and may not build as much pressure. Starting "
                    "slightly higher ensures adequate pressure in the early laps.",
                )
            )

    return flags
