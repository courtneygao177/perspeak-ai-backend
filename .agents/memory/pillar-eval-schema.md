---
name: 4-Pillar Evaluation Schema
description: Canonical schema for run_pillar_evaluation output and evaluation session key.
---

The evaluation session key uses this exact shape — never the old PQ/CQ dual-dimension shape:

```python
evaluation = {
    "pillar": {
        "scores": {"structure": int, "fluency": int, "relevance": int, "delivery": int},  # 0-100
        "dimensions_info": {
            "structure": {"explanation": str, "calculation": str},
            # ... same for fluency, relevance, delivery
        },
        "filler_log": [{"word": str, "timestamp": str, "type": "Assistive|Disruptive"}],
        "what_i_did_good": [str, ...],
        "areas_for_improvement": [{"issue": str, "example": str, "how_to_fix": str}],
    },
    "training_plan": str,   # markdown
    "scenario": str,
    "audience": str,
    "difficulty": str,
    "challenge_type": str,
    "ai_powered": bool,
}
```

**Why:** Replaced dual PQ/CQ (0-10) with 4 pillars (0-100) for clearer per-dimension cards and radar chart in report.html. Old schema would break report template.

**How to apply:** Always call `run_pillar_evaluation(slides, answers, config, challenge_seed)` → returns pillar dict directly. Training plan: `generate_training_plan(pillar_eval, config, challenge_type)`.
