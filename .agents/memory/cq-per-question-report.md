---
name: CQ per-question report schema
description: Canonical shape for Communication Quality per-question feedback in the ai-presentation app; language requirement for CQ text.
---

## Schema

`evaluation.communication_quality.communication_quality_report` = `{ overall_cq_score, per_question_analysis: [...] }`.

Each item in `per_question_analysis`:
```
{ question_id, question_text, user_actual_answer, what_i_did_good, areas_for_improvement, how_to_fix }
```

Populated via a 3-way cross-check (question asked, question bank/anchor metadata, user's actual transcript answer) in the main CQ eval path, the dual-track CQ eval path, and a `_fallback_per_question_analysis()` heuristic used when the LLM JSON fails/needs repair or CQ has no AI data.

## Language rule

All CQ-generated text — dimension-level `what_i_did_good`/`areas_for_improvement`/`how_to_fix` AND the new per-question fields — must be pure English at IELTS 5.5–6.0 level.

**Why:** an earlier RULE 0 mandated Chinese; the product direction reversed this specifically for CQ (not PQ — Presentation Quality prompts/templates intentionally still use Chinese, e.g. "你的原话"/"改进建议" in the PQ tab of report.html). Do not let CQ-English changes bleed into PQ, and vice versa — they are separate evaluation tracks with independent language requirements.

**How to apply:** when touching CQ prompts (main + dual-track), mock/fallback builders (`_cq_mock_result`, `_build_dual_track_mock_result`, `_cq_no_data_result`), or `report.html`'s CQ tab, keep all text English. Leave the PQ tab's Chinese labels alone.
