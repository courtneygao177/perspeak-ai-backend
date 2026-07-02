---
name: Non-templated fallback feedback
description: How to keep heuristic (non-LLM) fallback text generators from producing repeated/templated output across items
---

When a non-AI fallback path generates human-readable feedback for multiple items (e.g. per-question analysis), a single string template with only a quoted fragment swapped in still reads as "the same canned message" to users, even though the literal text differs — because the surrounding sentence structure and reasoning never change.

**Why:** users notice templated language pattern-matching, not just literal duplicate strings. A fix that only removes literal duplication (e.g. quoting the full answer instead of a truncated one) is not sufficient if the surrounding sentence scaffold is identical for every item.

**How to apply:**
- Detect real content signals in each item (regex-based keyword/structure detection is enough — doesn't need to be perfect, this is a last-resort fallback).
- Map those signals to the same named dimensions/framework already shown to the user elsewhere (e.g. report headers), so fallback text stays consistent with the "real" AI-driven scoring rubric.
- Pick a "hit" dimension to praise and a different "miss" dimension to critique per item, and always quote the specific sentence that triggered (or should have triggered) that signal — not the whole answer as a block.
- Critically: handle the "no signal matched at all" branch too. Do not let it fall back to one fixed generic sentence — derive something item-specific even there (e.g. keyword overlap between the question and the answer) so output never collapses back to a template when signals are absent.
- Verify by unit-testing the function directly with several varied inputs and asserting the outputs are pairwise distinct, not just eyeballing one example.
