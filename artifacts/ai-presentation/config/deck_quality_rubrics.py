"""Purpose-aware slide-deck review rules for PerspeakAI.

This module is additive.  It does not replace the presentation-quality,
communication-quality, content-quality, or thesis-defense knowledge bases.

The taxonomy is adapted from ``addsumtech/slides_maker``'s review rubric
(MIT License):
https://github.com/addsumtech/slides_maker/blob/main/skills/slide-maker/references/review-rubrics.md

Only the compact product-facing rules live here.  The runtime deliberately
loads one universal rubric plus one purpose overlay instead of sending the
entire upstream reference to the model on every rehearsal.
"""

RUBRIC_VERSION = "slides-maker-adapted-v1"


UNIVERSAL_DIMENSIONS = {
    "one_idea_per_slide": {
        "label_en": "One idea per slide",
        "label_zh": "单页单一核心观点",
        "description": "Each content slide has one identifiable takeaway; structural slides are exempt.",
    },
    "results_legibility": {
        "label_en": "Results legibility",
        "label_zh": "结果与数据可读性",
        "description": "Evidence, charts, labels, and key differences can be read and verified at presentation distance.",
    },
    "cognitive_load": {
        "label_en": "Cognitive load and text",
        "label_zh": "认知负荷与文字密度",
        "description": "The audience is not forced to read dense prose while listening; slide text supports rather than duplicates speech.",
    },
    "figure_integrity": {
        "label_en": "Figure integrity",
        "label_zh": "图表标注与完整性",
        "description": "Figures are labelled, self-contained, cleanly cropped, and preserve axes, units, legends, and source meaning.",
    },
    "signaling": {
        "label_en": "Signaling",
        "label_zh": "视觉重点引导",
        "description": "Visual hierarchy, annotation, emphasis, and colour guide attention to what matters.",
    },
    "narrative_flow": {
        "label_en": "Narrative flow",
        "label_zh": "整体叙事流程",
        "description": "Slides form a coherent question-answer-evidence arc without gaps, filler, or abrupt non-sequiturs.",
    },
    "visual_quality": {
        "label_en": "Visual quality",
        "label_zh": "视觉质量与一致性",
        "description": "Contrast, typography, spacing, consistency, accessibility, and visual rhythm support comprehension.",
    },
    "framing": {
        "label_en": "Framing",
        "label_zh": "开场定位与意义",
        "description": "An unprepared audience quickly understands the topic, why it matters, and what to take away.",
    },
    "layout": {
        "label_en": "Layout, figures and colour",
        "label_zh": "版式、图形与色彩",
        "description": "Nothing overlaps, clips, crowds, or becomes visually ambiguous; layout and colour carry stable meaning.",
    },
    "factual_fidelity": {
        "label_en": "Factual fidelity",
        "label_zh": "事实与来源忠实度",
        "description": "Claims, numbers, quotations, and figures match supplied source material.  Without source material this is not assessed.",
    },
    "purpose_fit": {
        "label_en": "Design fits purpose",
        "label_zh": "设计与演示目的匹配",
        "description": "Tone, density, evidence, and visual treatment match the audience, medium, and decision or learning goal.",
    },
    "motion_pacing": {
        "label_en": "Motion and pacing",
        "label_zh": "动效与页面节奏",
        "description": "Builds and transitions guide attention rather than distract.  Static uploads usually mark motion as not assessed.",
    },
}


PURPOSE_OVERLAYS = {
    "academic_conference_talk": {
        "label_en": "Academic conference talk",
        "label_zh": "研究型课堂展示",
        "scene": "Class Presentation",
        "focus": [
            "one memorable message stated early and reinforced at the close",
            "motivation accessible beyond the presenter's narrow subfield",
            "large, annotated, legible results",
            "method at the right altitude and a realistic time budget",
            "limitations and a clear final takeaway",
        ],
        "red_flags": [
            "no single message", "dense derivations", "undefined jargon",
            "too many slides for the time", "ending without a contribution recap",
        ],
    },
    "teaching_instructional": {
        "label_en": "Teaching / instructional",
        "label_zh": "知识讲解型课堂展示",
        "scene": "Class Presentation",
        "focus": [
            "stated learning objective", "one new idea at a time",
            "worked examples and analogies", "recap or comprehension checkpoints",
            "consistent notation and declared prerequisites",
        ],
        "red_flags": ["too much at once", "no examples", "unstated prerequisites", "no recap"],
    },
    "thesis_committee_defense": {
        "label_en": "Thesis / committee defense",
        "label_zh": "论文答辩",
        "scene": "Thesis Defense",
        "focus": [
            "explicit contribution and novelty", "validation or ablation",
            "limitations and threats to validity", "reproducibility",
            "positioning against prior work", "depth that survives committee questions",
        ],
        "red_flags": ["claims without validation", "no limitations", "unclear novelty"],
    },
    "investor_product_pitch": {
        "label_en": "Investor product pitch",
        "label_zh": "投资人产品路演",
        "scene": "MBA Case Pitch",
        "focus": [
            "clear problem and value proposition", "real product and proof",
            "market size and credible business model", "traction and competition",
            "team advantage", "specific investment ask and use of funds",
        ],
        "red_flags": [
            "feature dump", "claims without proof", "no differentiation",
            "missing business model", "fabricated metrics", "no clear ask",
        ],
    },
}


SEVERITY_DEFINITIONS = {
    "blocker": "Undermines the deck's purpose and must be fixed before sharing.",
    "major": "Clearly hurts comprehension, credibility, or impact.",
    "minor": "Polish issue that does not prevent the deck from working.",
}


_TEACHING_HINTS = (
    "learning objective", "learning objectives", "lesson", "tutorial", "how to",
    "worked example", "exercise", "quiz", "checkpoint", "教学目标", "学习目标",
    "课程", "练习", "例题", "知识点",
)


def select_purpose_overlay(scenario, slides=None):
    """Choose exactly one overlay while preserving the product's current UI.

    Thesis and investor-pitch modes are explicit.  Class Presentation is the
    only ambiguous mode; a conservative text heuristic selects teaching only
    when the deck visibly declares a learning/instructional purpose, otherwise
    it defaults to the research-presentation bar.
    """
    if scenario == "Thesis Defense":
        return "thesis_committee_defense", "The selected scenario is Thesis Defense."
    if scenario == "MBA Case Pitch":
        return "investor_product_pitch", "The selected scenario is MBA Case Pitch with an investor-facing audience."

    deck_text = " ".join(
        f"{slide.get('title', '')} {slide.get('content', '')}"
        for slide in (slides or [])[:8]
    ).lower()
    if any(hint in deck_text for hint in _TEACHING_HINTS):
        return "teaching_instructional", "The deck contains explicit learning, lesson, example, or exercise signals."
    return "academic_conference_talk", "Class Presentation defaults to a research-style talk unless instructional signals are present."


def rubric_prompt_block(overlay_key):
    """Return the compact rubric section injected into the evaluator prompt."""
    overlay = PURPOSE_OVERLAYS[overlay_key]
    dimensions = "\n".join(
        f"- {key}: {value['description']}"
        for key, value in UNIVERSAL_DIMENSIONS.items()
    )
    focus = "\n".join(f"- {item}" for item in overlay["focus"])
    red_flags = "\n".join(f"- {item}" for item in overlay["red_flags"])
    return (
        f"UNIVERSAL DIMENSIONS:\n{dimensions}\n\n"
        f"PURPOSE OVERLAY: {overlay['label_en']}\n"
        f"WEIGHT HEAVILY:\n{focus}\n"
        f"RED FLAGS:\n{red_flags}"
    )
