"""Thesis Defense Q&A question bank and visible answering strategies.

The bank deliberately separates *how* a candidate communicates from whether a
thesis claim is academically correct.  Question text is English; the strategy
card is bilingual by design and never exposes a scoring rule or ideal answer.
"""

DEFENSE_STRATEGIES = {
    "define_illustrate": {
        "strategy_id": "define_illustrate",
        "title_zh": "先界定概念，再用论文内例子说明",
        "purpose_zh": "适用于概念解释题，帮助评委理解该术语在你的研究中具体指什么。",
        "steps_zh": ["先给出本研究中的简洁定义。", "补充一个论文内的例子、发现或使用场景。", "说明它为何与研究问题有关。"],
        "phrase_starters_en": ["In this study, ... means ...", "For example, ...", "This matters because ..."],
        "answer_example_en": "In this study, [term] means [precise meaning]. For example, it appears in [research context], which matters because [link to question].",
    },
    "define_defend": {
        "strategy_id": "define_defend",
        "title_zh": "先说明研究选择，再解释理由与权衡",
        "purpose_zh": "适用于方法选择题，避免一开始进入辩解。",
        "steps_zh": ["中性说明你采用了什么方法。", "解释它如何回应研究问题。", "补充一个权衡、证据或边界。"],
        "phrase_starters_en": ["What I did was ...", "I chose this because ...", "A different approach could have ..., but ..."],
        "answer_example_en": "I chose [method] because it best addressed [research question]. A different approach could have [benefit], but it would not have [reason].",
    },
    "acknowledge_boundary": {
        "strategy_id": "acknowledge_boundary",
        "title_zh": "承认边界，再精确说明你的主张",
        "purpose_zh": "适用于局限或质疑题，帮助你既不回避问题，也不放弃研究立场。",
        "steps_zh": ["先承认一个合理的限制。", "说明当前证据支持的结论范围。", "解释研究仍然具有的具体价值。"],
        "phrase_starters_en": ["That is a valid limitation.", "Within the scope of this study, ...", "The evidence supports ..., rather than ..."],
        "answer_example_en": "That is a valid limitation. Within this study's scope, the evidence supports [precise claim], while the study still contributes [specific value].",
    },
    "general_specific": {
        "strategy_id": "general_specific",
        "title_zh": "先说总体差异，再落到关键细节",
        "purpose_zh": "适用于文献比较题，避免只列出作者或理论名称。",
        "steps_zh": ["先概括你的立场与文献的总体关系。", "选择一个作者、概念或研究细节作比较。", "说明这一差异对论文意味着什么。"],
        "phrase_starters_en": ["Broadly, my position differs because ...", "More specifically, ...", "This matters for my thesis because ..."],
        "answer_example_en": "Broadly, my position builds on [work] but focuses on [difference]. More specifically, [detail], which matters because [implication].",
    },
    "answer_reason_evidence": {
        "strategy_id": "answer_reason_evidence",
        "title_zh": "先点明贡献，再给理由和依据",
        "purpose_zh": "适用于原创性或贡献题，帮助你避免泛泛地说“很新”。",
        "steps_zh": ["先用一句话命名最重要的贡献。", "说明为什么它有意义。", "给出一项论文中的依据，并避免夸大。"],
        "phrase_starters_en": ["The main contribution is ...", "It is significant because ...", "This is supported by ..."],
        "answer_example_en": "The main contribution is [contribution]. It is significant because [reason], and this is supported by [evidence from the study].",
    },
    "claim_reason_evidence_alternative": {
        "strategy_id": "claim_reason_evidence_alternative",
        "title_zh": "给出解释，再说明依据与替代可能",
        "purpose_zh": "适用于结果解释题，让回答既清楚又不过度绝对。",
        "steps_zh": ["先给出你对结果的解释。", "说明支持该解释的理由或证据。", "承认一个合理的替代解释或范围。"],
        "phrase_starters_en": ["My interpretation is ...", "This is supported by ...", "An alternative explanation could be ..."],
        "answer_example_en": "My interpretation is that [result] reflects [reason]. This is supported by [evidence], although an alternative explanation could be [alternative].",
    },
    "number_the_parts": {
        "strategy_id": "number_the_parts",
        "title_zh": "先拆分复合问题，再逐一回应",
        "purpose_zh": "适用于追问或多部分问题，减少漏答并帮助评委跟上你的思路。",
        "steps_zh": ["先确认问题包含几个部分。", "用 first / second 依序回应。", "最后说明两部分如何连接。"],
        "phrase_starters_en": ["There are two parts to that question.", "First, ...", "Second, ..."],
        "answer_example_en": "There are two parts to that question. First, [answer to part one]. Second, [answer to part two]. Together, this means [connection].",
    },
}


def _question(id_, question_type, question):
    strategy_id = {
        "definition_concept": "define_illustrate", "method_choice": "define_defend",
        "limitation_challenge": "acknowledge_boundary", "literature_comparison": "general_specific",
        "contribution_originality": "answer_reason_evidence", "result_interpretation": "claim_reason_evidence_alternative",
        "multipart_followup": "number_the_parts",
    }[question_type]
    return {
        "id": id_, "question": question, "question_type": question_type,
        "internal_strategy_id": strategy_id, "challenge_type": question_type,
        "category": "Thesis Defense", "answering_strategy": DEFENSE_STRATEGIES[strategy_id],
        "context_refs": [], "is_anchor": True,
    }


# Reviewed neutral templates derived from common thesis-defense questions. The
# runtime may make one more specific only when that detail is visible in the
# supplied slides.  Each item retains a stable communication question type so
# the evaluator can select the corresponding answering strategy reliably.
DEFENSE_QUESTION_BANK = [
    _question("anchor_td_concept_01", "definition_concept", "You use a key term centrally in your thesis. What does it mean in this study, and why is that definition important to your analysis?"),
    _question("anchor_td_concept_02", "definition_concept", "Could you define one core concept in your thesis and illustrate how you apply it in the study?"),
    _question("anchor_td_method_01", "method_choice", "Why was your chosen method or design appropriate for answering your research question, rather than a plausible alternative?"),
    _question("anchor_td_method_02", "method_choice", "What was the main trade-off in your research design, and why was that trade-off acceptable?"),
    _question("anchor_td_limit_01", "limitation_challenge", "What is the main limitation of this study, and how does it affect the scope of your conclusion?"),
    _question("anchor_td_limit_02", "limitation_challenge", "If the committee challenged the size or range of your evidence, how would you explain both the boundary and the value of the study?"),
    _question("anchor_td_literature_01", "literature_comparison", "How does your position differ from, or build on, a key work in the literature you reviewed?"),
    _question("anchor_td_literature_02", "literature_comparison", "Which theoretical or empirical perspective most clearly contrasts with your approach, and why?"),
    _question("anchor_td_contribution_01", "contribution_originality", "What is the most original contribution of this thesis, and what evidence supports that claim?"),
    _question("anchor_td_contribution_02", "contribution_originality", "What should a researcher or practitioner take away from this thesis that was not already clear before?"),
    _question("anchor_td_result_01", "result_interpretation", "How should the committee interpret your most important finding, and what alternative explanation have you considered?"),
    _question("anchor_td_result_02", "result_interpretation", "Was there a result that surprised you? How do you explain it without overstating the evidence?"),
    _question("anchor_td_followup_01", "multipart_followup", "You have explained one part of your argument. Could you now clarify a second part and explain how it changes the implication of your finding?"),
    _question("anchor_td_followup_02", "multipart_followup", "Could you address both the practical implication of your finding and the question it leaves for future research?"),
    # Research motivation, significance, scope, and thesis architecture.
    _question("anchor_td_motivation_01", "contribution_originality", "Why did you choose this research topic, and what research problem made it worth investigating?"),
    _question("anchor_td_significance_01", "contribution_originality", "What is the academic or practical significance of this study, and who could use its contribution?"),
    _question("anchor_td_framework_01", "multipart_followup", "Could you briefly outline the overall framework of your thesis and explain how the main sections support your central argument?"),
    _question("anchor_td_logic_01", "multipart_followup", "How are the main sections of your thesis logically connected, and why is that sequence necessary for your conclusion?"),
    # Literature, theory, and evidence.
    _question("anchor_td_review_01", "literature_comparison", "How did you select and organise the literature review, and how did it help you identify the gap addressed by this thesis?"),
    _question("anchor_td_views_01", "literature_comparison", "Where do important scholars disagree on this topic, and how does your thesis position itself in relation to those views?"),
    _question("anchor_td_theory_01", "definition_concept", "What theoretical foundation guides your analysis, and how does it shape the way you interpret the evidence?"),
    _question("anchor_td_evidence_01", "result_interpretation", "What is the main evidential basis for your central argument, and how did you decide that it supports your interpretation?"),
    # Design, method, and boundaries.
    _question("anchor_td_method_03", "method_choice", "Could you explain the main stages of your research method and why this sequence was appropriate for the study?"),
    _question("anchor_td_scope_01", "limitation_challenge", "Which closely related issue did you deliberately leave outside the scope of this thesis, and why was that boundary necessary?"),
    _question("anchor_td_gap_01", "limitation_challenge", "What remains insufficiently explored after this study, and what would be the most useful next step for future research?"),
    _question("anchor_td_visual_01", "method_choice", "How did you decide which figures, tables, or other visual evidence to include, and how do they support rather than merely illustrate your argument?"),
    _question("anchor_td_innovation_01", "contribution_originality", "What is innovative about the way this thesis frames the problem, uses evidence, or reaches its conclusion?"),
]

DEFENSE_STRATEGY_BY_ID = {q["id"]: q["answering_strategy"] for q in DEFENSE_QUESTION_BANK}
DEFENSE_STRATEGY_BY_TYPE = {q["question_type"]: q["answering_strategy"] for q in DEFENSE_QUESTION_BANK}

# Legacy interruption support for non-defense flows. Thesis Defense itself uses
# its post-presentation bank and the visible strategy cards above.
INTERRUPT_STRATEGIES = {
    "Methodology Weakness": "先承认合理边界，再说明研究依据和结论范围。",
    "Clarity": "先界定术语，再用论文内的一个例子说明。",
    "Research Design": "先说明研究选择，再解释理由与权衡。",
    "Causality Issue": "先给出严谨结论，再说明证据和替代解释。",
}
