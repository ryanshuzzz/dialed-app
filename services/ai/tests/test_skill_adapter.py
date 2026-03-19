"""Tests for llm.skill_adapter."""

from llm.skill_adapter import adapt_language


class TestIntermediate:

    def test_returns_text_unchanged(self):
        text = "Adjust rebound damping by +2 clicks."
        assert adapt_language(text, "intermediate") == text

    def test_unknown_level_returns_unchanged(self):
        text = "Adjust sag settings."
        assert adapt_language(text, "unknown_level") == text


class TestNovice:

    def test_adds_rebound_damping_explanation(self):
        text = "Adjust rebound damping by +2 clicks."
        result = adapt_language(text, "novice")
        assert "controls how fast" in result
        assert "extends back out" in result

    def test_adds_compression_damping_explanation(self):
        text = "Increase compression damping."
        result = adapt_language(text, "novice")
        assert "controls how fast" in result
        assert "compresses" in result

    def test_adds_preload_explanation(self):
        text = "Adjust preload by +1mm."
        result = adapt_language(text, "novice")
        assert "pre-compressed" in result or "ride height" in result

    def test_adds_sag_explanation(self):
        text = "Check sag is correct."
        result = adapt_language(text, "novice")
        assert "rider's weight" in result

    def test_only_first_occurrence_expanded(self):
        text = "Adjust preload. Then check preload again."
        result = adapt_language(text, "novice")
        # Should have exactly one expanded explanation
        count = result.count("pre-compressed")
        assert count == 1


class TestExpert:

    def test_strips_parenthetical_explanations(self):
        text = "Adjust preload (how much the spring is pre-compressed — affects ride height and sag) by +2mm."
        result = adapt_language(text, "expert")
        assert "(how much" not in result
        assert "preload" in result
        assert "+2mm" in result

    def test_preserves_text_without_explanations(self):
        text = "Increase front compression by 2 clicks."
        result = adapt_language(text, "expert")
        assert result == text

    def test_strips_controls_how_parentheticals(self):
        text = "Adjust rebound damping (controls how fast your fork extends) by +1 click."
        result = adapt_language(text, "expert")
        assert "(controls how" not in result
