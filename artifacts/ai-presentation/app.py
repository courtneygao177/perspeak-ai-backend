import os
import json
import random
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "ai-presentation-dev-secret-2024")
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "ppt", "pptx"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ─────────────────────────────────────────────
# MOCK DATA  (replace with real AI calls later)
# ─────────────────────────────────────────────
MOCK_SLIDES = [
    {
        "page": 1,
        "title": "Introduction",
        "content": "Our solution addresses a critical gap in the EdTech market. "
                   "We identified that 78% of non-native English speakers struggle with "
                   "academic presentations, leading to lower grades and reduced opportunities. "
                   "Our AI-powered platform simulates real presentation environments.",
    },
    {
        "page": 2,
        "title": "Core Data & Market Validation",
        "content": "User research conducted with 50 university students across 3 campuses. "
                   "Results show 43% improvement in presentation confidence after 4 sessions. "
                   "Target market: 1.8 million international students in the US alone. "
                   "Current competitors lack real-time AI feedback and multi-role simulation.",
    },
    {
        "page": 3,
        "title": "Conclusion & Roadmap",
        "content": "Phase 1 (Q1-Q2): Core simulation engine with 3 difficulty levels. "
                   "Phase 2 (Q3): Integration with LMS platforms (Canvas, Blackboard). "
                   "Phase 3 (Q4): Multilingual support and mobile app release. "
                   "We seek $500K seed funding to accelerate GTM and expand our AI model.",
    },
]

CHALLENGE_SEED = {
    "trigger_page": 2,
    "initial_challenge": (
        "According to your slide 2, your user test sample size is only 50 people. "
        "How can you prove this solution is scalable and reliable for the wider market?"
    ),
}

FOLLOW_UP_POOL = [
    "But 50 people cannot represent the diversity of international students globally. "
    "What is your concrete strategy to mitigate this sampling bias?",
    "Your 43% improvement metric — what was the baseline measurement methodology? "
    "Was there a control group? How do you ensure this is not a placebo effect?",
    "You mention 1.8 million international students in the US, but your pilot was only "
    "on 3 campuses. How do you extrapolate from this limited dataset to claim market fit?",
    "The EdTech space is littered with failed AI tutoring products. What specifically "
    "makes your simulation engine defensible against well-funded competitors?",
]

MOCK_QA_BANK = [
    {
        "id": 1,
        "question": "How does your platform handle different English accents and dialects in speech recognition?",
        "category": "Technical Feasibility",
        "difficulty": "Hard",
    },
    {
        "id": 2,
        "question": "What is your customer acquisition cost and projected LTV at scale?",
        "category": "Business Model",
        "difficulty": "Medium",
    },
    {
        "id": 3,
        "question": "How do you protect the privacy and data of student users, especially under FERPA?",
        "category": "Legal & Compliance",
        "difficulty": "Medium",
    },
]

AUDIENCE_PERSONA = {
    "Professor": "You are a strict academic professor who values rigorous methodology, "
                 "proper citations, and logical coherence. You challenge vague claims.",
    "Classmates": "You are a curious peer who asks clarifying questions and wants to "
                  "understand the practical applications and personal relevance.",
    "VC": "You are a demanding venture capitalist focused on market size, defensibility, "
          "monetization strategy, and return on investment.",
}

INTERRUPTABLE_SCENARIOS = {"Thesis Defense", "MBA Case Pitch"}


# ─────────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    session.clear()
    return render_template("index.html")


@app.route("/config")
def config():
    if "slides" not in session:
        return redirect(url_for("index"))
    return render_template("config.html", slides=session.get("slides", []))


@app.route("/sandbox")
def sandbox():
    if "state" not in session:
        return redirect(url_for("index"))
    state = session["state"]
    slides = session.get("slides", [])
    cfg = session.get("config", {})
    current_slide = next((s for s in slides if s["page"] == state["current_page"]), slides[0])
    return render_template(
        "sandbox.html",
        state=state,
        slides=slides,
        config=cfg,
        current_slide=current_slide,
        total_pages=len(slides),
    )


@app.route("/report")
def report():
    if "evaluation" not in session:
        return redirect(url_for("index"))
    return render_template(
        "report.html",
        evaluation=session.get("evaluation"),
        qa_bank=session.get("qa_bank", []),
        config=session.get("config", {}),
        answers=session.get("answers", []),
    )


# ─────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def api_upload():
    """Step 1 & 2: Accept file upload, return mock slides + challenge seed."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Please upload PDF, PPT, or PPTX."}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(save_path)

    # Step 1 Mock: return slide content JSON
    # Step 2 Mock: build logic tree + embed challenge seed
    session["slides"] = MOCK_SLIDES
    session["challenge_seed"] = CHALLENGE_SEED
    session["filename"] = filename
    session["answers"] = []
    session["qa_bank"] = []

    return jsonify(
        {
            "success": True,
            "filename": filename,
            "slides": MOCK_SLIDES,
            "challenge_seed": CHALLENGE_SEED,
            "message": "File parsed successfully. Logic tree built.",
        }
    )


@app.route("/api/start-session", methods=["POST"])
def api_start_session():
    """Step 3: Receive configuration and initialize session state machine."""
    data = request.get_json()
    audience = data.get("audience", "Professor")
    scenario = data.get("scenario", "Academic Presentation")
    difficulty = data.get("difficulty", "Medium")

    session["config"] = {
        "audience": audience,
        "scenario": scenario,
        "difficulty": difficulty,
        "persona": AUDIENCE_PERSONA.get(audience, AUDIENCE_PERSONA["Professor"]),
    }

    session["state"] = {
        "current_page": 1,
        "total_interruptions": 0,
        "in_qa_mode": False,
        "follow_up_round": 0,
        "chat_history": [],
    }

    return jsonify({"success": True, "redirect": "/sandbox"})


@app.route("/api/session-state", methods=["GET"])
def api_session_state():
    """Return current session state for frontend polling."""
    return jsonify(
        {
            "state": session.get("state", {}),
            "config": session.get("config", {}),
            "slides": session.get("slides", []),
        }
    )


@app.route("/api/check-slide", methods=["POST"])
def api_check_slide():
    """
    Step 5: Core State Machine — user clicked 'Finish current slide'.
    Decides whether to trigger interrupt or advance to next slide.
    """
    if "state" not in session:
        return jsonify({"error": "No active session"}), 400

    state = dict(session["state"])
    config = session.get("config", {})
    challenge_seed = session.get("challenge_seed", CHALLENGE_SEED)
    slides = session.get("slides", MOCK_SLIDES)

    scenario = config.get("scenario", "Academic Presentation")
    trigger_page = challenge_seed.get("trigger_page", 2)
    current_page = state["current_page"]

    # Record user's slide narration text if provided
    data = request.get_json() or {}
    narration = data.get("narration", "")
    if narration:
        answers_list = list(session.get("answers", []))
        answers_list.append(
            {
                "type": "narration",
                "page": current_page,
                "text": narration,
            }
        )
        session["answers"] = answers_list

    # --- Interrupt logic ---
    should_interrupt = (
        scenario in INTERRUPTABLE_SCENARIOS
        and current_page == trigger_page
        and state["total_interruptions"] < 2
        and not state["in_qa_mode"]
    )

    if should_interrupt:
        state["in_qa_mode"] = True
        state["follow_up_round"] = 1
        state["chat_history"] = []
        session["state"] = state
        return jsonify(
            {
                "action": "INTERRUPT",
                "question": challenge_seed["initial_challenge"],
                "page": current_page,
            }
        )

    # --- Advance to next slide ---
    next_page = current_page + 1
    if next_page > len(slides):
        # All slides done — signal end of presentation
        session["state"] = state
        return jsonify({"action": "PRESENTATION_DONE"})

    state["current_page"] = next_page
    state["in_qa_mode"] = False
    state["follow_up_round"] = 0
    state["chat_history"] = []
    session["state"] = state

    current_slide = next((s for s in slides if s["page"] == next_page), slides[0])
    return jsonify(
        {
            "action": "NEXT_SLIDE",
            "page": next_page,
            "slide": current_slide,
        }
    )


@app.route("/api/submit-answer", methods=["POST"])
def api_submit_answer():
    """
    Step 6: Dynamic multi-round follow-up routing.
    User submits answer to AI challenge; backend decides continue or finish QA.
    """
    if "state" not in session:
        return jsonify({"error": "No active session"}), 400

    data = request.get_json()
    user_answer = data.get("answer", "")
    state = dict(session["state"])
    follow_up_round = state.get("follow_up_round", 1)

    # Append to chat history
    chat_history = list(state.get("chat_history", []))
    chat_history.append({"role": "user", "content": user_answer})
    state["chat_history"] = chat_history

    # Record answer for evaluation
    answers_list = list(session.get("answers", []))
    answers_list.append(
        {
            "type": "qa_answer",
            "page": state["current_page"],
            "round": follow_up_round,
            "text": user_answer,
        }
    )
    session["answers"] = answers_list

    if follow_up_round < 2:
        # Generate dynamic follow-up (Mock: pick from pool, avoid repeats)
        used = [h["content"] for h in chat_history if h["role"] == "assistant"]
        available = [q for q in FOLLOW_UP_POOL if q not in used]
        follow_up = random.choice(available) if available else FOLLOW_UP_POOL[0]

        chat_history.append({"role": "assistant", "content": follow_up})
        state["follow_up_round"] = follow_up_round + 1
        state["chat_history"] = chat_history
        session["state"] = state

        return jsonify(
            {
                "status": "CONTINUE_QA",
                "next_question": follow_up,
                "round": state["follow_up_round"],
            }
        )
    else:
        # QA finished — unfreeze page
        state["in_qa_mode"] = False
        state["chat_history"] = []
        state["total_interruptions"] = state.get("total_interruptions", 0) + 1
        # Advance to next slide after QA
        slides = session.get("slides", MOCK_SLIDES)
        next_page = state["current_page"] + 1
        if next_page <= len(slides):
            state["current_page"] = next_page
        state["follow_up_round"] = 0
        session["state"] = state

        return jsonify(
            {
                "status": "QA_FINISHED",
                "message": "质询结束，请继续您的 Presentation。",
                "next_page": state["current_page"],
            }
        )


@app.route("/api/finish-presentation", methods=["POST"])
def api_finish_presentation():
    """
    Steps 7 & 8: Generate Q&A bank (non-MBA scenarios) + run dual evaluation engine.
    """
    config = session.get("config", {})
    answers = session.get("answers", [])
    state = session.get("state", {})
    scenario = config.get("scenario", "Academic Presentation")
    difficulty = config.get("difficulty", "Medium")
    audience = config.get("audience", "Professor")

    # Step 7: Generate Q&A bank (Academic Presentation & Thesis Defense only)
    qa_bank = []
    if scenario != "MBA Case Pitch":
        qa_bank = MOCK_QA_BANK

    session["qa_bank"] = qa_bank

    # Step 8: Dual Evaluation Engine (Mock scoring)
    interruptions = state.get("total_interruptions", 0)
    has_answers = any(a["type"] == "qa_answer" for a in answers)

    # Presentation Quality scores (0-10)
    pq_base = {"Easy": 8.5, "Medium": 7.0, "Hard": 5.5}.get(difficulty, 7.0)
    pq_variance = random.uniform(-0.8, 0.8)

    presentation_quality = {
        "overall": round(min(10, pq_base + pq_variance), 1),
        "dimensions": {
            "Logic & Organization": round(min(10, pq_base + random.uniform(-1, 1)), 1),
            "Content Relevance": round(min(10, pq_base + random.uniform(-0.5, 1.2)), 1),
            "Grammar & Language": round(min(10, pq_base + random.uniform(-1.5, 0.5)), 1),
            "Fluency & Pace": round(min(10, pq_base + random.uniform(-1, 0.8)), 1),
            "Confidence & Tone": round(min(10, pq_base + random.uniform(-0.8, 1)), 1),
            "Filler Words": round(min(10, pq_base + random.uniform(-2, 0.3)), 1),
        },
        "feedback": _generate_pq_feedback(difficulty, audience),
    }

    # Communication Quality scores (0-10)
    cq_base = 8.0 if has_answers else 4.0
    cq_base += interruptions * 0.5

    communication_quality = {
        "overall": round(min(10, cq_base + random.uniform(-0.5, 0.5)), 1),
        "dimensions": {
            "Response Rate": round(10.0 if has_answers else 3.0, 1),
            "Answer Relevance": round(min(10, cq_base + random.uniform(-1, 0.8)), 1),
            "Structure (BLUF)": round(min(10, cq_base + random.uniform(-1.5, 0.5)), 1),
            "Persuasiveness": round(min(10, cq_base + random.uniform(-1, 1)), 1),
            "Under Pressure": round(min(10, 5.0 + interruptions * 2 + random.uniform(-0.5, 0.5)), 1),
        },
        "feedback": _generate_cq_feedback(interruptions, has_answers, difficulty),
    }

    evaluation = {
        "presentation_quality": presentation_quality,
        "communication_quality": communication_quality,
        "training_plan": _generate_training_plan(
            presentation_quality, communication_quality, difficulty, audience, interruptions
        ),
        "scenario": scenario,
        "audience": audience,
        "difficulty": difficulty,
        "total_interruptions": interruptions,
    }

    session["evaluation"] = evaluation
    return jsonify({"success": True, "redirect": "/report"})


# ─────────────────────────────────────────────
# HELPER: Feedback & Training Plan Generators
# ─────────────────────────────────────────────

def _generate_pq_feedback(difficulty, audience):
    templates = {
        "Easy": (
            "Your presentation showed solid structure and clear communication. "
            "The content flow was logical and easy to follow. "
            "Focus on reducing filler words and varying your vocal tone for greater impact."
        ),
        "Medium": (
            "Good presentation overall with room for improvement. "
            "Your logical organization is developing well, but some transitions felt abrupt. "
            "Work on maintaining consistent pace and projecting more confidence in data-heavy sections."
        ),
        "Hard": (
            "This was a challenging session and your resilience showed. "
            "Under aggressive questioning, your language quality and pace suffered — this is normal. "
            "Prioritize short, declarative sentences when under pressure. Avoid over-explaining."
        ),
    }
    base = templates.get(difficulty, templates["Medium"])
    if audience == "VC":
        base += " For a VC audience, lead with impact metrics before explaining methodology."
    elif audience == "Professor":
        base += " Academic audiences expect precise language — avoid colloquialisms and back every claim."
    return base


def _generate_cq_feedback(interruptions, has_answers, difficulty):
    if not has_answers:
        return (
            "No Q&A challenge was triggered in this session. "
            "Consider practicing with 'Thesis Defense' or 'MBA Case Pitch' scenarios "
            "to train your response-under-pressure skills."
        )
    if interruptions >= 2:
        return (
            "You successfully navigated multiple rounds of aggressive questioning — excellent resilience. "
            "Your answers improved in structure across rounds. "
            "Continue practicing the BLUF (Bottom Line Up Front) technique: "
            "give your conclusion in 10 seconds, then support with evidence."
        )
    return (
        "You handled the interruption challenge. "
        "Focus on using the BLUF framework: answer the core question first, "
        "then provide supporting evidence. Avoid defensive language when challenged."
    )


def _generate_training_plan(pq, cq, difficulty, audience, interruptions):
    weakest_pq = min(pq["dimensions"], key=pq["dimensions"].get)
    weakest_cq = min(cq["dimensions"], key=cq["dimensions"].get)
    pq_score = pq["dimensions"][weakest_pq]
    cq_score = cq["dimensions"][weakest_cq]

    plan_lines = [
        "## Personalized Training Plan",
        "",
        f"**Session Profile:** {difficulty} difficulty · {audience} audience · "
        f"{interruptions} interruption(s) handled",
        "",
        "### Priority 1 — Presentation Quality",
        f"**Weakest Dimension:** {weakest_pq} (Score: {pq_score}/10)",
    ]

    pq_drills = {
        "Logic & Organization": (
            "Practice the 'Pyramid Principle': state your main point, then support with 3 sub-points. "
            "Record yourself and map your speech to an outline after."
        ),
        "Content Relevance": (
            "Before each slide, write one sentence: 'The key takeaway of this slide is ___.' "
            "Everything you say should connect back to that sentence."
        ),
        "Grammar & Language": (
            "Shadow TED talks for 10 minutes daily. Focus on sentence-final intonation patterns. "
            "Use Grammarly to review your written scripts before practicing them aloud."
        ),
        "Fluency & Pace": (
            "Record a 2-minute presentation and count your words per minute (target: 130-150 WPM). "
            "Slow down at key data points — use deliberate pauses for emphasis."
        ),
        "Confidence & Tone": (
            "Practice 'power poses' for 2 minutes before sessions. "
            "Record your voice and compare to a confident speaker you admire. "
            "Use rising-then-falling intonation on statements (not rising — it sounds uncertain)."
        ),
        "Filler Words": (
            "Install a filler-word counter app. Set a goal of <3 filler words per minute. "
            "Replace 'um' with a 1-second silent pause — it sounds more authoritative."
        ),
    }

    plan_lines.append(pq_drills.get(weakest_pq, "Practice this dimension with targeted recording sessions."))
    plan_lines.append("")
    plan_lines.append("### Priority 2 — Communication Under Pressure")
    plan_lines.append(f"**Weakest Dimension:** {weakest_cq} (Score: {cq_score}/10)")

    cq_drills = {
        "Response Rate": (
            "In 'Thesis Defense' mode, practice never passing on a question. "
            "Even if unsure, say: 'That's an important point — my current data suggests X, "
            "and I'd validate this further with Y.'"
        ),
        "Answer Relevance": (
            "For each question, write it down, identify the core concern, and draft a 30-word answer. "
            "Practice 'Question Paraphrase': repeat the question back before answering."
        ),
        "Structure (BLUF)": (
            "Drill the BLUF framework: Answer → Evidence → Implication. "
            "Aim to deliver your core answer in the first 15 seconds of every response."
        ),
        "Persuasiveness": (
            "Study 'Monroe's Motivated Sequence'. For each QA round, prepare a data point + analogy combo. "
            "Data without story is forgettable — story without data is untrustworthy."
        ),
        "Under Pressure": (
            f"Run {3 + (2 - interruptions)} more 'Hard' difficulty sessions targeting the "
            f"same topic. Exposure therapy is the fastest path to composure under aggressive questioning."
        ),
    }

    plan_lines.append(cq_drills.get(weakest_cq, "Run additional Q&A challenge sessions with increasing difficulty."))
    plan_lines.append("")
    plan_lines.append("### 30-Day Accelerator Schedule")
    plan_lines.append(
        "- **Week 1:** Daily 15-min recording sessions (focus on pacing and structure)\n"
        "- **Week 2:** 3x 'Medium' difficulty full rehearsals with peer feedback\n"
        "- **Week 3:** 2x 'Hard' difficulty sessions with VC or Professor persona\n"
        "- **Week 4:** Mock full defense/pitch with recorded video review"
    )

    return "\n".join(plan_lines)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
