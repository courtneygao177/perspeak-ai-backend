"""Regression tests for Thesis Defense Presentation Quality safeguards."""
import copy
import json
import os
import sys
import types
import unittest
from unittest import mock


APP_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, APP_DIR)

from app import (  # noqa: E402
    _normalize_thesis_pq_result,
    _thesis_snap_evidence_quotes,
    _thesis_pq_unavailable,
    _validate_thesis_pq_result,
)
import app as app_module  # noqa: E402


SEGMENTS = [
    {"timestamp_start": 0, "timestamp_end": 30, "section": "opening", "text": "This study examines how first generation students access mental health support at university. The research question asks which institutional barriers most affect help seeking."},
    {"timestamp_start": 30, "timestamp_end": 75, "section": "early_body", "text": "I used semi structured interviews with twenty four students because their experiences required detailed explanation. The sampling strategy included students from three faculties and two years of study."},
    {"timestamp_start": 75, "timestamp_end": 120, "section": "late_body", "text": "The findings show that uncertainty about confidentiality was the most common barrier. Participants also described long waiting times as a reason to delay contacting support services."},
    {"timestamp_start": 120, "timestamp_end": 165, "section": "conclusion", "text": "These findings answer the research question by showing that access depends on trust as well as availability. The study therefore recommends clearer confidentiality information at the first point of contact."},
]


QUOTES = [
    "This study examines how first generation students access mental health support at university",
    "The research question asks which institutional barriers most affect help seeking",
    "I used semi structured interviews with twenty four students because their experiences required detailed explanation",
    "The sampling strategy included students from three faculties and two years of study",
    "The findings show that uncertainty about confidentiality was the most common barrier",
    "Participants also described long waiting times as a reason to delay contacting support services",
    "These findings answer the research question by showing that access depends on trust as well as availability",
    "The study therefore recommends clearer confidentiality information at the first point of contact",
    "first generation students access mental health support at university",
    "institutional barriers most affect help seeking",
    "semi structured interviews with twenty four students",
    "students from three faculties and two years of study",
    "uncertainty about confidentiality was the most common barrier",
    "long waiting times as a reason to delay contacting support services",
    "access depends on trust as well as availability",
    "clearer confidentiality information at the first point of contact",
]


def _item(dimension, quote, index, improvement=False):
    segment = SEGMENTS[index % len(SEGMENTS)]
    base = {
        "dimension": dimension,
        "title": f"Evidence point {index + 1}",
        "evidence_quote": quote,
        "timestamp_start": segment["timestamp_start"],
        "timestamp_end": segment["timestamp_end"],
        "transcript_section": segment["section"],
    }
    if improvement:
        base.update({
            "priority": "medium",
            "impact": "A clearer connection would help the committee follow the research story.",
            "actionable_next_step": "Add one concise link before moving to the next research stage.",
            "say_this_instead": "This finding directly answers the research question.",
        })
    else:
        base["analysis"] = "This gives the committee a concrete part of the research narrative."
    return base


VALID_RESULT = {
    "analysis_status": "insufficient_evidence",
    "analysis_scope": "thesis_defense_presentation_only",
    "coverage_warning": None,
    "radar_scores": {"structure": 80, "fluency": 80, "relevance": 83, "delivery": 82},
    "overall_score": 81,
    "dimensions_info": {
        "structure": {"subscores": {"research_focus_opening": 6, "research_chain": 8, "explicit_links_transitions": 6, "conclusion_closure": 4}, "score_rationale": "A clear research path is present.", "evidence_coverage": {}},
        "fluency": {"subscores": {"complete_natural_expression": 6, "connection_pacing": 5, "comprehension_first_pace": 3, "self_repair": 2}, "score_rationale": "The speech is mostly understandable.", "evidence_coverage": {}},
        "relevance": {"subscores": {"research_focus_visible": 7, "key_information_prioritisation": 6, "findings_contribution_meaning": 7, "committee_appropriate_explanation": 5}, "score_rationale": "The research focus remains visible.", "evidence_coverage": {}},
        "delivery": {"subscores": {"audible_clarity_emphasis": 6, "professional_stable_presence": 5, "audience_guidance": 3, "non_verbal": {"status": "not_assessed", "score": None}}, "score_rationale": "No non-verbal inference is made.", "evidence_coverage": {}},
    },
    "what_i_did_well": [],
    "areas_for_improvement": [],
    "next_actions": [{"priority": 1, "action": "Rehearse links between the findings and contribution.", "why": "This keeps the research story visible."}],
}

for idx, dimension in enumerate(("Structure", "Structure", "Fluency", "Fluency", "Relevance", "Relevance", "Delivery", "Delivery")):
    VALID_RESULT["what_i_did_well"].append(_item(dimension, QUOTES[idx], idx))
for idx, dimension in enumerate(("Structure", "Structure", "Fluency", "Fluency", "Relevance", "Relevance", "Delivery", "Delivery"), start=8):
    VALID_RESULT["areas_for_improvement"].append(_item(dimension, QUOTES[idx], idx, improvement=True))


class TestThesisDefensePQ(unittest.TestCase):
    def test_valid_evidence_first_result_is_accepted(self):
        ok, error = _validate_thesis_pq_result(copy.deepcopy(VALID_RESULT), SEGMENTS, 190)
        self.assertTrue(ok, error)

    def test_rejects_question_and_answer_text_as_evidence(self):
        result = copy.deepcopy(VALID_RESULT)
        result["what_i_did_well"][0]["evidence_quote"] = "Professor, that is a very important question"
        ok, error = _validate_thesis_pq_result(result, SEGMENTS, 190)
        self.assertFalse(ok)
        self.assertIn("transcript substring", error)

    def test_snaps_a_near_verbatim_quote_to_the_exact_transcript(self):
        result = copy.deepcopy(VALID_RESULT)
        result["what_i_did_well"][0]["evidence_quote"] = (
            "This study explores how first generation students access mental health support at university"
        )
        repaired = _thesis_snap_evidence_quotes(result, SEGMENTS)
        self.assertEqual(
            repaired["what_i_did_well"][0]["evidence_quote"],
            "This study examines how first generation students access mental health support at university",
        )
        ok, error = _validate_thesis_pq_result(repaired, SEGMENTS, 190)
        self.assertTrue(ok, error)

    def test_rejects_old_ted_language(self):
        result = copy.deepcopy(VALID_RESULT)
        result["dimensions_info"]["delivery"]["score_rationale"] = "The TED golden zone was achieved."
        ok, error = _validate_thesis_pq_result(result, SEGMENTS, 190)
        self.assertFalse(ok)
        self.assertIn("legacy contamination", error)

    def test_short_rehearsal_cannot_claim_a_complete_audit(self):
        result = copy.deepcopy(VALID_RESULT)
        result["analysis_status"] = "complete"
        ok, error = _validate_thesis_pq_result(result, SEGMENTS, 190)
        self.assertFalse(ok)
        self.assertIn("short Thesis Defense rehearsal", error)

    def test_normalizer_preserves_four_dimension_card_contract(self):
        output = _normalize_thesis_pq_result(copy.deepcopy(VALID_RESULT), SEGMENTS)
        self.assertEqual(set(output["scores"]), {"structure", "fluency", "relevance", "delivery"})
        self.assertEqual(len(output["what_i_did_well_rich"]), 8)
        self.assertEqual(len(output["areas_for_improvement"]), 8)
        self.assertEqual(output["pitch_data"], [])
        self.assertFalse(output["analysis_unavailable"])

    def test_not_evaluable_returns_honest_unavailable_state(self):
        output = _thesis_pq_unavailable("presentation_not_evaluable")
        self.assertTrue(output["analysis_unavailable"])
        self.assertEqual(output["analysis_status"], "unavailable")
        self.assertEqual(output["what_i_did_well_rich"], [])
        self.assertEqual(output["areas_for_improvement"], [])
        self.assertIsNone(output["overall_score"])

    def test_presentation_quality_never_sends_qa_to_thesis_prompt(self):
        class FakeClient:
            def __init__(self):
                self.messages = None
                self.chat = types.SimpleNamespace(completions=self)

            def create(self, **kwargs):
                self.messages = kwargs["messages"]
                return types.SimpleNamespace(choices=[types.SimpleNamespace(
                    message=types.SimpleNamespace(content=json.dumps(VALID_RESULT)),
                )])

        fake = FakeClient()
        answers = [
            {"type": "narration", "page": index + 1, "text": segment["text"]}
            for index, segment in enumerate(SEGMENTS)
        ] + [{
            "type": "qa_answer",
            "page": 4,
            "text": "This Q&A answer must never be evaluated as presentation quality.",
            "question": "What is your main limitation?",
        }]
        with mock.patch.object(app_module, "AI_ENABLED", True), mock.patch.object(app_module, "_ai_client", fake):
            result = app_module.run_pillar_evaluation(
                slides=[], answers=answers,
                config={"scenario": "Thesis Defense", "audience": "Professor"},
                challenge_seed={}, total_time_seconds=165,
            )
        payload = json.loads(fake.messages[1]["content"])
        payload_text = json.dumps(payload)
        self.assertNotIn("This Q&A answer", payload_text)
        self.assertEqual(
            payload["task"],
            "Evaluate only the Thesis Defense presentation phase using the supplied rubric.",
        )
        self.assertFalse(result["analysis_unavailable"])
