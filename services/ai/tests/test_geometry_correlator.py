"""Tests for rules_engine.geometry_correlator."""

import pytest

from rules_engine.geometry_correlator import analyse_geometry
from rules_engine.flag import Flag


def _params(flags: list[Flag]) -> list[str]:
    return [f.parameter for f in flags]


# ── Gearing analysis ──


class TestGearingAnalysis:

    def test_tight_track_tall_gearing_flags(self):
        bike = {"gearing_front": 15, "gearing_rear": 40}  # ratio 2.67
        track = {"track_type": "tight technical"}
        flags = analyse_geometry(bike, track, None)
        assert "gearing" in _params(flags)
        gearing_flag = next(f for f in flags if f.parameter == "gearing")
        assert "short" in gearing_flag.symptom or "tall" in gearing_flag.symptom

    def test_fast_track_short_gearing_flags(self):
        bike = {"gearing_front": 15, "gearing_rear": 50}  # ratio 3.33
        track = {"track_type": "fast flowing"}
        flags = analyse_geometry(bike, track, None)
        assert "gearing" in _params(flags)

    def test_no_gearing_data_no_flags(self):
        bike = {}
        track = {"track_type": "tight"}
        flags = analyse_geometry(bike, track, None)
        gearing_flags = [f for f in flags if f.parameter == "gearing"]
        assert len(gearing_flags) == 0

    def test_no_track_data_no_gearing_flags(self):
        bike = {"gearing_front": 15, "gearing_rear": 40}
        flags = analyse_geometry(bike, None, None)
        gearing_flags = [f for f in flags if f.parameter == "gearing"]
        assert len(gearing_flags) == 0

    def test_turn_dense_track_short_gearing_flag(self):
        bike = {"gearing_front": 15, "gearing_rear": 40}  # ratio 2.67
        track = {"track_type": "circuit", "turns": 20, "length_km": 2.0}  # 10 turns/km
        flags = analyse_geometry(bike, track, None)
        assert "gearing" in _params(flags)


# ── Wet conditions ──


class TestWetConditions:

    def test_rain_weather_produces_compression_and_tire_flags(self):
        conditions = {"weather": "rain", "surface": "wet"}
        flags = analyse_geometry({}, None, conditions)
        params = _params(flags)
        assert "front.compression" in params
        assert "rear.compression" in params
        assert "tire_pressure" in params

    def test_damp_surface_triggers_wet_flags(self):
        conditions = {"weather": "overcast", "surface": "damp"}
        flags = analyse_geometry({}, None, conditions)
        assert "front.compression" in _params(flags)

    def test_dry_conditions_no_wet_flags(self):
        conditions = {"weather": "sunny", "surface": "dry"}
        flags = analyse_geometry({}, None, conditions)
        wet_flags = [f for f in flags if "wet" in (f.symptom or "").lower()]
        assert len(wet_flags) == 0


# ── Altitude and temperature ──


class TestAltitudeTemperature:

    def test_high_altitude_gearing_flag(self):
        conditions = {"altitude_m": 2000}
        flags = analyse_geometry({}, None, conditions)
        assert "gearing" in _params(flags)
        flag = next(f for f in flags if f.parameter == "gearing")
        assert "altitude" in flag.symptom.lower()

    def test_low_altitude_no_flag(self):
        conditions = {"altitude_m": 500}
        flags = analyse_geometry({}, None, conditions)
        alt_flags = [f for f in flags if "altitude" in (f.symptom or "").lower()]
        assert len(alt_flags) == 0

    def test_hot_temperature_tire_pressure_flag(self):
        conditions = {"temperature_c": 40}
        flags = analyse_geometry({}, None, conditions)
        assert "tire_pressure" in _params(flags)
        flag = next(f for f in flags if f.parameter == "tire_pressure")
        assert "high" in flag.symptom.lower() or "hot" in flag.symptom.lower()

    def test_cold_temperature_tire_pressure_flag(self):
        conditions = {"temperature_c": 5}
        flags = analyse_geometry({}, None, conditions)
        assert "tire_pressure" in _params(flags)
        flag = next(f for f in flags if f.parameter == "tire_pressure")
        assert "cold" in flag.symptom.lower()

    def test_normal_temperature_no_flag(self):
        conditions = {"temperature_c": 22}
        flags = analyse_geometry({}, None, conditions)
        temp_flags = [
            f for f in flags
            if f.parameter == "tire_pressure"
            and ("hot" in f.symptom.lower() or "cold" in f.symptom.lower() or "temperature" in f.symptom.lower())
        ]
        assert len(temp_flags) == 0


# ── Edge cases ──


class TestEdgeCases:

    def test_all_none_returns_empty(self):
        flags = analyse_geometry({}, None, None)
        assert flags == []

    def test_flags_sorted_by_confidence(self):
        conditions = {"weather": "rain", "altitude_m": 2000, "temperature_c": 40}
        flags = analyse_geometry({}, None, conditions)
        confidences = [f.confidence for f in flags]
        assert confidences == sorted(confidences, reverse=True)
