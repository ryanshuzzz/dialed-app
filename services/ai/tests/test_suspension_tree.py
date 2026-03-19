import pytest

from rules_engine.suspension_tree import analyse_feedback
from rules_engine.flag import Flag


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _full_suspension_spec():
    """Return a suspension_spec with both front and rear populated."""
    return {
        "front": {
            "compression": 12,
            "rebound": 10,
            "preload": 5.0,
        },
        "rear": {
            "compression": 10,
            "rebound": 8,
            "preload": 6.0,
            "ride_height": 0.0,
        },
    }


def _params(flags: list[Flag]) -> list[str]:
    return [f.parameter for f in flags]


# ---------------------------------------------------------------------------
# Basic matching
# ---------------------------------------------------------------------------

class TestFrontPushFeedback:
    """'front push' is a multi-word match -> confidence 0.9."""

    def test_returns_compression_and_preload_flags(self):
        flags = analyse_feedback("front push", _full_suspension_spec(), [])
        params = _params(flags)
        assert "front.compression" in params
        assert "front.preload" in params

    def test_confidence_is_exact(self):
        flags = analyse_feedback("front push", _full_suspension_spec(), [])
        for f in flags:
            assert f.confidence == 0.9

    def test_symptom_text(self):
        flags = analyse_feedback("front push", _full_suspension_spec(), [])
        symptoms = {f.symptom for f in flags}
        assert "front end push/wash" in symptoms


class TestHeadshakeFeedback:
    """'headshake' -> front.rebound and steering_damper."""

    def test_returns_rebound_and_steering_damper(self):
        flags = analyse_feedback("headshake", _full_suspension_spec(), [])
        params = _params(flags)
        assert "front.rebound" in params
        assert "steering_damper" in params


# ---------------------------------------------------------------------------
# Empty / None feedback
# ---------------------------------------------------------------------------

class TestEmptyFeedback:

    def test_none_returns_empty(self):
        assert analyse_feedback(None, _full_suspension_spec(), []) == []

    def test_empty_string_returns_empty(self):
        assert analyse_feedback("", _full_suspension_spec(), []) == []

    def test_whitespace_only_returns_empty(self):
        assert analyse_feedback("   ", _full_suspension_spec(), []) == []


# ---------------------------------------------------------------------------
# Change log filtering
# ---------------------------------------------------------------------------

class TestChangeLogSkipping:

    def test_already_changed_parameter_is_excluded(self):
        change_log = [{"parameter": "front.compression"}]
        flags = analyse_feedback("front push", _full_suspension_spec(), change_log)
        params = _params(flags)
        assert "front.compression" not in params
        # front.preload should still be present
        assert "front.preload" in params

    def test_all_parameters_changed_returns_empty_for_pattern(self):
        change_log = [
            {"parameter": "front.compression"},
            {"parameter": "front.preload"},
        ]
        flags = analyse_feedback("front push", _full_suspension_spec(), change_log)
        assert len(flags) == 0


# ---------------------------------------------------------------------------
# Missing suspension_spec end -> confidence lowered
# ---------------------------------------------------------------------------

class TestMissingSuspensionSpecEnd:

    def test_no_front_key_lowers_confidence(self):
        spec = {"rear": {"compression": 10}}  # no "front"
        flags = analyse_feedback("front push", spec, [])
        front_flags = [f for f in flags if f.parameter.startswith("front.")]
        assert len(front_flags) > 0
        for f in front_flags:
            assert f.confidence == 0.5

    def test_front_present_keeps_confidence_high(self):
        flags = analyse_feedback("front push", _full_suspension_spec(), [])
        front_flags = [f for f in flags if f.parameter.startswith("front.")]
        for f in front_flags:
            assert f.confidence == 0.9


# ---------------------------------------------------------------------------
# Multiple complaints in one text
# ---------------------------------------------------------------------------

class TestMultipleComplaints:

    def test_two_patterns_produce_combined_flags(self):
        feedback = "I'm getting front push into turn 3 and headshake on the exit"
        flags = analyse_feedback(feedback, _full_suspension_spec(), [])
        params = _params(flags)
        # front push flags
        assert "front.compression" in params
        assert "front.preload" in params
        # headshake flags
        assert "front.rebound" in params
        assert "steering_damper" in params

    def test_flags_sorted_by_confidence_descending(self):
        feedback = "harsh ride and headshake"
        flags = analyse_feedback(feedback, _full_suspension_spec(), [])
        confidences = [f.confidence for f in flags]
        assert confidences == sorted(confidences, reverse=True)


# ---------------------------------------------------------------------------
# Single-word match -> confidence 0.5
# ---------------------------------------------------------------------------

class TestSingleWordMatch:

    def test_harsh_gives_fuzzy_confidence(self):
        flags = analyse_feedback("harsh", _full_suspension_spec(), [])
        assert len(flags) > 0
        for f in flags:
            assert f.confidence == 0.5

    def test_harsh_returns_compression_flags(self):
        flags = analyse_feedback("harsh", _full_suspension_spec(), [])
        params = _params(flags)
        assert "front.compression" in params
        assert "rear.compression" in params


# ---------------------------------------------------------------------------
# Misc edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def test_case_insensitive(self):
        flags = analyse_feedback("FRONT PUSH", _full_suspension_spec(), [])
        assert len(flags) > 0

    def test_empty_suspension_spec_still_works(self):
        flags = analyse_feedback("front push", {}, [])
        assert len(flags) > 0
        # confidence lowered because "front" key is missing
        for f in flags:
            if f.parameter.startswith("front."):
                assert f.confidence == 0.5

    def test_flags_have_all_fields(self):
        flags = analyse_feedback("rear kick", _full_suspension_spec(), [])
        assert len(flags) > 0
        for f in flags:
            assert isinstance(f, Flag)
            assert f.symptom
            assert f.parameter
            assert f.suggested_delta
            assert f.reasoning
            assert 0.0 <= f.confidence <= 1.0
