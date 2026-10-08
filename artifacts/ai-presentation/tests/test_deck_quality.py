"""Regression tests for the additive Deck Quality rubric integration."""
import os
import sys
import unittest
import uuid
from unittest import mock


APP_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, APP_DIR)

import app as app_module  # noqa: E402
from config.deck_quality_rubrics import select_purpose_overlay  # noqa: E402


SLIDES = [
    {
        "page": 1,
        "title": "Research objective",
        "content": "Why this problem matters and what the study investigates.",
        "key_claims": [],
    },
    {
        "page": 2,
        "title": "Results",
        "content": "The treatment group improved relative to the baseline.",
        "key_claims": ["Treatment improved relative to baseline"],
    },
]


def severe_deck_quality():
    return {
        "findings": [{
            "id": "finding-results",
            "slide_id": 2,
            "dimension": "results_legibility",
            "severity": "major",
            "title_zh": "结果说明不足",
            "evidence": "Slide 2 states an improvement but does not expose the comparison clearly.",
            "why_it_matters_zh": "听众无法快速验证核心结果。",
            "recommended_fix_zh": "补充基线、变化量与结论标注。",
            "question_seed_en": "What evidence on slide 2 supports the claimed improvement?",
        }]
    }


class TestPurposeOverlay(unittest.TestCase):
    def test_explicit_scenarios_map_to_one_overlay(self):
        self.assertEqual(select_purpose_overlay("Thesis Defense", SLIDES)[0], "thesis_committee_defense")
        self.assertEqual(select_purpose_overlay("MBA Case Pitch", SLIDES)[0], "investor_product_pitch")

    def test_class_teaching_signal_selects_instructional_overlay(self):
        slides = [{"title": "Learning objectives", "content": "Worked example and exercise"}]
        self.assertEqual(select_purpose_overlay("Class Presentation", slides)[0], "teaching_instructional")


class TestDeckQualityTruthfulness(unittest.TestCase):
    def test_text_only_fallback_marks_visual_source_and_motion_dimensions_unassessed(self):
        result = app_module._fallback_deck_quality(
            SLIDES, "Class Presentation", "academic_conference_talk", "test"
        )
        for key in (
            "results_legibility", "figure_integrity", "signaling",
            "visual_quality", "layout", "factual_fidelity", "motion_pacing",
        ):
            self.assertEqual(result["dimension_scores"][key]["status"], "not_assessed")
            self.assertIsNone(result["dimension_scores"][key]["score"])

    def test_normalizer_rejects_unknown_findings_and_clamps_scores(self):
        raw = {
            "dimension_scores": {
                "framing": {"score": 140, "status": "assessed", "summary_zh": "明确", "evidence_refs": [1], "evidence": [{"slide_id": 1, "evidence_type": "slide_text", "quote": "Research objective", "analysis_zh": "首页明确提出研究目标。"}]},
                "factual_fidelity": {"score": 99, "status": "assessed", "summary_zh": "bad"},
            },
            "findings": [
                {"slide_id": 1, "dimension": "made_up", "severity": "critical", "evidence": "x"},
                {"slide_id": 99, "dimension": "framing", "severity": "major", "evidence": "x"},
                {
                    "slide_id": 1, "dimension": "framing", "severity": "major",
                    "evidence": "The opening names an objective.",
                    "evidence_quote": "Research objective", "evidence_type": "slide_text",
                    "question_seed_en": "Why does this matter",
                },
            ],
        }
        result = app_module._normalize_deck_quality(
            raw, SLIDES, "Class Presentation", "academic_conference_talk", "test"
        )
        self.assertEqual(result["dimension_scores"]["framing"]["score"], 100)
        self.assertEqual(result["dimension_scores"]["factual_fidelity"]["status"], "not_assessed")
        self.assertEqual(len(result["findings"]), 1)
        self.assertTrue(result["findings"][0]["question_seed_en"].endswith("?"))

    def test_ungrounded_finding_is_not_displayed(self):
        raw = {
            "dimension_scores": {
                "framing": {"score": 40, "status": "assessed", "summary_zh": "不足", "evidence_refs": [1], "evidence": [{"slide_id": 1, "evidence_type": "slide_text", "quote": "Research objective", "analysis_zh": "首页出现研究目标。"}]},
            },
            "findings": [{
                "slide_id": 1, "dimension": "framing", "severity": "major",
                "evidence": "The opening is unclear.",
                "evidence_quote": "This sentence does not exist on the slide",
                "evidence_type": "slide_text",
            }],
        }
        result = app_module._normalize_deck_quality(
            raw, SLIDES, "Class Presentation", "academic_conference_talk", "test"
        )
        self.assertEqual(result["findings"], [])

    def test_five_point_scores_are_converted_and_punctuation_does_not_break_quote(self):
        raw = {
            "dimension_scores": {
                "framing": {"score": 3, "status": "assessed", "summary_zh": "尚可", "evidence_refs": [1], "evidence": [{"slide_id": 1, "evidence_type": "slide_text", "quote": "Research objective", "analysis_zh": "首页明确研究目标。"}]},
                "narrative_flow": {"score": 4, "status": "assessed", "summary_zh": "清晰", "evidence_refs": [1, 2], "evidence": [{"slide_id": 2, "evidence_type": "slide_text", "quote": "The treatment group improved relative to the baseline.", "analysis_zh": "结果页承接研究目标。"}]},
            },
            "findings": [{
                "slide_id": 1, "dimension": "framing", "severity": "minor",
                "evidence": "The slide names a research objective.",
                "evidence_quote": "Research—objective", "evidence_type": "slide_text",
            }],
        }
        result = app_module._normalize_deck_quality(
            raw, SLIDES, "Class Presentation", "academic_conference_talk", "test"
        )
        self.assertEqual(result["dimension_scores"]["framing"]["score"], 60)
        self.assertEqual(result["dimension_scores"]["narrative_flow"]["score"], 80)
        self.assertEqual(len(result["findings"]), 1)


class TestDeckQualityQuestionLinkage(unittest.TestCase):
    def test_class_question_count_is_preserved(self):
        bank = app_module.build_dual_track_qa(
            SLIDES, "Professor", "class_presentation", "Medium",
            deck_quality=severe_deck_quality(),
        )
        self.assertEqual(len(bank), 2)
        self.assertEqual(bank[0]["deck_finding_id"], "finding-results")

    def test_thesis_question_count_is_preserved(self):
        with mock.patch.object(app_module, "AI_ENABLED", False):
            for difficulty, expected in (("Easy", 3), ("Medium", 5), ("Hard", 8)):
                bank = app_module.build_thesis_defense_qa_bank(
                    SLIDES, difficulty, deck_quality=severe_deck_quality()
                )
                self.assertEqual(len(bank), expected)
                self.assertTrue(any(q.get("deck_finding_id") == "finding-results" for q in bank))


class TestDeckQualityReportContract(unittest.TestCase):
    def test_report_keeps_old_tabs_and_adds_fourth_tab(self):
        template_path = os.path.join(APP_DIR, "templates", "report.html")
        with open(template_path, encoding="utf-8") as handle:
            template = handle.read()
        for tab in ("pq", "cq", "cqual", "deck"):
            self.assertIn(f'id="tab-btn-{tab}"', template)
            self.assertIn(f'id="tab-pane-{tab}"', template)
        self.assertIn("evaluation.deck_quality if evaluation.deck_quality is defined else None", template)


class TestDeckQualitySessionIntegration(unittest.TestCase):
    def test_start_session_persists_additive_audit_and_keeps_qa_count(self):
        app_module.app.config.update(TESTING=True)
        client = app_module.app.test_client()
        client.post(
            "/register",
            data={"email": f"deck-{uuid.uuid4()}@example.com", "password": "password123"},
        )
        with client.session_transaction() as flask_session:
            flask_session["slide_key"] = app_module._save_slides(SLIDES)
            flask_session["filename"] = "deck.pptx"
        with mock.patch.object(app_module, "AI_ENABLED", False):
            response = client.post("/x/start-session", json={
                "audience": "Professor",
                "scenario": "Class Presentation",
                "difficulty": "Medium",
            })
        self.assertEqual(response.status_code, 200)
        with client.session_transaction() as flask_session:
            self.assertTrue(flask_session.get("deck_quality_key"))
            self.assertEqual(len(flask_session.get("qa_bank", [])), 2)
            audit = app_module._load_deck_quality(flask_session)
        self.assertEqual(audit["rubric_version"], app_module.DECK_RUBRIC_VERSION)
        self.assertEqual(audit["analysis_scope"], "deck_only")


if __name__ == "__main__":
    unittest.main()
