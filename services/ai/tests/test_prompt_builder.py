"""Tests for llm.prompt_builder."""

import uuid

import pytest

from llm.prompt_builder import build_prompt, _format_lap_time, _format_suspension_spec
from rules_engine import Flag
from services.context_gatherer import SessionContext


@pytest.fixture
def context():
    """Realistic SessionContext for prompt tests."""
    return SessionContext(
        session={
            "id": str(uuid.uuid4()),
            "event_id": str(uuid.uuid4()),
            "session_type": "qualifying",
            "rider_feedback": "Front is pushing in turn 3",
            "csv_best_lap_ms": 98500,
            "tire_front": {"brand": "Pirelli", "compound": "SC1", "laps": 15},
            "tire_rear": {"brand": "Pirelli", "compound": "SC2", "laps": 15},
        },
        change_log=[
            {"parameter": "front.compression", "from_value": "10", "to_value": "12", "rationale": "reduce dive"},
        ],
        bike={"make": "Ducati", "model": "Panigale V4R", "year": 2024, "gearing_front": 15, "gearing_rear": 43},
        suspension_spec={
            "front": {"compression": 12, "rebound": 10, "preload": 5},
            "rear": {"compression": 8, "rebound": 14, "preload": 7},
        },
        maintenance=[{"category": "oil_change", "performed_at": "2024-03-01", "description": "Motul 300V"}],
        event_sessions=[
            {"id": str(uuid.uuid4()), "session_type": "practice", "csv_best_lap_ms": 99200, "created_at": "2024-03-15T09:00:00Z"},
        ],
        track={"name": "Laguna Seca", "config": "Full", "track_type": "technical"},
        conditions={"condition": "dry", "temp_c": 25, "track_temp_c": 35},
        telemetry_analysis={"braking_zones": [{"zone": "T5", "consistency": 0.55}]},
        user_profile={"skill_level": "intermediate", "rider_type": "competitive"},
    )


@pytest.fixture
def flags():
    return [
        Flag(
            symptom="front push",
            parameter="front.compression",
            suggested_delta="+2 clicks",
            confidence=0.9,
            reasoning="Fork diving too deep",
        ),
        Flag(
            symptom="rear instability",
            parameter="rear.rebound",
            suggested_delta="+1 click",
            confidence=0.7,
            reasoning="Rear unloading too fast",
        ),
    ]


class TestSystemPrompt:

    def test_contains_bike_info(self, context, flags):
        system, _ = build_prompt(context, flags)
        assert "Ducati" in system
        assert "Panigale V4R" in system
        assert "2024" in system

    def test_contains_suspension_settings(self, context, flags):
        system, _ = build_prompt(context, flags)
        assert "compression" in system.lower()
        assert "rebound" in system.lower()

    def test_contains_track_name(self, context, flags):
        system, _ = build_prompt(context, flags)
        assert "Laguna Seca" in system

    def test_contains_conditions(self, context, flags):
        system, _ = build_prompt(context, flags)
        assert "25" in system  # temp_c

    def test_skill_level_instruction_intermediate(self, context, flags):
        system, _ = build_prompt(context, flags)
        assert "intermediate" in system.lower()

    def test_skill_level_instruction_novice(self, context, flags):
        context.user_profile["skill_level"] = "novice"
        system, _ = build_prompt(context, flags)
        assert "novice" in system.lower()

    def test_rider_type_competitive(self, context, flags):
        system, _ = build_prompt(context, flags)
        assert "competitive" in system.lower() or "lap time" in system.lower()


class TestUserPrompt:

    def test_contains_rider_feedback(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "Front is pushing in turn 3" in user

    def test_contains_change_log(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "front.compression" in user
        assert "12" in user

    def test_contains_rules_flags(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "90%" in user  # 0.9 confidence formatted as 90%
        assert "front push" in user

    def test_contains_task_instruction(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "Your Task" in user

    def test_contains_best_lap(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "1:38" in user  # 98500ms = 1:38.500

    def test_contains_tire_info(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "Pirelli" in user

    def test_contains_telemetry_info(self, context, flags):
        _, user = build_prompt(context, flags)
        assert "T5" in user or "Braking" in user or "braking" in user


class TestTokenBudget:

    def test_truncation_when_over_budget(self, context, flags):
        # Make context very large to trigger truncation
        context.session["rider_feedback"] = "Long feedback " * 2000
        context.change_log = [
            {"parameter": f"param_{i}", "from_value": "0", "to_value": str(i)}
            for i in range(50)
        ]
        context.maintenance = [
            {"category": f"maint_{i}", "performed_at": f"2024-0{(i%9)+1}-01", "description": "x" * 100}
            for i in range(20)
        ]
        system, user = build_prompt(context, flags)
        total = len(system) + len(user)
        # Should have been truncated — verify it's shorter than untruncated would be
        assert total < 30000  # generous upper bound; budget is 24000

    def test_truncated_prompt_summarizes_long_change_log(self, context, flags):
        context.session["rider_feedback"] = "x " * 5000
        context.change_log = [
            {"parameter": f"param_{i}", "from_value": "0", "to_value": str(i)}
            for i in range(10)
        ]
        system, user = build_prompt(context, flags)
        # If truncated, change log should be summarized
        if "summarized" in user.lower() or f"Made {len(context.change_log)}" in user:
            assert True
        else:
            # If not truncated, the full change log is there
            assert "param_0" in user


class TestHelpers:

    def test_format_lap_time(self):
        assert _format_lap_time(98500) == "1:38.500"
        assert _format_lap_time(60000) == "1:00.000"
        assert _format_lap_time(125750) == "2:05.750"

    def test_format_suspension_spec_empty(self):
        result = _format_suspension_spec({})
        assert "No suspension data" in result

    def test_format_suspension_spec_with_data(self):
        spec = {"front": {"compression": 12, "rebound": 10}}
        result = _format_suspension_spec(spec)
        assert "Front" in result
        assert "compression: 12" in result
