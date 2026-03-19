"""Builds system and user prompts for Claude suggestion generation.

Assembles all gathered context into a structured prompt with token budget
management. If the total exceeds ~6000 tokens, truncates in priority order
while never dropping current session data or rules engine flags.
"""

from __future__ import annotations

import json

from rules_engine import Flag
from services.context_gatherer import SessionContext

from .skill_adapter import adapt_language

# Rough estimate: ~4 chars per token for English text.
_CHARS_PER_TOKEN = 4
_TOKEN_BUDGET = 6000
_MAX_CHARS = _TOKEN_BUDGET * _CHARS_PER_TOKEN  # ~24000 chars


def build_prompt(
    context: SessionContext,
    flags: list[Flag],
) -> tuple[str, str]:
    """Build system and user prompts for Claude.

    Args:
        context: Gathered session context from Core API / Telemetry.
        flags: Rules engine flags sorted by confidence descending.

    Returns:
        Tuple of (system_prompt, user_prompt).
    """
    skill_level = context.user_profile.get("skill_level", "intermediate")
    rider_type = context.user_profile.get("rider_type", "casual_track")

    system_prompt = _build_system_prompt(context, skill_level, rider_type)
    user_prompt = _build_user_prompt(context, flags, skill_level)

    # Token budget: if combined prompts exceed budget, truncate user prompt.
    total_chars = len(system_prompt) + len(user_prompt)
    if total_chars > _MAX_CHARS:
        user_prompt = _truncate_user_prompt(context, flags, skill_level)

    return system_prompt, user_prompt


def _build_system_prompt(
    context: SessionContext,
    skill_level: str,
    rider_type: str,
) -> str:
    """Build the system prompt with role, bike specs, and track info."""
    bike = context.bike
    suspension = context.suspension_spec
    track = context.track
    conditions = context.conditions

    skill_instruction = {
        "novice": (
            "The rider is a novice. Use clear, simple language. Explain "
            "technical terms when you first use them. Focus on the most "
            "impactful change and explain why it will help."
        ),
        "intermediate": (
            "The rider has intermediate experience. Use standard technical "
            "language. Explain your reasoning but assume basic suspension "
            "knowledge."
        ),
        "expert": (
            "The rider is an expert. Use precise technical terminology. "
            "Include numerical reasoning and be concise. They understand "
            "the physics — focus on the data-driven rationale."
        ),
    }.get(skill_level, "Use standard technical language.")

    rider_type_note = {
        "street": "This is primarily a street rider. Prioritize comfort, safety, and progressive handling over lap time.",
        "casual_track": "This is a casual track rider. Balance between safety/confidence and pace improvement.",
        "competitive": "This is a competitive racer. Prioritize lap time and precision. They accept trade-offs for speed.",
    }.get(rider_type, "")

    parts = [
        "You are an expert motorcycle suspension tuner and setup advisor. "
        "You analyze rider feedback, telemetry data, bike specifications, "
        "and track conditions to recommend precise suspension adjustments.",
        "",
        skill_instruction,
        "",
        rider_type_note,
    ]

    # Bike specs
    if bike:
        bike_desc = f"Bike: {bike.get('make', '?')} {bike.get('model', '?')}"
        if bike.get("year"):
            bike_desc += f" ({bike['year']})"
        parts.append("")
        parts.append(f"## Bike\n{bike_desc}")

        extras = []
        if bike.get("exhaust"):
            extras.append(f"Exhaust: {bike['exhaust']}")
        if bike.get("ecu"):
            extras.append(f"ECU: {bike['ecu']}")
        if bike.get("gearing_front") and bike.get("gearing_rear"):
            extras.append(f"Gearing: {bike['gearing_front']}/{bike['gearing_rear']}")
        if extras:
            parts.append("\n".join(extras))

    # Suspension spec
    if suspension:
        parts.append("")
        parts.append("## Current Suspension Settings")
        parts.append(_format_suspension_spec(suspension))

    # Track and conditions
    if track:
        parts.append("")
        track_desc = f"## Track\n{track.get('name', 'Unknown')}"
        if track.get("config"):
            track_desc += f" ({track['config']})"
        parts.append(track_desc)

    if conditions:
        parts.append("")
        parts.append("## Conditions")
        parts.append(_format_conditions(conditions))

    return "\n".join(parts)


def _build_user_prompt(
    context: SessionContext,
    flags: list[Flag],
    skill_level: str,
) -> str:
    """Build the user prompt with session data, flags, and instructions."""
    parts: list[str] = []

    # Current session
    session = context.session
    parts.append("## Current Session")
    session_info = []
    if session.get("session_type"):
        session_info.append(f"Type: {session['session_type']}")
    if session.get("rider_feedback"):
        session_info.append(f"Rider feedback: \"{session['rider_feedback']}\"")
    best_lap = session.get("csv_best_lap_ms") or session.get("manual_best_lap_ms")
    if best_lap:
        session_info.append(f"Best lap: {_format_lap_time(best_lap)}")
    if session.get("tire_front"):
        session_info.append(f"Front tire: {_format_tire(session['tire_front'])}")
    if session.get("tire_rear"):
        session_info.append(f"Rear tire: {_format_tire(session['tire_rear'])}")
    parts.append("\n".join(session_info) if session_info else "No session details available.")

    # Change log for this session
    if context.change_log:
        parts.append("")
        parts.append("## Changes Already Made This Session")
        for entry in context.change_log:
            line = f"- {entry.get('parameter', '?')}: "
            if entry.get("from_value"):
                line += f"{entry['from_value']} → "
            line += f"{entry.get('to_value', '?')}"
            if entry.get("rationale"):
                line += f" ({entry['rationale']})"
            parts.append(line)

    # Event progression (other sessions from the same event)
    other_sessions = [
        s for s in context.event_sessions
        if s.get("id") != session.get("id")
    ]
    if other_sessions:
        parts.append("")
        parts.append("## Event Progression (other sessions today)")
        for s in sorted(other_sessions, key=lambda x: x.get("created_at", "")):
            lap = s.get("csv_best_lap_ms") or s.get("manual_best_lap_ms")
            lap_str = _format_lap_time(lap) if lap else "no time"
            parts.append(f"- {s.get('session_type', '?')}: {lap_str}")
            if s.get("rider_feedback"):
                parts.append(f"  Feedback: \"{s['rider_feedback']}\"")

    # Rules engine flags
    if flags:
        parts.append("")
        parts.append("## Rules Engine Analysis (automated pre-screening)")
        for flag in flags:
            parts.append(
                f"- [{flag.confidence:.0%} confidence] {flag.symptom}: "
                f"{flag.parameter} → {flag.suggested_delta}"
            )
            parts.append(f"  Reasoning: {flag.reasoning}")

    # Telemetry analysis
    if context.telemetry_analysis:
        parts.append("")
        parts.append("## Telemetry Analysis")
        parts.append(_format_telemetry_summary(context.telemetry_analysis))

    # Maintenance context
    if context.maintenance:
        parts.append("")
        parts.append("## Recent Maintenance")
        for entry in context.maintenance[:5]:
            parts.append(
                f"- {entry.get('category', '?')} on {entry.get('performed_at', '?')}"
            )
            if entry.get("description"):
                parts.append(f"  {entry['description']}")

    # Final instruction
    parts.append("")
    instruction = (
        "## Your Task\n"
        "Based on all the context above, recommend your top 3 suspension "
        "changes. For each change, specify:\n"
        "1. **Parameter**: The exact suspension parameter (e.g. front.compression, "
        "rear.rebound, front.preload)\n"
        "2. **Suggested value/delta**: The specific adjustment (e.g. '+2 clicks', "
        "'reduce by 1mm')\n"
        "3. **Symptom**: What handling problem this addresses\n"
        "4. **Confidence**: Your confidence level (high/medium/low)\n\n"
        "Start with a brief overall assessment, then list your 3 recommendations. "
        "Explain the reasoning for each in a way the rider will find actionable."
    )
    parts.append(adapt_language(instruction, skill_level))

    return "\n".join(parts)


def _truncate_user_prompt(
    context: SessionContext,
    flags: list[Flag],
    skill_level: str,
) -> str:
    """Build a truncated user prompt that fits within token budget.

    Truncation priority (drop first → last):
    1. Sessions from older events (keep only current event)
    2. Summarize older change_log entries into one paragraph
    3. Trim maintenance to last 3 entries
    Never truncate: current session data, rules engine flags.
    """
    parts: list[str] = []

    # Current session — never truncated
    session = context.session
    parts.append("## Current Session")
    session_info = []
    if session.get("session_type"):
        session_info.append(f"Type: {session['session_type']}")
    if session.get("rider_feedback"):
        session_info.append(f"Rider feedback: \"{session['rider_feedback']}\"")
    best_lap = session.get("csv_best_lap_ms") or session.get("manual_best_lap_ms")
    if best_lap:
        session_info.append(f"Best lap: {_format_lap_time(best_lap)}")
    if session.get("tire_front"):
        session_info.append(f"Front tire: {_format_tire(session['tire_front'])}")
    if session.get("tire_rear"):
        session_info.append(f"Rear tire: {_format_tire(session['tire_rear'])}")
    parts.append("\n".join(session_info) if session_info else "No session details available.")

    # Change log — summarize if long
    if context.change_log:
        parts.append("")
        if len(context.change_log) > 3:
            parts.append("## Changes This Session (summarized)")
            params_changed = [e.get("parameter", "?") for e in context.change_log]
            parts.append(
                f"Made {len(context.change_log)} changes to: "
                f"{', '.join(params_changed)}. "
                f"Most recent: {context.change_log[-1].get('parameter', '?')} "
                f"→ {context.change_log[-1].get('to_value', '?')}."
            )
        else:
            parts.append("## Changes Already Made This Session")
            for entry in context.change_log:
                line = f"- {entry.get('parameter', '?')}: "
                if entry.get("from_value"):
                    line += f"{entry['from_value']} → "
                line += f"{entry.get('to_value', '?')}"
                parts.append(line)

    # Event progression — keep only most recent other session
    other_sessions = [
        s for s in context.event_sessions
        if s.get("id") != session.get("id")
    ]
    if other_sessions:
        most_recent = sorted(
            other_sessions, key=lambda x: x.get("created_at", "")
        )[-1]
        parts.append("")
        parts.append("## Previous Session (most recent)")
        lap = most_recent.get("csv_best_lap_ms") or most_recent.get("manual_best_lap_ms")
        lap_str = _format_lap_time(lap) if lap else "no time"
        parts.append(f"- {most_recent.get('session_type', '?')}: {lap_str}")

    # Rules engine flags — never truncated
    if flags:
        parts.append("")
        parts.append("## Rules Engine Analysis")
        for flag in flags:
            parts.append(
                f"- [{flag.confidence:.0%}] {flag.symptom}: "
                f"{flag.parameter} → {flag.suggested_delta}"
            )

    # Telemetry — keep but abbreviated
    if context.telemetry_analysis:
        parts.append("")
        parts.append("## Telemetry (summary)")
        summary = _format_telemetry_summary(context.telemetry_analysis)
        # Truncate telemetry to first 500 chars if needed
        if len(summary) > 500:
            summary = summary[:500] + "..."
        parts.append(summary)

    # Maintenance — max 3
    if context.maintenance:
        parts.append("")
        parts.append("## Recent Maintenance")
        for entry in context.maintenance[:3]:
            parts.append(
                f"- {entry.get('category', '?')} on {entry.get('performed_at', '?')}"
            )

    # Final instruction (always included)
    parts.append("")
    instruction = (
        "## Your Task\n"
        "Recommend your top 3 suspension changes. For each: parameter name, "
        "suggested value/delta, symptom it addresses, and confidence level."
    )
    parts.append(adapt_language(instruction, skill_level))

    return "\n".join(parts)


# ── Formatting helpers ──


def _format_suspension_spec(spec: dict) -> str:
    """Format suspension spec into readable text."""
    lines = []
    for end in ("front", "rear"):
        end_spec = spec.get(end)
        if not end_spec:
            continue
        label = "Front" if end == "front" else "Rear"
        settings = []
        for key in ("compression", "rebound", "preload", "spring_rate", "oil_level", "ride_height"):
            val = end_spec.get(key)
            if val is not None:
                settings.append(f"{key}: {val}")
        if settings:
            lines.append(f"{label}: {', '.join(settings)}")
    return "\n".join(lines) if lines else "No suspension data available."


def _format_conditions(conditions: dict) -> str:
    """Format weather/track conditions into readable text."""
    parts = []
    if conditions.get("condition"):
        parts.append(f"Surface: {conditions['condition']}")
    if conditions.get("temp_c") is not None:
        parts.append(f"Air temp: {conditions['temp_c']}°C")
    if conditions.get("track_temp_c") is not None:
        parts.append(f"Track temp: {conditions['track_temp_c']}°C")
    if conditions.get("humidity_pct") is not None:
        parts.append(f"Humidity: {conditions['humidity_pct']}%")
    if conditions.get("wind_kph") is not None:
        parts.append(f"Wind: {conditions['wind_kph']} km/h")
    if conditions.get("notes"):
        parts.append(f"Notes: {conditions['notes']}")
    return "\n".join(parts) if parts else "No conditions data."


def _format_lap_time(ms: int) -> str:
    """Format milliseconds as M:SS.mmm."""
    minutes = ms // 60000
    seconds = (ms % 60000) / 1000
    return f"{minutes}:{seconds:06.3f}"


def _format_tire(tire: dict) -> str:
    """Format a tire snapshot dict."""
    parts = []
    if tire.get("brand"):
        parts.append(tire["brand"])
    if tire.get("compound"):
        parts.append(tire["compound"])
    if tire.get("laps") is not None:
        parts.append(f"{tire['laps']} laps")
    return " / ".join(parts) if parts else "unknown"


def _format_telemetry_summary(analysis: dict) -> str:
    """Format telemetry analysis dict into a readable summary."""
    parts = []

    braking = analysis.get("braking_zones")
    if braking and isinstance(braking, list):
        parts.append(f"Braking zones analyzed: {len(braking)}")
        low_consistency = [
            z for z in braking
            if (z.get("consistency") or 1.0) < 0.7
        ]
        if low_consistency:
            zones = ", ".join(
                str(z.get("zone") or z.get("corner") or "?")
                for z in low_consistency
            )
            parts.append(f"Low-consistency braking at: {zones}")

    fork = analysis.get("fork_rebound")
    if fork:
        if isinstance(fork, dict):
            if fork.get("too_slow"):
                parts.append("Fork rebound: too slow (packing risk)")
            elif fork.get("too_fast"):
                parts.append("Fork rebound: too fast (headshake risk)")
        else:
            parts.append(f"Fork rebound speed: {fork}")

    tcs = analysis.get("tcs") or analysis.get("traction_control")
    if tcs:
        count = tcs if isinstance(tcs, (int, float)) else (
            tcs.get("interventions") or tcs.get("count") or 0
        )
        if count:
            parts.append(f"TCS interventions: {int(count)}")

    throttle = analysis.get("throttle_pickup") or analysis.get("throttle")
    if isinstance(throttle, dict) and throttle.get("late_sectors"):
        parts.append(f"Late throttle pickup in sectors: {throttle['late_sectors']}")

    return "\n".join(parts) if parts else json.dumps(analysis, indent=2)[:800]
