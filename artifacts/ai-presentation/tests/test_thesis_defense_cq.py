"""Regression tests for the evidence-first Thesis Defense Q&A evaluator."""
import json
import os
import sys
import types
import unittest
from unittest import mock


APP_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, APP_DIR)

import app as app_module  # noqa: E402


UNITS = [
    {
        "question_id": "anchor_td_method_01", "question_type": "method_choice",
        "question": "Why was your chosen method appropriate for the research question?",
        "answering_strategy": {"strategy_id": "define_defend"},
        "text": "I chose interviews because they allowed participants to explain their experiences in detail.",
        "answer_timestamp_start": 1, "answer_timestamp_end": 12,
    },
    {
        "question_id": "anchor_td_limit_01", "question_type": "limitation_challenge",
        "question": "What is the main limitation of this study?",
        "answering_strategy": {"strategy_id": "acknowledge_boundary"},
        "text": "The sample is limited, so the conclusion applies only to this group, but it identifies a useful pattern.",
        "answer_timestamp_start": 14, "answer_timestamp_end": 28,
    },
]


def valid_response():
    analyses = []
    dimensions = ["answer_structure_completeness", "professional_assertiveness"]
    for index, item in enumerate(UNITS):
        dim = dimensions[index]
        analyses.append({
            "question_id": item["question_id"], "question_type": item["question_type"],
            "examiner_question_quote": item["question"], "question_timestamp_start": 0,
            "question_timestamp_end": 0, "presenter_answer_quote": item["text"],
            "answer_timestamp_start": item["answer_timestamp_start"], "answer_timestamp_end": item["answer_timestamp_end"],
            "dimensions_assessed": [dim],
            "what_i_did_well": [{"dimension": dim, "criterion_zh": "回应结构", "title_zh": "回答有清楚重点", "presenter_answer_quote": item["text"], "timestamp_start": item["answer_timestamp_start"], "timestamp_end": item["answer_timestamp_end"], "analysis_zh": "你用一句理由说明了研究选择。"}],
            "areas_for_improvement": [{"dimension": dim, "criterion_zh": "论证更完整", "priority": "medium", "title_zh": "补充一项依据", "presenter_answer_quote": item["text"], "timestamp_start": item["answer_timestamp_start"], "timestamp_end": item["answer_timestamp_end"], "impact_zh": "补充依据能让评委更容易理解你的推理。", "actionable_next_step_zh": "练习在理由后补充一个具体研究细节。", "say_this_instead": "I chose interviews because they let participants explain their experiences in detail, which directly addressed the research question while keeping the analysis focused on the study's defined participant group."}],
            "answering_strategy": {"strategy_id": item["answering_strategy"]["strategy_id"]},
        })
    return {
        "analysis_status": "complete", "analysis_scope": "thesis_defense_qa_only", "coverage_warning": None,
        "communication_scores": {"question_alignment": 72, "answer_structure_completeness": 70, "reasoning_specificity": 68, "interaction_regulation": 55, "professional_assertiveness": 74},
        "overall_cq_score": 68,
        "dimension_evidence_status": {"question_alignment": "sufficient", "answer_structure_completeness": "sufficient", "reasoning_specificity": "sufficient", "interaction_regulation": "limited_evidence", "professional_assertiveness": "sufficient"},
        "per_question_analysis": analyses,
        "session_strengths": [{"dimension": "question_alignment", "question_id": UNITS[0]["question_id"], "title_zh": "回应问题", "presenter_answer_quote": UNITS[0]["text"], "timestamp_start": 1, "timestamp_end": 12, "analysis_zh": "回答与问题保持一致。"}],
        "session_priorities": [
            {"dimension": "interaction_regulation", "priority": 1, "action_zh": "练习拆分复合问题。", "why_zh": "本次证据有限。"},
            {"dimension": "reasoning_specificity", "priority": 2, "action_zh": "补充一项研究依据。", "why_zh": "可让推理更清楚。"},
        ],
    }


class TestThesisDefenseCQ(unittest.TestCase):
    def test_gpt5_uses_new_completion_token_parameter(self):
        class CapturingClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)
                self.kwargs = None

            def create(self, **kwargs):
                self.kwargs = kwargs
                return object()

        client = CapturingClient()
        with mock.patch.object(app_module, "_ai_client", client):
            app_module._create_chat_completion(
                "gpt-5.6", 6000, messages=[{"role": "user", "content": "test"}],
            )
        self.assertEqual(client.kwargs["max_completion_tokens"], 6000)
        self.assertNotIn("max_tokens", client.kwargs)

    def test_legacy_model_keeps_max_tokens_parameter(self):
        class CapturingClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)
                self.kwargs = None

            def create(self, **kwargs):
                self.kwargs = kwargs
                return object()

        client = CapturingClient()
        with mock.patch.object(app_module, "_ai_client", client):
            app_module._create_chat_completion(
                "gemini-2.5-flash", 6000, messages=[{"role": "user", "content": "test"}],
                extra_body={"thinking": {"budget_tokens": 0}},
            )
        self.assertEqual(client.kwargs["max_tokens"], 6000)
        self.assertNotIn("max_completion_tokens", client.kwargs)
        self.assertIn("extra_body", client.kwargs)

    def test_completion_helper_can_disable_retry_for_vision_requests(self):
        class CapturingClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)
                self.options = None
                self.kwargs = None

            def with_options(self, **options):
                self.options = options
                return self

            def create(self, **kwargs):
                self.kwargs = kwargs
                return object()

        client = CapturingClient()
        with mock.patch.object(app_module, "_ai_client", client):
            app_module._create_chat_completion(
                "claude-sonnet-5", 100, request_timeout=30.0, max_retries=0,
                messages=[{"role": "user", "content": "test"}],
            )
        self.assertEqual(client.options, {"timeout": 30.0, "max_retries": 0})
        self.assertEqual(client.kwargs["max_tokens"], 100)

    def test_bank_uses_new_question_types_and_session_counts(self):
        with mock.patch.object(app_module, "AI_ENABLED", False):
            for difficulty, expected in (("Easy", 3), ("Medium", 5), ("Hard", 8)):
                bank = app_module.build_thesis_defense_qa_bank([], difficulty)
                self.assertEqual(len(bank), expected)
                self.assertTrue(all(q["question_type"] in app_module.DEFENSE_STRATEGY_BY_TYPE for q in bank))
                self.assertTrue(all(isinstance(q["answering_strategy"], dict) for q in bank))
            self.assertTrue(any(q["question_type"] in {"limitation_challenge", "result_interpretation", "multipart_followup"} for q in app_module.build_thesis_defense_qa_bank([], "Hard")))

    def test_valid_response_is_normalized_to_five_dimensions(self):
        units = app_module._thesis_cq_units(UNITS)
        output = app_module._normalize_thesis_cq_result(valid_response(), units)
        self.assertIsNotNone(output)
        self.assertEqual(output["analysis_scope"], "thesis_defense_qa_only")
        self.assertEqual(len(output["dim_names"]), 5)
        self.assertEqual(output["communication_quality_report"]["per_question_analysis"][0]["answering_strategy"]["strategy_id"], "define_defend")
        self.assertEqual(output["cq_total"], 68)

    def test_normalized_result_includes_evidence_grounded_dimension_cards(self):
        output = app_module._normalize_thesis_cq_result(
            valid_response(), app_module._thesis_cq_units(UNITS)
        )

        details = output["dimension_details"]
        self.assertEqual(set(details), set(app_module._THESIS_CQ_DIMENSIONS))
        structure = details["answer_structure_completeness"]
        self.assertEqual(structure["weight_percent"], 20)
        self.assertEqual(structure["score"], 70)
        self.assertIn("理由", structure["performance_zh"])
        self.assertIn("90–100", structure["band_guide_zh"])

    def test_non_verbatim_feedback_quote_is_rejected(self):
        result = valid_response()
        result["per_question_analysis"][0]["what_i_did_well"][0]["presenter_answer_quote"] = "invented answer"
        self.assertIsNone(app_module._normalize_thesis_cq_result(result, app_module._thesis_cq_units(UNITS)))

    def test_ai_failure_is_unavailable_not_a_mock_score(self):
        with mock.patch.object(app_module, "AI_ENABLED", False):
            output = app_module.run_communication_quality_evaluation(UNITS, {"scenario": "Thesis Defense"}, slides=[])
        self.assertEqual(output["analysis_status"], "unavailable")
        self.assertIsNone(output["cq_total"])
        self.assertEqual(output["communication_quality_report"]["per_question_analysis"], [])

    def test_evaluator_uses_real_question_answer_units(self):
        class FakeClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)
            def create(self, **kwargs):
                return types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(valid_response())))])
        with mock.patch.object(app_module, "AI_ENABLED", True), mock.patch.object(app_module, "_ai_client", FakeClient()):
            output = app_module.run_communication_quality_evaluation(UNITS, {"scenario": "Thesis Defense"}, slides=[])
        self.assertTrue(output["has_data"])
        self.assertEqual(output["exchange_count"], 2)

    def test_evaluator_accepts_json_wrapped_in_a_markdown_fence(self):
        class FencedJsonClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)

            def create(self, **kwargs):
                content = "```json\n" + json.dumps(valid_response()) + "\n```"
                return types.SimpleNamespace(choices=[types.SimpleNamespace(
                    finish_reason="stop",
                    message=types.SimpleNamespace(content=content),
                )])

        with mock.patch.object(app_module, "AI_ENABLED", True), mock.patch.object(app_module, "_ai_client", FencedJsonClient()):
            output = app_module.run_communication_quality_evaluation(UNITS, {"scenario": "Thesis Defense"}, slides=[])
        self.assertTrue(output["has_data"])

    def test_evaluator_accepts_json_with_a_provider_preamble(self):
        class PreambleJsonClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)

            def create(self, **kwargs):
                content = "Here is the requested evaluation:\n" + json.dumps(valid_response()) + "\nEnd of evaluation."
                return types.SimpleNamespace(choices=[types.SimpleNamespace(
                    finish_reason="stop",
                    message=types.SimpleNamespace(content=content),
                )])

        with mock.patch.object(app_module, "AI_ENABLED", True), mock.patch.object(app_module, "_ai_client", PreambleJsonClient()):
            output = app_module.run_communication_quality_evaluation(UNITS, {"scenario": "Thesis Defense"}, slides=[])
        self.assertTrue(output["has_data"])

    def test_normalizer_reconciles_total_and_completes_one_missing_priority(self):
        result = valid_response()
        result["overall_cq_score"] = 99
        result["session_priorities"] = result["session_priorities"][:1]

        output = app_module._normalize_thesis_cq_result(
            result, app_module._thesis_cq_units(UNITS)
        )

        self.assertIsNotNone(output)
        self.assertEqual(output["cq_total"], 68)
        self.assertEqual(len(output["session_priorities"]), 2)
        self.assertEqual(output["session_priorities"][1]["priority"], 2)

    def test_normalizer_snaps_drifted_time_and_infers_second_feedback_dimension(self):
        result = valid_response()
        item = result["per_question_analysis"][0]
        item["areas_for_improvement"][0]["dimension"] = "reasoning_specificity"
        item["areas_for_improvement"][0]["timestamp_start"] = 99
        item["areas_for_improvement"][0]["timestamp_end"] = 100

        output = app_module._normalize_thesis_cq_result(
            result, app_module._thesis_cq_units(UNITS)
        )

        self.assertIsNotNone(output)
        normalized = output["communication_quality_report"]["per_question_analysis"][0]
        self.assertEqual(
            normalized["dimensions_assessed"],
            ["answer_structure_completeness", "reasoning_specificity"],
        )
        feedback = normalized["areas_for_improvement"][0]
        self.assertEqual((feedback["timestamp_start"], feedback["timestamp_end"]), (1.0, 12.0))

    def test_empty_primary_model_response_uses_secondary_model(self):
        class FallbackClient:
            def __init__(self):
                self.chat = types.SimpleNamespace(completions=self)
                self.calls = 0

            def create(self, **kwargs):
                self.calls += 1
                content = "" if self.calls == 1 else json.dumps(valid_response())
                return types.SimpleNamespace(choices=[types.SimpleNamespace(
                    finish_reason="stop",
                    message=types.SimpleNamespace(content=content),
                )])

        client = FallbackClient()
        with mock.patch.object(app_module, "AI_ENABLED", True), \
             mock.patch.object(app_module, "_ai_client", client), \
             mock.patch.object(app_module, "EVAL_MODEL", "primary"), \
             mock.patch.object(app_module, "TEXT_MODEL", "secondary"):
            output = app_module.run_communication_quality_evaluation(
                UNITS, {"scenario": "Thesis Defense"}, slides=[]
            )
        self.assertTrue(output["has_data"])
        self.assertEqual(client.calls, 2)
