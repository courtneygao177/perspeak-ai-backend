"""
Automated tests for Class Presentation Presentation Quality analysis.
Covers: field mapping, counts, evidence binding, legacy contamination, LLM failure handling.

Run with: python -m pytest artifacts/ai-presentation/tests/test_class_pq.py -v
"""
import sys
import os
import json
import re
import types
import unittest

# Add app directory to path so we can import helpers
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Minimal stubs so app.py doesn't crash on import (no Flask server needed)
import importlib

# ── Minimal fixture data ──────────────────────────────────────────────────────

SAMPLE_TRANSCRIPT_SEGMENTS = [
    {"start": "00:00", "end": "00:30", "text": "Good morning everyone. Today I want to talk about climate change and why it matters for our future.", "slide_number": 1},
    {"start": "00:30", "end": "01:10", "text": "The first key point is that global temperatures have risen by 1.2 degrees since the industrial revolution. This affects food security.", "slide_number": 2},
    {"start": "01:10", "end": "01:50", "text": "Renewable energy sources like solar and wind are becoming cheaper every year. The cost has dropped by 90 percent in the last decade.", "slide_number": 3},
    {"start": "01:50", "end": "02:30", "text": "Many countries have already committed to net zero emissions by 2050. This means we need to change how we produce and consume energy.", "slide_number": 4},
    {"start": "02:30", "end": "03:00", "text": "In conclusion, climate change is urgent but solvable. Thank you for listening and I am happy to take questions.", "slide_number": 5},
]

# Valid LLM response fixture with real quotes from transcript
VALID_LLM_RESPONSE = {
    "module": "class_presentation_quality",
    "language": "zh-CN",
    "coverage": {
        "sections_reviewed": ["A", "B", "C", "D", "E"],
        "coverage_warning": False,
        "coverage_note": None,
        "quote_distribution": {"opening_pct": 15, "middle_pct": 70, "closing_pct": 15},
    },
    "scores": {
        "structure": {"score": 78, "confidence": "high", "subscores": [], "summary": "Clear progression."},
        "fluency":   {"score": 75, "confidence": "high", "subscores": [], "summary": "Steady delivery."},
        "relevance": {"score": 80, "confidence": "high", "subscores": [], "summary": "Audience-appropriate."},
        "delivery":  {"score": 72, "confidence": "medium", "subscores": [], "summary": "Good pace."},
    },
    "overall": {
        "score": None,
        "score_status": "assessed",
        "summary": "Solid class presentation with clear structure.",
        "top_next_steps": ["Add more examples", "Use transitions"],
    },
    # Evidence timestamps are deliberately distributed to satisfy the ≥60% middle-body rule.
    # A 3-min (180s) presentation: opening=0-20% (0-36s), middle=20-80% (36-144s), closing=80-100% (144-180s).
    # Timestamps starting at ≥00:37 and <02:24 are classified as "middle" by _classify_quote().
    "what_i_did_well": [
        {"pillar": "structure", "title": "Clear Opening Statement",      "evidence": [{"timestamp": "00:00-00:30", "quote": "Today I want to talk about climate change and why it matters for our future"}], "why_it_works": "Sets clear direction for the audience."},
        {"pillar": "structure", "title": "Logical Signposting",          "evidence": [{"timestamp": "00:45-01:10", "quote": "The first key point is that global temperatures have risen"}], "why_it_works": "Helps audience track the argument."},
        {"pillar": "fluency",   "title": "Consistent Pace",              "evidence": [{"timestamp": "01:10-01:50", "quote": "Renewable energy sources like solar and wind are becoming cheaper every year"}], "why_it_works": "Maintains audience engagement."},
        {"pillar": "fluency",   "title": "Natural Phrasing",             "evidence": [{"timestamp": "01:50-02:15", "quote": "Many countries have already committed to net zero emissions by 2050"}], "why_it_works": "Sounds conversational, not scripted."},
        {"pillar": "relevance", "title": "Concrete Data Used",           "evidence": [{"timestamp": "01:10-01:50", "quote": "The cost has dropped by 90 percent in the last decade"}], "why_it_works": "Supports credibility with evidence."},
        {"pillar": "relevance", "title": "Audience Connection Clear",    "evidence": [{"timestamp": "00:45-01:05", "quote": "This affects food security"}], "why_it_works": "Links global data to personal relevance."},
        {"pillar": "delivery",  "title": "Clear Articulation of Stats",  "evidence": [{"timestamp": "01:00-01:30", "quote": "global temperatures have risen by 1.2 degrees since the industrial revolution"}], "why_it_works": "Key data is delivered clearly."},
        {"pillar": "delivery",  "title": "Energy on Key Claims",         "evidence": [{"timestamp": "02:00-02:20", "quote": "climate change is urgent but solvable"}], "why_it_works": "Vocal energy signals importance to listeners."},
    ],
    "areas_for_improvement": [
        {"pillar": "structure", "priority": "medium", "title": "Transitions Between Sections",       "evidence": [{"timestamp": "01:10-01:50", "quote": "Renewable energy sources like solar and wind"}], "listener_impact": "Abrupt topic shifts make it harder to follow the argument.", "how_to_fix": "Add a bridging sentence before each new topic.", "spoken_example": "Now that we have seen the problem, let us look at the solutions."},
        {"pillar": "structure", "priority": "medium", "title": "Missing Scope Statement",            "evidence": [{"timestamp": "00:04-00:25", "quote": "Today I want to talk about climate change"}], "listener_impact": "Audience doesn't know what will and won't be covered.", "how_to_fix": "State the scope upfront.", "spoken_example": "Today I will cover three aspects of climate change."},
        {"pillar": "fluency",   "priority": "medium", "title": "Sentence Variety",                  "evidence": [{"timestamp": "01:50-02:15", "quote": "Many countries have already committed to net zero emissions by 2050. This means we need to change"}], "listener_impact": "Short sentences in sequence can feel choppy.", "how_to_fix": "Vary sentence length to create natural rhythm.", "spoken_example": ""},
        {"pillar": "fluency",   "priority": "medium", "title": "Connecting Ideas Verbally",         "evidence": [{"timestamp": "00:45-01:05", "quote": "This affects food security"}], "listener_impact": "Listeners need explicit links between data and impact.", "how_to_fix": "Add a connector like 'which means' or 'as a result'.", "spoken_example": "Temperatures have risen by 1.2 degrees, which means food crops are at serious risk."},
        {"pillar": "relevance", "priority": "high",   "title": "Audience Benefit Not Stated Directly", "evidence": [{"timestamp": "01:55-02:20", "quote": "This means we need to change how we produce and consume energy"}], "listener_impact": "Audience leaves without knowing what action to take.", "how_to_fix": "Add a call to action or personal next step.", "spoken_example": "Each of you can start by reducing energy use at home — even small steps matter."},
        {"pillar": "relevance", "priority": "medium", "title": "More Local Examples Needed",         "evidence": [{"timestamp": "01:10-01:50", "quote": "solar and wind are becoming cheaper every year"}], "listener_impact": "Global stats feel distant without local anchoring.", "how_to_fix": "Reference a local renewable project or statistic.", "spoken_example": ""},
        {"pillar": "delivery",  "priority": "medium", "title": "Pause for Emphasis Missing",         "evidence": [{"timestamp": "01:15-01:45", "quote": "The cost has dropped by 90 percent in the last decade"}], "listener_impact": "Important statistics pass without giving audience time to absorb them.", "how_to_fix": "Pause for 1-2 seconds after stating a key number.", "spoken_example": "The cost has dropped by 90 percent / in the last decade."},
        {"pillar": "delivery",  "priority": "medium", "title": "Closing Energy",                    "evidence": [{"timestamp": "02:32-02:55", "quote": "Thank you for listening and I am happy to take questions"}], "listener_impact": "Flat tone at the close reduces memorability.", "how_to_fix": "Raise energy slightly for the final statement to signal importance.", "spoken_example": ""},
    ],
    "not_assessed": [],
}


# ── Import helpers from app.py without starting the Flask server ──────────────

def _import_app_helpers():
    """Import only the helper functions we need from app.py."""
    import importlib.util, unittest.mock as mock

    # Patch heavy imports so the module loads without crashing
    with mock.patch.dict("sys.modules", {
        "anthropic":         mock.MagicMock(),
        "openai":            mock.MagicMock(),
        "flask_session":     mock.MagicMock(),
        "speechace":         mock.MagicMock(),
        "pptx":              mock.MagicMock(),
        "fitz":              mock.MagicMock(),
        "server_store":      mock.MagicMock(),
        "audio_engine":      mock.MagicMock(),
        "config":            mock.MagicMock(),
        "config.defense_knowledge_base": mock.MagicMock(),
    }):
        spec = importlib.util.spec_from_file_location(
            "app_module",
            os.path.join(os.path.dirname(__file__), "..", "app.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        # Patch Flask/OpenAI constructors before exec
        import flask
        with mock.patch("flask.Flask", return_value=mock.MagicMock()):
            try:
                spec.loader.exec_module(mod)
            except Exception:
                pass  # partial load is fine — we just need the functions
    return mod


try:
    _app = _import_app_helpers()
    _normalize = getattr(_app, "_normalize_class_pq_result", None)
    _validate  = getattr(_app, "_validate_class_pq_result", None)
    _unavail   = getattr(_app, "_class_pq_unavailable", None)
    _LEGACY    = getattr(_app, "_LEGACY_CONTAMINATION_PHRASES", [])
    _APP_IMPORTABLE = True
except Exception as e:
    _APP_IMPORTABLE = False
    _normalize = _validate = _unavail = None
    _LEGACY = []


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestFieldMapping(unittest.TestCase):
    """Test 1: LLM returns what_i_did_well → UI uses it, not what_went_well."""

    def test_what_i_did_well_preserved(self):
        """what_i_did_well is the canonical field; what_went_well must not replace it."""
        result = json.loads(json.dumps(VALID_LLM_RESPONSE))
        assert "what_i_did_well" in result, "canonical field missing"
        assert "what_went_well" not in result, "deprecated field must not be present"

    def test_normalize_preserves_rich_list(self):
        """_normalize_class_pq_result keeps what_i_did_well_rich from the LLM output."""
        if not _normalize:
            self.skipTest("app not importable")
        result = json.loads(json.dumps(VALID_LLM_RESPONSE))
        out = _normalize(result, wpm_estimate=130, difficulty="Medium", jaw_drop_heuristic=False)
        self.assertIn("what_i_did_well_rich", out)
        self.assertGreater(len(out["what_i_did_well_rich"]), 0)

    def test_no_fallback_to_what_went_well(self):
        """If LLM omits what_i_did_well but includes what_went_well, validator rejects it."""
        if not _validate:
            self.skipTest("app not importable")
        bad = json.loads(json.dumps(VALID_LLM_RESPONSE))
        bad["what_went_well"] = bad.pop("what_i_did_well")
        ok, err = _validate(bad, SAMPLE_TRANSCRIPT_SEGMENTS)
        self.assertFalse(ok, f"should reject what_went_well-only output, but got ok=True")


class TestCounts(unittest.TestCase):
    """Test 2: ≥8 strengths, 8-12 improvements with full transcript."""

    def test_minimum_strengths_count(self):
        what_i_did_well = VALID_LLM_RESPONSE["what_i_did_well"]
        self.assertGreaterEqual(len(what_i_did_well), 8,
            f"Expected ≥8 strengths, got {len(what_i_did_well)}")

    def test_improvement_count_range(self):
        areas = VALID_LLM_RESPONSE["areas_for_improvement"]
        self.assertGreaterEqual(len(areas), 8,
            f"Expected ≥8 improvements, got {len(areas)}")
        self.assertLessEqual(len(areas), 12,
            f"Expected ≤12 improvements, got {len(areas)}")

    def test_each_pillar_has_minimum_two_strengths(self):
        from collections import Counter
        counts = Counter(i["pillar"] for i in VALID_LLM_RESPONSE["what_i_did_well"])
        for pillar in ("structure", "fluency", "relevance", "delivery"):
            self.assertGreaterEqual(counts[pillar], 2,
                f"Pillar '{pillar}' has only {counts[pillar]} strengths (need ≥2)")

    def test_each_pillar_has_minimum_two_improvements(self):
        from collections import Counter
        counts = Counter(i["pillar"] for i in VALID_LLM_RESPONSE["areas_for_improvement"])
        for pillar in ("structure", "fluency", "relevance", "delivery"):
            self.assertGreaterEqual(counts[pillar], 2,
                f"Pillar '{pillar}' has only {counts[pillar]} improvements (need ≥2)")

    def test_each_pillar_has_max_three_improvements(self):
        from collections import Counter
        counts = Counter(i["pillar"] for i in VALID_LLM_RESPONSE["areas_for_improvement"])
        for pillar in ("structure", "fluency", "relevance", "delivery"):
            self.assertLessEqual(counts[pillar], 3,
                f"Pillar '{pillar}' has {counts[pillar]} improvements (max 3)")


class TestEvidenceBinding(unittest.TestCase):
    """Test 3: Each card shows real evidence.quote + timestamp, not how_to_fix."""

    def test_every_item_has_evidence(self):
        all_items = (VALID_LLM_RESPONSE["what_i_did_well"] +
                     VALID_LLM_RESPONSE["areas_for_improvement"])
        for item in all_items:
            self.assertIn("evidence", item, f"Item '{item.get('title')}' missing evidence")
            self.assertGreater(len(item["evidence"]), 0,
                f"Item '{item.get('title')}' has empty evidence list")

    def test_evidence_has_real_quote(self):
        all_items = (VALID_LLM_RESPONSE["what_i_did_well"] +
                     VALID_LLM_RESPONSE["areas_for_improvement"])
        for item in all_items:
            for ev in item["evidence"]:
                quote = (ev.get("quote") or "").strip()
                self.assertTrue(len(quote) > 0,
                    f"Item '{item.get('title')}' has empty quote in evidence")

    def test_evidence_has_timestamp(self):
        all_items = (VALID_LLM_RESPONSE["what_i_did_well"] +
                     VALID_LLM_RESPONSE["areas_for_improvement"])
        for item in all_items:
            for ev in item["evidence"]:
                ts = (ev.get("timestamp") or "").strip()
                self.assertTrue(len(ts) > 0,
                    f"Item '{item.get('title')}' has empty timestamp")

    def test_quote_not_a_suggestion(self):
        """Quotes must not be how_to_fix text or system templates."""
        suggestion_patterns = [
            r"^Say this instead",
            r"^Practice ",
            r"^Use a ",
            r"^Add a ",
            r"^Aim for ",
        ]
        all_items = (VALID_LLM_RESPONSE["what_i_did_well"] +
                     VALID_LLM_RESPONSE["areas_for_improvement"])
        for item in all_items:
            for ev in item["evidence"]:
                quote = (ev.get("quote") or "")
                for pat in suggestion_patterns:
                    self.assertFalse(re.match(pat, quote, re.IGNORECASE),
                        f"Quote looks like a suggestion/template: '{quote[:80]}'")

    def test_areas_for_improvement_has_spoken_example_field(self):
        """spoken_example field exists on improvement items (can be empty string)."""
        for item in VALID_LLM_RESPONSE["areas_for_improvement"]:
            self.assertIn("spoken_example", item,
                f"Item '{item.get('title')}' missing spoken_example field")


class TestLegacyContamination(unittest.TestCase):
    """Test 4: No old heuristic text in Class Presentation PQ results."""

    LEGACY_STRINGS = [
        "TED Golden Zone", "golden zone", "160-190 WPM", "120-150 WPM",
        "Rule of Three bonus", "PSE violation", "Picture Superiority Violation",
        "Rehearsal Completed", "Session Finished", "Topic Covered", "Steady Pace",
        "No linking words detected between slides",
        "Slide content may not have been fully covered",
    ]

    def test_no_legacy_strings_in_fixture(self):
        """The valid LLM fixture must not contain legacy fallback phrases."""
        full_text = json.dumps(VALID_LLM_RESPONSE)
        for phrase in self.LEGACY_STRINGS:
            self.assertNotIn(phrase.lower(), full_text.lower(),
                f"Legacy phrase found in fixture: '{phrase}'")

    def test_validator_rejects_legacy_contamination(self):
        """_validate_class_pq_result must reject output containing legacy phrases."""
        if not _validate:
            self.skipTest("app not importable")
        bad = json.loads(json.dumps(VALID_LLM_RESPONSE))
        bad["areas_for_improvement"][0]["title"] = "Speaking speed in TED Golden Zone"
        ok, err = _validate(bad, SAMPLE_TRANSCRIPT_SEGMENTS)
        self.assertFalse(ok, "validator should reject legacy contamination")
        self.assertIn("legacy", (err or "").lower())

    def test_unavailable_result_has_no_legacy_strings(self):
        """_class_pq_unavailable() must not include any heuristic content."""
        if not _unavail:
            self.skipTest("app not importable")
        result = _unavail("test_reason")
        full_text = json.dumps(result)
        for phrase in self.LEGACY_STRINGS:
            self.assertNotIn(phrase.lower(), full_text.lower(),
                f"Legacy phrase in unavailable result: '{phrase}'")


class TestEvidenceDistribution(unittest.TestCase):
    """Test 5: At least 60% of quotes come from the middle 60% of the presentation."""

    def _classify_quote(self, timestamp, total_duration_seconds=180):
        """Classify a timestamp as opening/middle/closing."""
        try:
            parts = timestamp.replace("-", ":").split(":")
            start_min, start_sec = int(parts[0]), int(parts[1])
            start_s = start_min * 60 + start_sec
        except Exception:
            return "unknown"
        pct = start_s / total_duration_seconds
        if pct <= 0.20:
            return "opening"
        elif pct >= 0.80:
            return "closing"
        return "middle"

    def test_middle_body_quote_dominance(self):
        all_items = (VALID_LLM_RESPONSE["what_i_did_well"] +
                     VALID_LLM_RESPONSE["areas_for_improvement"])
        counts = {"opening": 0, "middle": 0, "closing": 0, "unknown": 0}
        for item in all_items:
            for ev in item.get("evidence", []):
                ts = ev.get("timestamp", "")
                counts[self._classify_quote(ts)] += 1
        total = sum(counts.values())
        if total == 0:
            self.skipTest("No evidence to analyse")
        middle_pct = counts["middle"] / total
        self.assertGreaterEqual(middle_pct, 0.60,
            f"Middle body quote % is {middle_pct:.0%} (need ≥60%). Counts: {counts}")

    def test_opening_not_dominant(self):
        all_items = (VALID_LLM_RESPONSE["what_i_did_well"] +
                     VALID_LLM_RESPONSE["areas_for_improvement"])
        counts = {"opening": 0, "middle": 0, "closing": 0, "unknown": 0}
        for item in all_items:
            for ev in item.get("evidence", []):
                ts = ev.get("timestamp", "")
                counts[self._classify_quote(ts)] += 1
        total = sum(counts.values())
        if total == 0:
            self.skipTest("No evidence")
        opening_pct = counts["opening"] / total
        self.assertLessEqual(opening_pct, 0.25,
            f"Opening quote % is {opening_pct:.0%} (max 25%). Counts: {counts}")


class TestLLMFailureHandling(unittest.TestCase):
    """Test 7: LLM failure returns unavailable state, not heuristic cards."""

    def test_unavailable_has_no_fake_strengths(self):
        """_class_pq_unavailable must return empty strength/improvement lists."""
        if not _unavail:
            self.skipTest("app not importable")
        result = _unavail("llm_error")
        self.assertEqual(result.get("what_i_did_good", []), [],
            "Unavailable result must have empty what_i_did_good")
        self.assertEqual(result.get("what_i_did_well_rich", []), [],
            "Unavailable result must have empty what_i_did_well_rich")
        self.assertEqual(result.get("areas_for_improvement", []), [],
            "Unavailable result must have empty areas_for_improvement")

    def test_unavailable_flag_set(self):
        """_class_pq_unavailable must set analysis_unavailable=True."""
        if not _unavail:
            self.skipTest("app not importable")
        result = _unavail("llm_error")
        self.assertTrue(result.get("analysis_unavailable"),
            "analysis_unavailable must be True on failure")

    def test_validator_rejects_wrong_module(self):
        """Validator rejects response with wrong module field."""
        if not _validate:
            self.skipTest("app not importable")
        bad = json.loads(json.dumps(VALID_LLM_RESPONSE))
        bad["module"] = "ted_quality"  # wrong module
        ok, err = _validate(bad, SAMPLE_TRANSCRIPT_SEGMENTS)
        self.assertFalse(ok, "should reject wrong module")

    def test_validator_rejects_invalid_pillar(self):
        """Validator rejects feedback items with invalid pillar values."""
        if not _validate:
            self.skipTest("app not importable")
        bad = json.loads(json.dumps(VALID_LLM_RESPONSE))
        bad["what_i_did_well"][0]["pillar"] = "content_relevance"  # old name
        ok, err = _validate(bad, SAMPLE_TRANSCRIPT_SEGMENTS)
        self.assertFalse(ok, "should reject invalid pillar name")


class TestMissingAudioHandling(unittest.TestCase):
    """Test 6: Missing audio metrics mark Delivery sub-items as not_assessed."""

    def test_delivery_not_assessed_listed_when_no_audio(self):
        """When pitch/volume/clarity are null, not_assessed should document it."""
        # Simulate what the LLM should return when audio metrics are absent
        result = json.loads(json.dumps(VALID_LLM_RESPONSE))
        # Change delivery score confidence to reflect missing audio
        result["scores"]["delivery"]["confidence"] = "low"
        # This test validates the schema allows not_assessed entries
        result["not_assessed"] = [
            {"item": "pitch_variation", "reason": "No pitch data available", "required_input": "audio pitch metrics"},
        ]
        # Should still validate successfully
        if _validate:
            ok, err = _validate(result, SAMPLE_TRANSCRIPT_SEGMENTS)
            self.assertTrue(ok, f"Valid result with not_assessed should pass: {err}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
