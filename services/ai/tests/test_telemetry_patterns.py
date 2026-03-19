"""Tests for rules_engine.telemetry_patterns."""

import pytest

from rules_engine.telemetry_patterns import analyse_telemetry
from rules_engine.flag import Flag


def _params(flags: list[Flag]) -> list[str]:
    return [f.parameter for f in flags]


# ── None / empty input ──


class TestEmptyInput:

    def test_none_returns_empty(self):
        assert analyse_telemetry(None) == []

    def test_empty_dict_returns_empty(self):
        assert analyse_telemetry({}) == []


# ── Braking zones ──


class TestBrakingZones:

    def test_low_consistency_flags_compression(self):
        data = {
            "braking_zones": [
                {"zone": "T3", "consistency": 0.4},
            ]
        }
        flags = analyse_telemetry(data)
        assert "front.compression" in _params(flags)

    def test_high_consistency_no_flag(self):
        data = {
            "braking_zones": [
                {"zone": "T1", "consistency": 0.9},
            ]
        }
        flags = analyse_telemetry(data)
        braking_flags = [f for f in flags if "braking" in f.symptom.lower()]
        assert len(braking_flags) == 0

    def test_high_variance_flags_compression(self):
        data = {
            "braking_zones": [
                {"zone": "T5", "variance": 0.5},
            ]
        }
        flags = analyse_telemetry(data)
        assert "front.compression" in _params(flags)

    def test_low_avg_consistency_flags_preload(self):
        data = {
            "braking_zones": [{"zone": "T1", "consistency": 0.9}],
            "braking_consistency_avg": 0.4,
        }
        flags = analyse_telemetry(data)
        assert "front.preload" in _params(flags)


# ── Fork rebound ──


class TestForkRebound:

    def test_too_slow_dict_flags_rebound(self):
        data = {"fork_rebound": {"too_slow": True}}
        flags = analyse_telemetry(data)
        assert "front.rebound" in _params(flags)
        flag = next(f for f in flags if f.parameter == "front.rebound")
        assert "slow" in flag.symptom.lower()

    def test_too_fast_dict_flags_rebound(self):
        data = {"fork_rebound": {"too_fast": True}}
        flags = analyse_telemetry(data)
        assert "front.rebound" in _params(flags)
        flag = next(f for f in flags if f.parameter == "front.rebound")
        assert "fast" in flag.symptom.lower()

    def test_raw_speed_below_threshold_flags(self):
        data = {"fork_rebound": 0.2}
        flags = analyse_telemetry(data)
        assert "front.rebound" in _params(flags)

    def test_raw_speed_above_threshold_no_flag(self):
        data = {"fork_rebound": 0.8}
        flags = analyse_telemetry(data)
        rebound_flags = [f for f in flags if f.parameter == "front.rebound"]
        assert len(rebound_flags) == 0


# ── TCS ──


class TestTCS:

    def test_high_interventions_flags_rebound_and_throttle(self):
        data = {"tcs": {"interventions": 20}}
        flags = analyse_telemetry(data)
        params = _params(flags)
        assert "rear.rebound" in params
        assert "throttle_delivery" in params

    def test_low_interventions_no_flag(self):
        data = {"tcs": {"interventions": 5}}
        flags = analyse_telemetry(data)
        tcs_flags = [f for f in flags if "TCS" in f.symptom or "tcs" in f.symptom.lower()]
        assert len(tcs_flags) == 0

    def test_numeric_tcs_above_threshold(self):
        data = {"tcs": 20}
        flags = analyse_telemetry(data)
        assert "rear.rebound" in _params(flags)

    def test_hotspot_above_threshold_flags(self):
        data = {
            "tcs": {
                "interventions": 5,
                "hotspots": [{"corner": "T7", "count": 8}],
            }
        }
        flags = analyse_telemetry(data)
        hotspot_flags = [f for f in flags if "T7" in f.symptom]
        assert len(hotspot_flags) == 1

    def test_hotspot_below_threshold_no_flag(self):
        data = {
            "tcs": {
                "interventions": 5,
                "hotspots": [{"corner": "T2", "count": 3}],
            }
        }
        flags = analyse_telemetry(data)
        hotspot_flags = [f for f in flags if "T2" in f.symptom]
        assert len(hotspot_flags) == 0


# ── Throttle pickup ──


class TestThrottlePickup:

    def test_late_sectors_flags_rear_compression(self):
        data = {"throttle_pickup": {"late_sectors": [3, 7]}}
        flags = analyse_telemetry(data)
        assert "rear.compression" in _params(flags)

    def test_no_late_sectors_no_flag(self):
        data = {"throttle_pickup": {"late_sectors": []}}
        flags = analyse_telemetry(data)
        throttle_flags = [f for f in flags if "throttle" in f.symptom.lower()]
        assert len(throttle_flags) == 0


# ── Lean angle ──


class TestLeanAngle:

    def test_left_asymmetry_flags_ride_height(self):
        data = {"lean_angle": {"asymmetry": 4.5}}
        flags = analyse_telemetry(data)
        assert "rear.ride_height" in _params(flags)
        flag = next(f for f in flags if f.parameter == "rear.ride_height")
        assert "left" in flag.symptom.lower()

    def test_right_asymmetry_flags_ride_height(self):
        data = {"lean_angle": {"asymmetry": -4.0}}
        flags = analyse_telemetry(data)
        assert "rear.ride_height" in _params(flags)
        flag = next(f for f in flags if f.parameter == "rear.ride_height")
        assert "right" in flag.symptom.lower()

    def test_small_asymmetry_no_flag(self):
        data = {"lean_angle": {"asymmetry": 2.0}}
        flags = analyse_telemetry(data)
        lean_flags = [f for f in flags if "asymmetry" in f.symptom.lower()]
        assert len(lean_flags) == 0


# ── Sorting ──


class TestSorting:

    def test_flags_sorted_by_confidence_descending(self):
        data = {
            "fork_rebound": {"too_slow": True},
            "tcs": {"interventions": 20},
            "lean_angle": {"asymmetry": 5.0},
        }
        flags = analyse_telemetry(data)
        confidences = [f.confidence for f in flags]
        assert confidences == sorted(confidences, reverse=True)
