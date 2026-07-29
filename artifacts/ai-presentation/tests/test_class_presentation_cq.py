"""Regression tests for the Class Presentation evidence-first Q&A evaluator."""
import os
import sys
import unittest

APP_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, APP_DIR)
import app as app_module  # noqa: E402


TRANSCRIPTS = [
    {"question_id": "10", "question": "Can you give a real-life example that supports your main point?", "text": "For example, students can compare their screen time each week and discuss how it affects their sleep."},
    {"question_id": "12", "question": "What would change if your main assumption turned out to be wrong?", "text": "That assumption matters, and if it changed, I would collect another group of responses before making the same conclusion."},
]


def response():
    analysis = []
    for index, transcript in enumerate(TRANSCRIPTS):
        dim = "explanation_support" if index == 0 else "composure_constructive_response"
        subcriterion = "relevant_support" if index == 0 else "challenge_response"
        analysis.append({
            "question_id": transcript["question_id"], "dimensions_assessed": [dim],
            "what_i_did_well": [{"dimension": dim, "subcriterion_id": subcriterion, "criterion_zh": "提供相关支撑", "title_zh": "给出了贴近生活的说明", "presenter_answer_quote": transcript["text"], "analysis_zh": "回答给出了与问题相关的具体说明。"}],
            "areas_for_improvement": [{"dimension": dim, "subcriterion_id": subcriterion, "criterion_zh": "解释便于听众理解", "title_zh": "补充影响的具体结果", "presenter_answer_quote": transcript["text"], "impact_zh": "补充结果会让听众更容易理解这个例子为何重要。", "actionable_next_step_zh": "在例子后说明它说明了什么。", "say_this_instead": "This example shows how screen time can affect students' sleep and daily concentration."}],
        })
    cards = {}
    for dimension, (_, _, _) in app_module.CLASS_CQ_DIMENSIONS.items():
        subs = []
        for sub_id, maximum, standard in app_module.CLASS_CQ_SUBCRITERIA[dimension]:
            subs.append({"subcriterion_id": sub_id, "standard_zh": standard, "score": max(1, maximum - 1), "max_score": maximum, "evidence_status": "sufficient", "actual_performance_zh": "回答中有可观察到的沟通表现。", "score_rationale_zh": "评分依据本次真实回答中的表现。", "evidence": [{"student_answer_quote": TRANSCRIPTS[0]["text"], "timestamp_start": 0, "timestamp_end": 0}]})
        cards[dimension] = {"actual_performance_zh": "本轮回答呈现了可追溯的表现。", "subcriteria": subs}
    return {"analysis_status": "complete", "communication_scores": {"question_alignment": 72, "answer_structure_clarity": 70, "explanation_support": 74, "audience_connection": 68, "composure_constructive_response": 71}, "dimension_evidence_status": {key: "sufficient" for key in app_module.CLASS_CQ_DIMENSIONS}, "dimension_cards": cards, "per_question_analysis": analysis, "session_strengths": [], "session_priorities": []}


class TestClassPresentationCQ(unittest.TestCase):
    def test_bank_routes_questions_to_non_legacy_strategies(self):
        old = app_module.AI_ENABLED
        try:
            app_module.AI_ENABLED = False
            bank = app_module.build_dual_track_qa([], "Professor", "class_presentation", "Hard")
        finally:
            app_module.AI_ENABLED = old
        self.assertEqual(len(bank), 3)
        self.assertTrue(all(q["question_type"] in app_module.CLASS_CQ_STRATEGY_BY_TYPE for q in bank))
        self.assertTrue(all(isinstance(q["answering_strategy"], dict) for q in bank))
        self.assertTrue(all("(引导" not in q["question"] for q in bank))

    def test_selected_listener_changes_class_qa_wording_and_focus(self):
        old = app_module.AI_ENABLED
        try:
            app_module.AI_ENABLED = False
            slides = [{"page": 1, "title": "Sleep and Screen Time", "content": ""}]
            professor_bank = app_module.build_dual_track_qa(slides, "Professor", "class_presentation", "Hard")
            classmates_bank = app_module.build_dual_track_qa(slides, "Classmates", "class_presentation", "Hard")
        finally:
            app_module.AI_ENABLED = old
        self.assertEqual(len(professor_bank), len(classmates_bank))
        self.assertTrue(all(q["questioner"] == "Professor" for q in professor_bank))
        self.assertTrue(all(q["questioner"] == "Classmates" for q in classmates_bank))
        self.assertNotEqual(professor_bank[0]["question"], classmates_bank[0]["question"])
        self.assertIn("evidence", professor_bank[0]["question"].lower())
        self.assertIn("everyday", classmates_bank[0]["question"].lower())

    def test_valid_output_is_normalized_without_ppt_content_scoring(self):
        output = app_module._normalize_class_cq_result(response(), app_module._class_cq_units(TRANSCRIPTS, []))
        self.assertIsNotNone(output)
        self.assertEqual(output["analysis_scope"], "class_presentation_qa_only")
        self.assertEqual(len(output["dimension_details"]), 5)
        self.assertEqual(output["communication_quality_report"]["per_question_analysis"][0]["question_type"], "illustrative_support")
        self.assertEqual(output["communication_scores"]["question_alignment"], 88)

    def test_snaps_a_paraphrased_feedback_quote_to_the_recorded_answer(self):
        invalid = response()
        invalid["per_question_analysis"][0]["what_i_did_well"][0]["presenter_answer_quote"] = "A paraphrase not spoken by the student"
        output = app_module._normalize_class_cq_result(invalid, app_module._class_cq_units(TRANSCRIPTS, []))
        self.assertEqual(
            output["communication_quality_report"]["per_question_analysis"][0]["what_i_did_well"][0]["presenter_answer_quote"],
            TRANSCRIPTS[0]["text"],
        )

    def test_drops_a_subcriterion_from_the_wrong_dimension(self):
        invalid = response()
        invalid["per_question_analysis"][0]["areas_for_improvement"][0]["subcriterion_id"] = "challenge_response"
        output = app_module._normalize_class_cq_result(invalid, app_module._class_cq_units(TRANSCRIPTS, []))
        self.assertEqual(
            output["communication_quality_report"]["per_question_analysis"][0]["areas_for_improvement"],
            [],
        )

    def test_compact_session_scorecard_keeps_full_five_dimension_scoring(self):
        """The model only needs full scoring once per session, not per question."""
        compact = response()
        compact.pop("dimension_cards")
        compact["dimension_scores"] = {
            dimension: {sub_id: max(1, maximum - 1)
                        for sub_id, maximum, _ in subcriteria}
            for dimension, subcriteria in app_module.CLASS_CQ_SUBCRITERIA.items()
        }
        compact["dimension_summaries"] = {
            dimension: "本轮真实问答提供了有限但可评分的沟通证据。"
            for dimension in app_module.CLASS_CQ_DIMENSIONS
        }
        output = app_module._normalize_class_cq_result(
            compact, app_module._class_cq_units(TRANSCRIPTS, [])
        )
        self.assertIsNotNone(output)
        self.assertEqual(len(output["dimension_details"]), 5)
        self.assertTrue(all(
            sub["evidence_status"] == "limited_evidence"
            for detail in output["dimension_details"].values()
            for sub in detail["subcriteria"]
        ))
