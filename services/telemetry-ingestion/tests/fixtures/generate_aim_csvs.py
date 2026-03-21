"""Generator script for AiM CSV test fixture files.

Run once to (re)generate:
    python tests/fixtures/generate_aim_csvs.py

Output files:
    tests/fixtures/aim_csvs/11.csv  -- QP6 qualifying,   best lap 105,972 ms
    tests/fixtures/aim_csvs/12.csv  -- Saturday warmup,  best lap 107,337 ms
    tests/fixtures/aim_csvs/13.csv  -- Friday practice2, best lap 126,998 ms
    tests/fixtures/aim_csvs/14.csv  -- Friday practice1, best lap 110,023 ms

Format:
    20 Hz (0.05 s per row), ISO-8601 timestamps in the Time column.
    Using ISO timestamps (not elapsed float seconds) ensures exact millisecond
    arithmetic when the parser computes elapsed_s via timedelta.total_seconds().
    Beacon column: 0 normally, 1 for exactly one row at each lap boundary
    (rising-edge detection in csv_parser._detect_from_beacon).
    13 core channels + GrpPct stored in extra_channels overflow.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List

HEADER = (
    "Time,GPS Speed,Throttle,Engine RPM,Gear,Lean Angle,"
    "Front Brake,Rear Brake,Fork Pos,Shock Pos,"
    "Coolant Temp,Oil Temp,Latitude,Longitude,Beacon,GrpPct"
)

# Arbitrary session start time.  All lap times are offsets from this.
SESSION_START = datetime(2026, 3, 7, 10, 0, 0, tzinfo=timezone.utc)

# Buttonwillow TC#1 approximate start/finish GPS co-ordinates.
BASE_LAT = 35.9933
BASE_LON = -119.5425

# Sample interval at 20 Hz.
DT_MS = 50  # milliseconds


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class LapSpec:
    """Defines the character of a single lap."""

    duration_ms: int          # exact lap time
    max_speed: float          # peak GPS speed (kph)
    max_throttle: float       # peak throttle %
    max_grppct: float         # GrpPct cap (throttle-body limit)
    max_brake_psi: float      # peak front brake pressure (bar/psi — same unit as test)
    max_fork_mm: float        # peak fork compression mm
    lean_peak: float          # peak lean angle (degrees)
    rpm_peak: float           # peak RPM


# ---------------------------------------------------------------------------
# Waveform helpers
# ---------------------------------------------------------------------------


def _smooth_pulse(
    t_norm: float,
    center: float,
    half_width: float,
    amplitude: float,
    base: float = 0.0,
) -> float:
    """Raised-cosine pulse centred at *center* on t in [0, 1]."""
    dist = abs(t_norm - center)
    if dist > half_width:
        return base
    return base + amplitude * 0.5 * (1.0 + math.cos(math.pi * dist / half_width))


# ---------------------------------------------------------------------------
# Lap row builder
# ---------------------------------------------------------------------------


def build_lap_rows(spec: LapSpec, t_start_ms: int) -> List[dict]:
    """Return a list of row dicts for one lap.

    ``t_start_ms`` is the lap start time in whole milliseconds relative to
    SESSION_START.  Each row's Time is an ISO-8601 string derived from
    SESSION_START + timedelta(milliseconds=t_ms) so that the parser's
    ``timedelta.total_seconds()`` gives exact integer-millisecond results.
    """
    # Number of 50 ms samples.  For non-50ms durations, the last row falls
    # just before the duration; the next lap's beacon starts the new lap.
    n = spec.duration_ms // DT_MS

    rows = []
    for i in range(n):
        t_ms = t_start_ms + i * DT_MS
        ts = SESSION_START + timedelta(milliseconds=t_ms)
        p = i / max(n - 1, 1)  # 0→1 normalised position within lap

        # Speed profile: two straights with braking zones.
        speed = (
            spec.max_speed * 0.3
            + _smooth_pulse(p, 0.20, 0.15, spec.max_speed * 0.55)  # straight 1
            + _smooth_pulse(p, 0.65, 0.15, spec.max_speed * 0.60)  # straight 2
            - _smooth_pulse(p, 0.37, 0.06, spec.max_speed * 0.45)  # brake zone 1
            - _smooth_pulse(p, 0.82, 0.06, spec.max_speed * 0.45)  # brake zone 2
        )
        speed = max(speed, spec.max_speed * 0.05)

        # Throttle (two open-throttle phases).
        throttle = (
            _smooth_pulse(p, 0.20, 0.15, spec.max_throttle)
            + _smooth_pulse(p, 0.65, 0.15, spec.max_throttle)
        )
        throttle = min(throttle, spec.max_throttle)

        # GrpPct: follows throttle but hard-capped at max_grppct.
        grppct = min(throttle, spec.max_grppct)

        # Front brake pressure (two braking zones).
        brake_front = (
            _smooth_pulse(p, 0.37, 0.06, spec.max_brake_psi)
            + _smooth_pulse(p, 0.82, 0.06, spec.max_brake_psi)
        )
        brake_rear = brake_front * 0.15

        # Fork compression.
        fork = (
            _smooth_pulse(p, 0.37, 0.07, spec.max_fork_mm)
            + _smooth_pulse(p, 0.82, 0.07, spec.max_fork_mm)
        )

        # Shock position.
        shock = spec.max_fork_mm * 0.4 * abs(math.sin(p * math.pi * 4))

        # Lean angle: sinusoidal through corners.
        lean = spec.lean_peak * math.sin(p * math.pi * 6)

        # RPM tracks speed.
        rpm = 4000 + spec.rpm_peak * (speed / spec.max_speed)

        # Gear estimate from speed.
        if speed < 60:
            gear = 2
        elif speed < 100:
            gear = 3
        elif speed < 140:
            gear = 4
        elif speed < 180:
            gear = 5
        else:
            gear = 6

        # Temps: warm up slightly.
        coolant = 85.0 + 5.0 * min(p * 4, 1.0)
        oil = 90.0 + 8.0 * min(p * 4, 1.0)

        # GPS: small ellipse around the base start/finish point.
        angle = p * 2 * math.pi
        lat = BASE_LAT + 0.003 * math.sin(angle)
        lon = BASE_LON + 0.004 * math.cos(angle)

        rows.append({
            "ts": ts.isoformat(),
            "speed": round(speed, 2),
            "throttle": round(throttle, 2),
            "rpm": round(rpm, 0),
            "gear": gear,
            "lean": round(lean, 3),
            "brake_front": round(brake_front, 3),
            "brake_rear": round(brake_rear, 3),
            "fork": round(fork, 3),
            "shock": round(shock, 3),
            "coolant": round(coolant, 1),
            "oil": round(oil, 1),
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "beacon": 0,
            "grppct": round(grppct, 2),
        })

    # Mark the first row of each lap as a beacon rising edge.
    if rows:
        rows[0]["beacon"] = 1

    return rows


# ---------------------------------------------------------------------------
# Session definitions
# ---------------------------------------------------------------------------


def _qualifying_laps() -> List[LapSpec]:
    """11.csv — QP6 qualifying.  Best lap is lap 4 at exactly 105,972 ms."""
    base = LapSpec(
        duration_ms=0,
        max_speed=250.0,      # ~155 mph in kph
        max_throttle=83.0,
        max_grppct=57.0,      # GRPPCT cap the workflow test expects
        max_brake_psi=15.63,  # ~227 psi
        max_fork_mm=114.7,
        lean_peak=48.0,
        rpm_peak=11500.0,
    )
    return [
        LapSpec(**{**base.__dict__, "duration_ms": 112_450}),  # out-lap
        LapSpec(**{**base.__dict__, "duration_ms": 108_200}),
        LapSpec(**{**base.__dict__, "duration_ms": 106_800}),
        LapSpec(**{**base.__dict__, "duration_ms": 105_972}),  # best lap — must be exact
        LapSpec(**{**base.__dict__, "duration_ms": 107_100}),
    ]


def _warmup_laps() -> List[LapSpec]:
    """12.csv — Saturday warmup.  Best lap at exactly 107,337 ms."""
    base = LapSpec(
        duration_ms=0,
        max_speed=240.0,
        max_throttle=79.0,
        max_grppct=56.0,
        max_brake_psi=14.80,
        max_fork_mm=110.2,
        lean_peak=45.0,
        rpm_peak=11200.0,
    )
    return [
        LapSpec(**{**base.__dict__, "duration_ms": 115_000}),  # out-lap
        LapSpec(**{**base.__dict__, "duration_ms": 110_500}),
        LapSpec(**{**base.__dict__, "duration_ms": 107_337}),  # best lap — must be exact
        LapSpec(**{**base.__dict__, "duration_ms": 109_200}),
    ]


def _practice2_laps() -> List[LapSpec]:
    """13.csv — Friday practice 2.  Best lap at exactly 126,998 ms."""
    base = LapSpec(
        duration_ms=0,
        max_speed=225.0,
        max_throttle=72.0,
        max_grppct=52.0,
        max_brake_psi=13.50,
        max_fork_mm=105.0,
        lean_peak=40.0,
        rpm_peak=10800.0,
    )
    return [
        LapSpec(**{**base.__dict__, "duration_ms": 140_000}),  # out-lap
        LapSpec(**{**base.__dict__, "duration_ms": 132_000}),
        LapSpec(**{**base.__dict__, "duration_ms": 128_500}),
        LapSpec(**{**base.__dict__, "duration_ms": 126_998}),  # best lap — must be exact
        LapSpec(**{**base.__dict__, "duration_ms": 130_100}),
    ]


def _practice1_laps() -> List[LapSpec]:
    """14.csv — Friday practice 1.  Best lap at exactly 110,023 ms."""
    base = LapSpec(
        duration_ms=0,
        max_speed=232.0,
        max_throttle=76.0,
        max_grppct=54.0,
        max_brake_psi=14.20,
        max_fork_mm=108.0,
        lean_peak=42.0,
        rpm_peak=11000.0,
    )
    return [
        LapSpec(**{**base.__dict__, "duration_ms": 120_000}),  # out-lap
        LapSpec(**{**base.__dict__, "duration_ms": 114_800}),
        LapSpec(**{**base.__dict__, "duration_ms": 111_500}),
        LapSpec(**{**base.__dict__, "duration_ms": 110_023}),  # best lap — must be exact
        LapSpec(**{**base.__dict__, "duration_ms": 112_200}),
    ]


# ---------------------------------------------------------------------------
# CSV writer
# ---------------------------------------------------------------------------


def write_csv(path: str, laps: List[LapSpec]) -> None:
    # Track lap-start in whole milliseconds; advance by integer lap durations.
    # This prevents float accumulation drift.  Rows are timestamped via
    # SESSION_START + timedelta(milliseconds=...) so the parser's
    # timedelta.total_seconds() arithmetic is exact.
    t_cursor_ms = 0
    all_rows = []

    for spec in laps:
        rows = build_lap_rows(spec, t_cursor_ms)
        all_rows.extend(rows)
        t_cursor_ms += spec.duration_ms

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "\n")
        for row in all_rows:
            fh.write(
                f"{row['ts']},"
                f"{row['speed']},"
                f"{row['throttle']},"
                f"{row['rpm']:.0f},"
                f"{row['gear']},"
                f"{row['lean']},"
                f"{row['brake_front']},"
                f"{row['brake_rear']},"
                f"{row['fork']},"
                f"{row['shock']},"
                f"{row['coolant']},"
                f"{row['oil']},"
                f"{row['lat']},"
                f"{row['lon']},"
                f"{row['beacon']},"
                f"{row['grppct']}\n"
            )

    total_rows = len(all_rows)
    lap_times = [s.duration_ms for s in laps]
    best = min(lap_times)
    print(
        f"  {os.path.basename(path)}: {total_rows} rows, "
        f"{len(laps)} laps, best lap {best} ms"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(script_dir, "aim_csvs")
    os.makedirs(out_dir, exist_ok=True)

    sessions = [
        ("11.csv", _qualifying_laps()),
        ("12.csv", _warmup_laps()),
        ("13.csv", _practice2_laps()),
        ("14.csv", _practice1_laps()),
    ]

    print("Generating AiM CSV fixtures...")
    for filename, laps in sessions:
        path = os.path.join(out_dir, filename)
        write_csv(path, laps)

    print("Done.")


if __name__ == "__main__":
    main()
