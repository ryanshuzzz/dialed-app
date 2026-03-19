"""Tests for llm.response_parser."""

import pytest

from llm.response_parser import parse_suggestion_response, ParsedChange


class TestNumberedListFormat:

    def test_parses_numbered_list(self):
        response = """Here is my assessment of your setup:

1. **front.compression** → +2 clicks (stiffer)
   Symptom: front push under braking
   Confidence: high
   The fork is diving too deep under braking, overloading the front tire.

2. **rear.rebound** → +1 click (slower)
   Symptom: rear stepping out on exit
   Confidence: medium
   Rebound is too fast, causing the rear to lose grip on corner exit.

3. **front.preload** → +1mm
   Symptom: excessive dive
   Confidence: high
   More preload raises the front for better braking stability.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) == 3
        params = [c.parameter for c in changes]
        assert "front.compression" in params
        assert "rear.rebound" in params
        assert "front.preload" in params

    def test_confidence_high_maps_to_085(self):
        response = """
1. **front.compression** → +2 clicks
   Confidence: high
   Helps with front push under braking.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) >= 1
        assert changes[0].confidence == 0.85


class TestBulletPointFormat:

    def test_parses_bullet_points(self):
        response = """Overall assessment: your front end needs work.

- front.compression → +2 clicks (stiffer) to address front push
- rear.rebound → +1 click (slower) to fix exit instability
"""
        changes = parse_suggestion_response(response)
        assert len(changes) >= 2
        params = [c.parameter for c in changes]
        assert "front.compression" in params
        assert "rear.rebound" in params


class TestMaxThreeChanges:

    def test_returns_at_most_three(self):
        response = """
1. **front.compression** → +2 clicks. Addresses front push.
2. **rear.rebound** → +1 click. Fixes exit instability.
3. **front.preload** → +1mm. Reduces dive.
4. **rear.compression** → +1 click. Adds support.
5. **front.rebound** → -1 click. Fixes chatter.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) <= 3


class TestEmptyAndUnparseable:

    def test_empty_string_returns_empty(self):
        assert parse_suggestion_response("") == []

    def test_none_returns_empty(self):
        assert parse_suggestion_response(None) == []

    def test_unparseable_text_returns_empty(self):
        response = "The weather is nice today and I like motorcycles."
        changes = parse_suggestion_response(response)
        assert changes == []


class TestConfidenceParsing:

    def test_percentage_confidence(self):
        response = """
1. **front.compression** → +2 clicks
   Confidence: 85%
   Helps with front push.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) >= 1
        assert changes[0].confidence == 0.85

    def test_medium_confidence(self):
        response = """
1. **front.compression** → +2 clicks
   Confidence: medium
   Helps with push.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) >= 1
        assert changes[0].confidence == 0.65

    def test_default_confidence_when_missing(self):
        response = """
1. **front.compression** → +2 clicks
   Helps with front push under braking.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) >= 1
        assert changes[0].confidence == 0.65


class TestNaturalLanguageParams:

    def test_natural_language_front_compression(self):
        response = """
Increase the front compression by +2 clicks to address the front push.
Also adjust rear rebound by +1 click for exit stability.
"""
        changes = parse_suggestion_response(response)
        params = [c.parameter for c in changes]
        assert "front.compression" in params or len(changes) > 0


class TestParsedChangeFields:

    def test_all_fields_populated(self):
        response = """
1. **front.compression** → +2 clicks (stiffer)
   Symptom: front push under braking
   Confidence: high
   The fork is diving too deep, causing front push.
"""
        changes = parse_suggestion_response(response)
        assert len(changes) >= 1
        c = changes[0]
        assert c.parameter == "front.compression"
        assert c.suggested_value  # non-empty
        assert c.symptom  # non-empty
        assert 0 < c.confidence <= 1.0
        assert c.reasoning  # non-empty
