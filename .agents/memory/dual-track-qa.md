---
name: Dual-Track Q&A Architecture
description: Module 2/3 dual-track Q&A system — how free and anchor questions are generated, tagged, and split-evaluated in the CQ engine.
---

## Rule
Q1 is always an AI-generated free question (no scaffold). Q2 is always an anchor question from `ANCHOR_QUESTION_POOL` (with 大白话 scaffold hint embedded). Exactly ONE anchor per session ("有且仅有一个标准锚点题").

**Why:** Free questions test spontaneous communication; anchor questions test whether the user can follow structured technique guidance when given a hint. Separate evaluation paths avoid cross-contaminating the rubrics.

## How to apply

### Question generation (`build_dual_track_qa`)
- Easy (1q): Q1 only (free)
- Medium (2q): Q1 free + Q2 anchor
- Hard (3q): Q1 free + Q2 anchor + Q3 free fallback from CLASS_PRES_QA_POOL
- Called from `api_start_presentation` for Class Presentation / Academic Presentation scenarios only
- Stores result in `session["qa_bank"]`

### Question tagging (`api_submit_academic_qa`)
Each recorded answer includes: `question_type` ("free"|"anchor"), `anchor_type`, `target_dim`, `scaffold_signal`

### CQ evaluation routing (`run_communication_quality_evaluation`)
1. `session_transcripts` now carries question_type metadata from stored answers
2. After building `comm_transcripts`, annotate each entry by matching answer text to session metadata
3. If anchor transcripts AND free transcripts both present → `_run_dual_track_cq_evaluation()`
4. Otherwise → fall through to existing single-track path (backward compat)

### Dual-track CQ result structure
- `cq_scores`: 4 dims — Directness & Logic / Conversational Resonance / Evidence & Substantiation / Anchor — {type}
- `cq_total`: universal×75% + anchor×25%
- `what_i_did_good`: 2 universal cards + 1 anchor card (【ANCHOR PASS】prefix if passed)
- `areas_for_improvement`: universal improvement cards + anchor card with dynamic "Say this instead:" rewrite if failed

### Key functions added
- `generate_free_qa_question(slides, audience, scene_slug)` — GPT-4o, 120 tokens, no scaffold
- `build_dual_track_qa(slides, audience, scene_slug, difficulty)` — combines free + anchor
- `_cq_heuristic_universal(qa_texts)` — heuristic scorer for universal 3 dims
- `_check_anchor_compliance(anchor_text, target_dim)` — heuristic scaffold pass/fail check
- `_run_dual_track_cq_evaluation(...)` — main dual-track Gemini eval (EVAL_MODEL)
- `_build_dual_track_mock_result(...)` — AI-off fallback
- `_UNIVERSAL_FIX_PHRASES` — module-level dict for fallback fix text per universal dim
