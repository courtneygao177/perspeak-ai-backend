"""
Thesis Defense Knowledge Base
IELTS 5.5-6.0 level answering strategies for common defense questions.
Used by:
  - Q&A backend to enrich qa_bank with strategies
  - CQ evaluation engine for 3-way cross-analysis
  - Frontend hint button to display strategies during Q&A
"""

DEFENSE_QUESTION_BANK = [
    {
        "id": "q1_reason",
        "question": "What was your primary motivation for selecting this specific research topic?",
        "challenge_type": "Research Motivation",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Start with social or professional background. "
            "Connect it to your internship or practical experience. "
            "Mention discussions with your supervisor."
        ),
    },
    {
        "id": "q2_significance",
        "question": "Could you clarify the academic significance and practical objectives of your study?",
        "challenge_type": "Academic Significance",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Do not mix ideas. Clearly state how your paper helps the research field "
            "and what practical problems it solves."
        ),
    },
    {
        "id": "q3_framework",
        "question": "How did you design the basic framework and structure of this thesis?",
        "challenge_type": "Research Design",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Do not just read the outline. Explain the overall logic (e.g., General-Specific-General) "
            "and how different chapters connect."
        ),
    },
    {
        "id": "q4_logic",
        "question": "What is the underlying logical relationship between the different sections of your paper?",
        "challenge_type": "Structural Logic",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Explain the flow: introducing the background → identifying the problem "
            "→ analyzing the causes → proposing solutions."
        ),
    },
    {
        "id": "q5_counterarguments",
        "question": "Did you encounter any conflicting views or counterarguments during your research? How did you address them?",
        "challenge_type": "Counterarguments",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Never say 'No'. List different opinions. Do not completely agree or disagree; "
            "explain which theory you used as your foundation."
        ),
    },
    {
        "id": "q6_scope_limitations",
        "question": "What closely related issues or variables were excluded from the scope of your current research?",
        "challenge_type": "Scope Limitations",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Be honest. Choose 1 or 2 related topics and give a short summary "
            "of why they need further study."
        ),
    },
    {
        "id": "q7_depth_limitations",
        "question": "In your opinion, which parts of your thesis require more profound investigation or lack sufficient depth?",
        "challenge_type": "Depth Limitations",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Show self-awareness. Point out a specific section that is mentioned but not fully "
            "developed due to time or resource limits."
        ),
    },
    {
        "id": "q8_argument_basis",
        "question": "What constitutes the core theoretical basis or empirical evidence supporting your central argument?",
        "challenge_type": "Theoretical Foundation",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Focus on the current facts, data, or core theories that prove "
            "your thesis statement is correct."
        ),
    },
    {
        "id": "q9_innovation",
        "question": "What are the distinct innovative points or unique perspectives of your research?",
        "challenge_type": "Innovation",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Explain if you used a new perspective, a unique angle, or studied a topic "
            "that few people have explored before."
        ),
    },
    {
        "id": "q10_weaknesses",
        "question": "What are the major limitations or weaknesses of this study?",
        "challenge_type": "Methodology Weakness",
        "category": "Thesis Defense",
        "answering_strategy": (
            "Combine this with other knowledge areas. For example, mention that you need "
            "more knowledge in statistics to do deeper data analysis."
        ),
    },
]

# Strategy lookup by question ID — O(1) access
DEFENSE_STRATEGY_BY_ID = {q["id"]: q["answering_strategy"] for q in DEFENSE_QUESTION_BANK}

# Strategy lookup by challenge_type — for matching interrupt challenges
DEFENSE_STRATEGY_BY_TYPE = {
    q["challenge_type"]: q["answering_strategy"] for q in DEFENSE_QUESTION_BANK
}

# Strategies for mid-session INTERRUPT challenges (THESIS_DEFENSE_CHALLENGE_POOL)
INTERRUPT_STRATEGIES = {
    "Methodology Weakness": (
        "Do not be defensive. First acknowledge the concern ('That is a fair point'). "
        "Then explain your validation steps or why the limitation does not affect your core conclusion."
    ),
    "Clarity": (
        "Stop using academic jargon. Use a simple real-world analogy. "
        "For example, compare your concept to something from everyday life."
    ),
    "Research Design": (
        "Think about what you would do differently with more time and resources. "
        "Show that you understand both the strengths and the limits of your design choices."
    ),
    "Causality Issue": (
        "Give your clear position first — say 'Yes' or 'No' directly. "
        "Then explain your reasoning with data or references from your paper."
    ),
}
