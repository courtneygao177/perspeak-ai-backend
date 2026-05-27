import os
import json
import random
import base64
import io
import re
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "ai-presentation-dev-secret-2024")
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "ppt", "pptx"}

# ─────────────────────────────────────────────
# OPENAI-COMPATIBLE UNIFIED API CLIENT SETUP
# Works with any OpenAI-compatible relay/proxy (中转站)
# Set UNIFIED_API_KEY and UNIFIED_BASE_URL in Replit Secrets
# ─────────────────────────────────────────────
try:
    from openai import OpenAI as _OpenAI
    _UNIFIED_KEY = os.environ.get("UNIFIED_API_KEY", "").strip()
    _UNIFIED_URL = os.environ.get("UNIFIED_BASE_URL", "").strip()

    # Normalise base_url: strip whitespace, then strip any trailing
    # /chat/completions or /completions so the SDK can append correctly.
    # e.g. "https://api.ohmygpt.com/v1/chat/completions" → "https://api.ohmygpt.com/v1"
    if _UNIFIED_URL:
        for _suffix in ["/chat/completions", "/completions"]:
            if _UNIFIED_URL.rstrip("/ ").endswith(_suffix):
                _UNIFIED_URL = _UNIFIED_URL.rstrip("/ ")[: -len(_suffix)]
                break
        _UNIFIED_URL = _UNIFIED_URL.rstrip("/ ")

    if _UNIFIED_KEY and _UNIFIED_URL:
        _ai_client = _OpenAI(api_key=_UNIFIED_KEY, base_url=_UNIFIED_URL)
        AI_ENABLED = True
    else:
        _ai_client = None
        AI_ENABLED = False
except Exception as _e:
    _ai_client = None
    AI_ENABLED = False

# Model name — change this to whatever your relay supports, e.g. "gpt-4o", "claude-3-5-sonnet"
MODEL = os.environ.get("UNIFIED_MODEL", "gpt-4o")
MAX_TOKENS = 8192


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ─────────────────────────────────────────────
# CHALLENGE TYPE DICTIONARIES
# ─────────────────────────────────────────────
ACADEMIC_CHALLENGE_TYPES = {
    "Methodology Weakness": "Sample size too small or research design flawed",
    "Unsupported Claim": "Assertion made without sufficient evidence or citation",
    "Causality Issue": "Correlation presented as causation",
    "Literature Gap": "Missing key prior work or theoretical framework",
    "Overgeneralization": "Conclusion extrapolated far beyond the data",
}

BUSINESS_CHALLENGE_TYPES = {
    "Market Size Doubt": "Total addressable market is unclear or overstated",
    "Monetization Issue": "Revenue model is vague or economically unsound",
    "Defensibility": "Competitive moat is weak or nonexistent",
    "Unrealistic Assumption": "Growth or adoption projections lack grounding",
    "Competitor Challenge": "Existing players are stronger than acknowledged",
}

INTERRUPTABLE_SCENARIOS = {"Thesis Defense", "MBA Case Pitch"}

# ─────────────────────────────────────────────
# AUDIENCE PERSONA DEFINITIONS
# ─────────────────────────────────────────────
AUDIENCE_PERSONA = {
    "Professor": (
        "You are a rigorous academic professor. You speak in precise, formal academic English. "
        "You favor long, multi-clause sentences that probe methodology, logic, and evidence. "
        "You are not hostile — but you are relentless in demanding intellectual rigor. "
        "You always cite potential flaws in research design, sample validity, or causal claims."
    ),
    "VC": (
        "You are a seasoned venture capitalist with a cold, results-oriented demeanor. "
        "You speak in short, sharp sentences. You care only about: market size, revenue model, "
        "competitive moat, and capital efficiency. You are openly skeptical and press hard on "
        "unit economics, customer acquisition cost, and defensibility. You do not give compliments."
    ),
    "Classmates": (
        "You are a curious and friendly peer student. You speak informally and ask genuine, "
        "practical questions. You want to understand how this applies to real life, why it matters "
        "to ordinary people, and whether you could explain it to someone outside the field."
    ),
}

DIFFICULTY_INSTRUCTIONS = {
    "Easy": (
        "You are SUPPORTIVE. Ask only 1 gentle clarifying question per slide. "
        "Acknowledge what the presenter did well before asking. Use encouraging language. "
        "Maximum follow-up rounds: 1."
    ),
    "Medium": (
        "You are BALANCED. Challenge weak points directly but professionally. "
        "Ask 1–2 follow-up rounds on a substantive vulnerability. "
        "Maximum follow-up rounds: 2."
    ),
    "Hard": (
        "You are AGGRESSIVELY SKEPTICAL. Immediately attack the weakest point. "
        "Do not compliment. Demand concrete evidence, numbers, and mechanisms. "
        "Press relentlessly with 2+ follow-up rounds. Never accept a vague answer. "
        "Maximum follow-up rounds: 2."
    ),
}

MAX_FOLLOWUP_ROUNDS = {"Easy": 1, "Medium": 2, "Hard": 2}

# ─────────────────────────────────────────────
# FALLBACK MOCK DATA (used when AI is unavailable)
# ─────────────────────────────────────────────
MOCK_SLIDES = [
    {
        "page": 1,
        "title": "Introduction",
        "content": "Our solution addresses a critical gap in the EdTech market. "
                   "78% of non-native English speakers struggle with academic presentations. "
                   "Our AI-powered platform simulates real presentation environments.",
    },
    {
        "page": 2,
        "title": "Core Data & Market Validation",
        "content": "User research with 50 university students across 3 campuses. "
                   "Results: 43% improvement in presentation confidence after 4 sessions. "
                   "Target market: 1.8 million international students in the US alone.",
    },
    {
        "page": 3,
        "title": "Conclusion & Roadmap",
        "content": "Phase 1: Core simulation engine. Phase 2: LMS integration. "
                   "Phase 3: Multilingual support. Seeking $500K seed funding.",
    },
]

MOCK_CHALLENGE = {
    "trigger_page": 2,
    "challenge_type": "Methodology Weakness",
    "initial_challenge": (
        "According to your slide 2, your user test sample size is only 50 people. "
        "How can you prove this solution is scalable and reliable for the wider market?"
    ),
}

MOCK_FOLLOWUP_POOL = [
    "But 50 people cannot represent global diversity. What is your concrete strategy to mitigate this sampling bias?",
    "Your 43% improvement metric — what was the baseline? Was there a control group?",
    "You cite 1.8 million students but only tested on 3 campuses. How do you extrapolate market fit?",
    "The EdTech space is littered with failed AI tutoring products. What makes your moat defensible?",
]

MOCK_QA_BANK = [
    {"id": 1, "question": "How does your platform handle different English accents in speech recognition?",
     "category": "Technical Feasibility", "difficulty": "Hard", "challenge_type": "Methodology Weakness"},
    {"id": 2, "question": "What is your customer acquisition cost and projected LTV at scale?",
     "category": "Business Model", "difficulty": "Medium", "challenge_type": "Monetization Issue"},
    {"id": 3, "question": "How do you protect student data privacy under FERPA?",
     "category": "Legal & Compliance", "difficulty": "Medium", "challenge_type": "Unsupported Claim"},
]


# ─────────────────────────────────────────────
# PDF → BASE64 IMAGES PIPELINE (Step 1)
# ─────────────────────────────────────────────
def extract_pdf_images_as_base64(filepath, max_pages=6):
    """Convert PDF pages to base64-encoded PNG images for Vision API."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(filepath)
        images = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            mat = fitz.Matrix(1.5, 1.5)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
            images.append({"page": i + 1, "base64": b64, "media_type": "image/png"})
        doc.close()
        return images
    except Exception as e:
        app.logger.warning(f"PDF extraction failed: {e}")
        return []


def extract_ppt_images_as_base64(filepath, max_pages=6):
    """For PPT/PPTX files — extract text per slide as fallback (Vision not available for PPTX)."""
    try:
        from pptx import Presentation
        prs = Presentation(filepath)
        slides = []
        for i, slide in enumerate(prs.slides):
            if i >= max_pages:
                break
            texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    texts.append(shape.text.strip())
            slides.append({"page": i + 1, "text": "\n".join(texts)})
        return slides
    except Exception:
        return []


# ─────────────────────────────────────────────
# VISION: ANALYZE SLIDES (OpenAI-compatible multimodal)
# ─────────────────────────────────────────────
def analyze_slides_with_claude(images_b64, filename):
    """
    Send slide images to the AI Vision endpoint (OpenAI-compatible).
    Falls back to mock data on any error.
    """
    if not AI_ENABLED or not images_b64:
        return MOCK_SLIDES, False

    try:
        # Build OpenAI-compatible multimodal content list
        content_parts = [
            {
                "type": "text",
                "text": (
                    "You are an expert presentation analyst. I am uploading slide images from a presentation. "
                    "For each slide, extract: the slide title, a concise summary of the main content (2-4 sentences), "
                    "and the key claims or data points made.\n\n"
                    "Return a JSON array ONLY (no other text) with this exact structure:\n"
                    '[{"page": 1, "title": "...", "content": "...", "key_claims": ["claim1", "claim2"]}]\n\n'
                    "Be concise and factual. Extract exactly what is on the slides."
                ),
            }
        ]
        for img in images_b64:
            content_parts.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['media_type']};base64,{img['base64']}"
                },
            })

        response = _ai_client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": content_parts}],
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        slides = json.loads(raw)
        for i, s in enumerate(slides):
            s.setdefault("page", i + 1)
            s.setdefault("key_claims", [])
        return slides, True

    except Exception as e:
        app.logger.error(f"AI slide analysis failed: {e}")
        return MOCK_SLIDES, False


# ─────────────────────────────────────────────
# CLAUDE: MASTER ENGINE — BUILD CHALLENGE SEED + QA BANK (Step 3)
# ─────────────────────────────────────────────
def build_master_engine(slides, audience, scenario, difficulty):
    """
    The Master Engine: Claude reads slides + config and returns:
    - challenge_seed (for interruptable scenarios)
    - static_qa_bank (for Academic Presentation)
    Uses the full challenge classification dictionary in the system prompt.
    Falls back to mock data on error.
    """
    if not AI_ENABLED:
        return MOCK_CHALLENGE, MOCK_QA_BANK

    # Select challenge type dictionary based on scenario
    if scenario == "MBA Case Pitch":
        challenge_dict = BUSINESS_CHALLENGE_TYPES
        challenge_dict_name = "Business"
    else:
        challenge_dict = ACADEMIC_CHALLENGE_TYPES
        challenge_dict_name = "Academic"

    # Build scenario-specific instructions
    if scenario == "Academic Presentation":
        task_instruction = (
            "This is an ACADEMIC PRESENTATION (no mid-session interruptions). "
            "Generate exactly 3 deep, academically rigorous questions that challenge the presentation's "
            "weakest points. Each question must explicitly name which challenge type it targets. "
            "Return them as 'static_qa_bank' in the JSON.\n"
            "Set 'challenge_seed' to null."
        )
    else:
        trigger_page = min(2, len(slides))
        task_instruction = (
            f"This scenario has MID-SESSION INTERRUPTIONS. "
            f"Identify the single most devastating vulnerability in slide {trigger_page}. "
            f"Map it to exactly one challenge type from the dictionary above. "
            f"Generate the sharpest possible opening challenge question in the voice of the {audience} persona. "
            f"Set 'trigger_page' to {trigger_page}.\n"
            "Set 'static_qa_bank' to an empty array []."
        )

    slide_text = "\n\n".join(
        f"--- SLIDE {s['page']}: {s.get('title','')}\n{s.get('content','')}"
        for s in slides
    )

    challenge_dict_text = "\n".join(
        f"  - {k}: {v}" for k, v in challenge_dict.items()
    )

    audience_persona_text = AUDIENCE_PERSONA.get(audience, AUDIENCE_PERSONA["Professor"])
    difficulty_text = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS["Medium"])

    prompt = f"""You are a world-class presentation examiner AI.

AUDIENCE PERSONA:
{audience_persona_text}

DIFFICULTY MODE:
{difficulty_text}

{challenge_dict_name.upper()} CHALLENGE TYPE DICTIONARY (you MUST pick from these):
{challenge_dict_text}

PRESENTATION SLIDES:
{slide_text}

TASK:
{task_instruction}

Return ONLY valid JSON in this exact structure (no other text, no markdown):
{{
  "challenge_seed": {{
    "trigger_page": <int>,
    "challenge_type": "<one of the challenge type keys above>",
    "initial_challenge": "<the exact question to ask the presenter, in the persona's voice>"
  }},
  "static_qa_bank": [
    {{
      "id": 1,
      "question": "<deep question>",
      "challenge_type": "<challenge type key>",
      "category": "<Academic/Business/Technical>",
      "difficulty": "<Easy/Medium/Hard>"
    }}
  ]
}}"""

    try:
        response = _ai_client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)

        challenge_seed = data.get("challenge_seed") or MOCK_CHALLENGE
        static_qa_bank = data.get("static_qa_bank") or []

        for i, q in enumerate(static_qa_bank):
            q["id"] = i + 1

        return challenge_seed, static_qa_bank

    except Exception as e:
        app.logger.error(f"Master engine failed: {e}")
        return MOCK_CHALLENGE, MOCK_QA_BANK


# ─────────────────────────────────────────────
# CLAUDE: DYNAMIC FOLLOW-UP GENERATOR (Step 6)
# ─────────────────────────────────────────────
def generate_followup_question(
    slides, audience, difficulty, challenge_type, chat_history, user_answer, current_page
):
    """
    Generate a context-aware follow-up question given the user's answer
    and the full conversation history. Falls back to mock pool on error.
    """
    if not AI_ENABLED:
        used = [h["content"] for h in chat_history if h["role"] == "assistant"]
        available = [q for q in MOCK_FOLLOWUP_POOL if q not in used]
        return random.choice(available) if available else MOCK_FOLLOWUP_POOL[0]

    current_slide = next((s for s in slides if s["page"] == current_page), slides[0])
    persona = AUDIENCE_PERSONA.get(audience, AUDIENCE_PERSONA["Professor"])
    difficulty_inst = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS["Medium"])

    history_text = "\n".join(
        f"{'EXAMINER' if h['role'] == 'assistant' else 'PRESENTER'}: {h['content']}"
        for h in chat_history
    )

    prompt = f"""You are a {audience} examiner running a high-stakes presentation challenge.

YOUR PERSONA: {persona}

DIFFICULTY: {difficulty_inst}

SLIDE BEING DISCUSSED:
Title: {current_slide.get('title', '')}
Content: {current_slide.get('content', '')}

CHALLENGE TYPE BEING PRESSED: {challenge_type}

CONVERSATION SO FAR:
{history_text}
PRESENTER: {user_answer}

TASK: Generate your NEXT follow-up question. You must:
1. Directly reference something specific from the presenter's answer above
2. Press harder on the same "{challenge_type}" vulnerability — do not change topic
3. Stay strictly in character as the {audience} persona
4. Be {difficulty} in intensity

Return ONLY the question text. No preamble, no labels, no markdown."""

    try:
        response = _ai_client.chat.completions.create(
            model=MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        app.logger.error(f"Follow-up generation failed: {e}")
        used = [h["content"] for h in chat_history if h["role"] == "assistant"]
        available = [q for q in MOCK_FOLLOWUP_POOL if q not in used]
        return random.choice(available) if available else MOCK_FOLLOWUP_POOL[0]


# ─────────────────────────────────────────────
# CLAUDE: DUAL EVALUATION ENGINE (Step 8)
# ─────────────────────────────────────────────
def run_dual_evaluation(slides, answers, config, challenge_seed, qa_bank):
    """
    Full AI-powered dual evaluation. Returns structured PQ + CQ scores with
    challenge-type-specific feedback. Falls back to mock scoring on error.
    """
    audience = config.get("audience", "Professor")
    scenario = config.get("scenario", "Academic Presentation")
    difficulty = config.get("difficulty", "Medium")
    challenge_type = (challenge_seed or {}).get("challenge_type", "Unknown")
    interruptions = 0

    narrations = [a["text"] for a in answers if a.get("type") == "narration"]
    qa_answers = [a for a in answers if a.get("type") == "qa_answer"]
    interruptions = max((a.get("round", 1) for a in qa_answers), default=0)

    if not AI_ENABLED:
        return _mock_evaluation(difficulty, audience, interruptions,
                                bool(qa_answers), challenge_type)

    slide_text = "\n\n".join(
        f"Slide {s['page']}: {s.get('title','')}\n{s.get('content','')}"
        for s in slides
    )
    narration_text = "\n\n".join(
        f"[Slide {i+1} narration]: {t}" for i, t in enumerate(narrations)
    ) or "(No narration text recorded)"

    qa_text = "\n\n".join(
        f"[Q&A Round {a['round']}]: {a['text']}" for a in qa_answers
    ) or "(No Q&A answers recorded)"

    qa_bank_text = "\n".join(
        f"- [{q.get('challenge_type','')}] {q['question']}" for q in (qa_bank or [])
    ) or "(none)"

    prompt = f"""You are a dual-dimension presentation evaluation AI.

SESSION CONTEXT:
- Audience: {audience}
- Scenario: {scenario}
- Difficulty: {difficulty}
- Challenge Type Triggered: {challenge_type}
- Interruptions handled: {interruptions}

SLIDES PRESENTED:
{slide_text}

PRESENTER NARRATION (what they said):
{narration_text}

Q&A CHALLENGE ANSWERS:
{qa_text}

POST-PRESENTATION Q&A BANK (reference):
{qa_bank_text}

TASK: Evaluate the presenter on TWO dimensions. Return ONLY valid JSON (no markdown):

{{
  "presentation_quality": {{
    "overall": <float 0-10>,
    "dimensions": {{
      "Logic & Organization": <float 0-10>,
      "Content Relevance": <float 0-10>,
      "Grammar & Language": <float 0-10>,
      "Fluency & Pace": <float 0-10>,
      "Confidence & Tone": <float 0-10>,
      "Filler Words": <float 0-10>
    }},
    "feedback": "<2-3 sentences of specific, actionable PQ feedback referencing actual content>",
    "challenge_type_performance": "<1-2 sentences: how well did they handle the '{challenge_type}' challenge in their narration?>"
  }},
  "communication_quality": {{
    "overall": <float 0-10>,
    "dimensions": {{
      "Response Rate": <float 0-10>,
      "Answer Relevance": <float 0-10>,
      "Structure (BLUF)": <float 0-10>,
      "Persuasiveness": <float 0-10>,
      "Under Pressure": <float 0-10>
    }},
    "feedback": "<2-3 sentences of specific CQ feedback referencing actual Q&A answers>",
    "challenge_type_performance": "<1-2 sentences: how did they perform specifically on '{challenge_type}' when challenged?>"
  }}
}}

Scoring guidelines:
- Be honest and calibrated. Hard difficulty with short/vague answers = lower scores.
- If no narration was recorded, score Fluency/Grammar/Filler around 4-5.
- If no QA answers were recorded, score all CQ dimensions at 3-4.
- Reference specific content from what they said in the feedback fields."""

    try:
        response = _ai_client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)

        pq = result.get("presentation_quality", {})
        cq = result.get("communication_quality", {})

        # Clamp all scores to 0-10
        for section in [pq, cq]:
            if "dimensions" in section:
                section["dimensions"] = {
                    k: round(min(10.0, max(0.0, float(v))), 1)
                    for k, v in section["dimensions"].items()
                }
            if "overall" in section:
                section["overall"] = round(min(10.0, max(0.0, float(section["overall"]))), 1)

        return pq, cq, interruptions

    except Exception as e:
        app.logger.error(f"Dual evaluation failed: {e}")
        return _mock_evaluation(difficulty, audience, interruptions,
                                bool(qa_answers), challenge_type)


def _mock_evaluation(difficulty, audience, interruptions, has_answers, challenge_type):
    """Fallback mock scores when AI call fails."""
    pq_base = {"Easy": 8.5, "Medium": 7.0, "Hard": 5.5}.get(difficulty, 7.0)
    cq_base = 7.5 if has_answers else 4.0
    r = random.uniform

    pq = {
        "overall": round(min(10, pq_base + r(-0.8, 0.8)), 1),
        "dimensions": {
            "Logic & Organization": round(min(10, pq_base + r(-1, 1)), 1),
            "Content Relevance": round(min(10, pq_base + r(-0.5, 1.2)), 1),
            "Grammar & Language": round(min(10, pq_base + r(-1.5, 0.5)), 1),
            "Fluency & Pace": round(min(10, pq_base + r(-1, 0.8)), 1),
            "Confidence & Tone": round(min(10, pq_base + r(-0.8, 1)), 1),
            "Filler Words": round(min(10, pq_base + r(-2, 0.3)), 1),
        },
        "feedback": f"Evaluation completed in offline mode. Your {difficulty.lower()} difficulty session showed typical patterns for a {audience} audience.",
        "challenge_type_performance": f"Your handling of the '{challenge_type}' challenge was noted. See the training plan for targeted drills.",
    }
    cq = {
        "overall": round(min(10, cq_base + r(-0.5, 0.5)), 1),
        "dimensions": {
            "Response Rate": round(10.0 if has_answers else 3.0, 1),
            "Answer Relevance": round(min(10, cq_base + r(-1, 0.8)), 1),
            "Structure (BLUF)": round(min(10, cq_base + r(-1.5, 0.5)), 1),
            "Persuasiveness": round(min(10, cq_base + r(-1, 1)), 1),
            "Under Pressure": round(min(10, 5.0 + interruptions * 2 + r(-0.5, 0.5)), 1),
        },
        "feedback": "Offline evaluation mode. Run a full session with narration for AI-powered feedback.",
        "challenge_type_performance": f"Could not evaluate '{challenge_type}' response quality in offline mode.",
    }
    return pq, cq, interruptions


# ─────────────────────────────────────────────
# CLAUDE: GENERATE TRAINING PLAN (Step 8 → 9)
# ─────────────────────────────────────────────
def generate_training_plan(pq, cq, config, challenge_type, interruptions):
    """Generate a personalized training plan. Falls back to template on error."""
    difficulty = config.get("difficulty", "Medium")
    audience = config.get("audience", "Professor")
    scenario = config.get("scenario", "Academic Presentation")

    weakest_pq = min(pq["dimensions"], key=pq["dimensions"].get)
    weakest_cq = min(cq["dimensions"], key=cq["dimensions"].get)

    if not AI_ENABLED:
        return _template_training_plan(pq, cq, difficulty, audience, interruptions, challenge_type)

    prompt = f"""You are a world-class presentation coach. Generate a highly personalized, actionable training plan.

SESSION RESULTS:
- Audience: {audience} | Scenario: {scenario} | Difficulty: {difficulty}
- Interruptions handled: {interruptions}
- Challenge Type triggered: {challenge_type}

PRESENTATION QUALITY SCORES:
{json.dumps(pq['dimensions'], indent=2)}
- Weakest PQ dimension: {weakest_pq} ({pq['dimensions'][weakest_pq]}/10)
- PQ Feedback: {pq.get('feedback','')}
- Challenge type performance: {pq.get('challenge_type_performance','')}

COMMUNICATION QUALITY SCORES:
{json.dumps(cq['dimensions'], indent=2)}
- Weakest CQ dimension: {weakest_cq} ({cq['dimensions'][weakest_cq]}/10)
- CQ Feedback: {cq.get('feedback','')}
- Challenge type performance: {cq.get('challenge_type_performance','')}

Write a training plan with these exact sections (use ## and ### headers, markdown format):
## Personalized Training Plan

**Session Profile:** [summary line]

### Priority 1 — [Weakest PQ Dimension] ({weakest_pq})
[2-3 specific, immediately actionable drills. Reference the exact challenge type '{challenge_type}' where relevant.]

### Priority 2 — Communication Under Pressure: {weakest_cq}
[2-3 specific drills targeting how to respond better to '{challenge_type}' challenges. Include the BLUF framework if relevant.]

### Challenge Type Deep-Dive: {challenge_type}
[Explain what this challenge type means, why it was triggered in this session, and give 2 concrete techniques to preempt or deflect it in future presentations.]

### 30-Day Accelerator Schedule
[4 bullet points, one per week, with specific session types and goals]

Be concise, direct, and evidence-based. Reference the actual scores above."""

    try:
        response = _ai_client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        app.logger.error(f"Training plan generation failed: {e}")
        return _template_training_plan(pq, cq, difficulty, audience, interruptions, challenge_type)


def _template_training_plan(pq, cq, difficulty, audience, interruptions, challenge_type):
    weakest_pq = min(pq["dimensions"], key=pq["dimensions"].get)
    weakest_cq = min(cq["dimensions"], key=cq["dimensions"].get)
    pq_score = pq["dimensions"][weakest_pq]
    cq_score = cq["dimensions"][weakest_cq]

    return f"""## Personalized Training Plan

**Session Profile:** {difficulty} difficulty · {audience} audience · {interruptions} interruption(s) handled

### Priority 1 — {weakest_pq} (Score: {pq_score}/10)
Practice the Pyramid Principle: lead with your conclusion, support with 3 sub-points. Record yourself and review for logical gaps. Pay particular attention to how you address **{challenge_type}** vulnerabilities in your narration.

### Priority 2 — Communication Under Pressure: {weakest_cq} (Score: {cq_score}/10)
Drill the BLUF framework: Answer in 10 seconds → Evidence → Implication. Specifically practice responding to **{challenge_type}** challenges with data-first answers.

### Challenge Type Deep-Dive: {challenge_type}
This challenge type targets a fundamental weakness in your argument structure. Prepare a 30-second pre-emptive rebuttal for this type of question before your next real presentation.

### 30-Day Accelerator Schedule
- **Week 1:** Daily 15-min recording sessions (focus on pacing and structure)
- **Week 2:** 3x Medium difficulty full rehearsals with peer feedback
- **Week 3:** 2x Hard difficulty sessions with {audience} persona
- **Week 4:** Mock full defense/pitch with recorded video review"""


# ─────────────────────────────────────────────
# WHISPER STUB: AUDIO TRANSCRIPTION (Step 4)
# ─────────────────────────────────────────────
def transcribe_audio(audio_file):
    """
    Standard transcription interface — ready to wire to OpenAI/Groq Whisper.
    audio_file: a file-like object (wav/mp3/webm)
    Returns: str transcript in English
    Usage (OpenAI Whisper):
        import openai
        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        transcript = client.audio.transcriptions.create(
            model="whisper-1", file=audio_file, language="en"
        )
        return transcript.text
    Usage (Groq Whisper):
        import groq
        client = groq.Groq(api_key=os.environ["GROQ_API_KEY"])
        transcript = client.audio.transcriptions.create(
            model="whisper-large-v3", file=audio_file, language="en"
        )
        return transcript.text
    """
    raise NotImplementedError(
        "transcribe_audio: Connect to OpenAI or Groq Whisper API. See docstring for wiring instructions."
    )


# ─────────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    session.clear()
    return render_template("index.html", ai_enabled=AI_ENABLED)


@app.route("/config")
def config_page():
    if "slides" not in session:
        return redirect(url_for("index"))
    return render_template("config.html", slides=session.get("slides", []), ai_enabled=AI_ENABLED)


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
        ai_enabled=AI_ENABLED,
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
        ai_enabled=AI_ENABLED,
    )


# ─────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def api_upload():
    """
    Step 1: Accept file → extract page images → prepare for Claude Vision.
    Does NOT call Claude yet (that happens in /api/start-session after config).
    """
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

    ext = filename.rsplit(".", 1)[1].lower()

    # Extract images / text for the Vision pipeline
    images_b64 = []
    if ext == "pdf":
        images_b64 = extract_pdf_images_as_base64(save_path)

    # Analyse immediately with Claude Vision (PDF only; PPT falls back to mock)
    if images_b64 and AI_ENABLED:
        slides, ai_used = analyze_slides_with_claude(images_b64, filename)
    else:
        slides, ai_used = MOCK_SLIDES, False

    session["slides"] = slides
    session["filename"] = filename
    session["images_b64"] = [{"page": img["page"], "media_type": img["media_type"],
                               "base64": img["base64"]} for img in images_b64]
    session["answers"] = []
    session["qa_bank"] = []

    return jsonify({
        "success": True,
        "filename": filename,
        "slides": slides,
        "ai_used": ai_used,
        "message": f"File parsed. {len(slides)} slides detected.",
    })


@app.route("/api/start-session", methods=["POST"])
def api_start_session():
    """
    Steps 2 → 3: Receive config → call Master Engine (Claude) →
    build challenge seed + QA bank → init state machine → redirect to sandbox.
    """
    data = request.get_json()
    audience = data.get("audience", "Professor")
    scenario = data.get("scenario", "Academic Presentation")
    difficulty = data.get("difficulty", "Medium")

    slides = session.get("slides", MOCK_SLIDES)

    # Step 3: Master Engine — Claude analyses slides + config
    challenge_seed, static_qa_bank = build_master_engine(slides, audience, scenario, difficulty)

    session["config"] = {
        "audience": audience,
        "scenario": scenario,
        "difficulty": difficulty,
        "persona": AUDIENCE_PERSONA.get(audience, AUDIENCE_PERSONA["Professor"]),
    }
    session["challenge_seed"] = challenge_seed
    # For Academic Presentation, store the pre-generated QA bank now
    if scenario == "Academic Presentation":
        session["qa_bank"] = static_qa_bank
    else:
        session["qa_bank"] = []

    max_rounds = MAX_FOLLOWUP_ROUNDS.get(difficulty, 2)

    session["state"] = {
        "current_page": 1,
        "total_interruptions": 0,
        "in_qa_mode": False,
        "follow_up_round": 0,
        "chat_history": [],
        "max_follow_up_rounds": max_rounds,
    }

    return jsonify({"success": True, "redirect": "/sandbox"})


@app.route("/api/session-state", methods=["GET"])
def api_session_state():
    return jsonify({
        "state": session.get("state", {}),
        "config": session.get("config", {}),
        "slides": session.get("slides", []),
    })


@app.route("/api/check-slide", methods=["POST"])
def api_check_slide():
    """
    Step 5: Core State Machine — user clicked 'Finish current slide'.
    Interrupt logic driven by difficulty-aware max_follow_up_rounds.
    """
    if "state" not in session:
        return jsonify({"error": "No active session"}), 400

    state = dict(session["state"])
    config = session.get("config", {})
    challenge_seed = session.get("challenge_seed") or MOCK_CHALLENGE
    slides = session.get("slides", MOCK_SLIDES)

    scenario = config.get("scenario", "Academic Presentation")
    trigger_page = (challenge_seed or {}).get("trigger_page", 2)
    current_page = state["current_page"]

    req_data = request.get_json() or {}
    narration = req_data.get("narration", "")
    if narration:
        answers_list = list(session.get("answers", []))
        answers_list.append({"type": "narration", "page": current_page, "text": narration})
        session["answers"] = answers_list

    should_interrupt = (
        scenario in INTERRUPTABLE_SCENARIOS
        and current_page == trigger_page
        and state["total_interruptions"] < 1
        and not state["in_qa_mode"]
    )

    if should_interrupt:
        state["in_qa_mode"] = True
        state["follow_up_round"] = 1
        state["chat_history"] = []
        session["state"] = state
        return jsonify({
            "action": "INTERRUPT",
            "question": challenge_seed["initial_challenge"],
            "challenge_type": challenge_seed.get("challenge_type", ""),
            "page": current_page,
        })

    next_page = current_page + 1
    if next_page > len(slides):
        session["state"] = state
        return jsonify({"action": "PRESENTATION_DONE"})

    state["current_page"] = next_page
    state["in_qa_mode"] = False
    state["follow_up_round"] = 0
    state["chat_history"] = []
    session["state"] = state

    current_slide = next((s for s in slides if s["page"] == next_page), slides[0])
    return jsonify({"action": "NEXT_SLIDE", "page": next_page, "slide": current_slide})


@app.route("/api/submit-answer", methods=["POST"])
def api_submit_answer():
    """
    Step 6: Dynamic multi-round follow-up with Claude AI.
    Respects difficulty-controlled max_follow_up_rounds.
    """
    if "state" not in session:
        return jsonify({"error": "No active session"}), 400

    data = request.get_json()
    user_answer = data.get("answer", "")
    state = dict(session["state"])
    config = session.get("config", {})
    slides = session.get("slides", MOCK_SLIDES)
    challenge_seed = session.get("challenge_seed") or MOCK_CHALLENGE

    follow_up_round = state.get("follow_up_round", 1)
    max_rounds = state.get("max_follow_up_rounds", 2)

    chat_history = list(state.get("chat_history", []))
    chat_history.append({"role": "user", "content": user_answer})
    state["chat_history"] = chat_history

    answers_list = list(session.get("answers", []))
    answers_list.append({
        "type": "qa_answer",
        "page": state["current_page"],
        "round": follow_up_round,
        "text": user_answer,
    })
    session["answers"] = answers_list

    if follow_up_round < max_rounds:
        # Generate AI follow-up
        follow_up = generate_followup_question(
            slides=slides,
            audience=config.get("audience", "Professor"),
            difficulty=config.get("difficulty", "Medium"),
            challenge_type=challenge_seed.get("challenge_type", ""),
            chat_history=chat_history,
            user_answer=user_answer,
            current_page=state["current_page"],
        )

        chat_history.append({"role": "assistant", "content": follow_up})
        state["follow_up_round"] = follow_up_round + 1
        state["chat_history"] = chat_history
        session["state"] = state

        return jsonify({
            "status": "CONTINUE_QA",
            "next_question": follow_up,
            "round": state["follow_up_round"],
        })
    else:
        # QA finished
        state["in_qa_mode"] = False
        state["chat_history"] = []
        state["total_interruptions"] = state.get("total_interruptions", 0) + 1
        slides_list = session.get("slides", MOCK_SLIDES)
        next_page = state["current_page"] + 1
        if next_page <= len(slides_list):
            state["current_page"] = next_page
        state["follow_up_round"] = 0
        session["state"] = state

        return jsonify({
            "status": "QA_FINISHED",
            "message": "质询结束，请继续您的 Presentation。",
            "next_page": state["current_page"],
        })


@app.route("/api/finish-presentation", methods=["POST"])
def api_finish_presentation():
    """
    Steps 7 & 8: Generate QA bank (non-MBA) + run AI dual evaluation + training plan.
    """
    config = session.get("config", {})
    answers = session.get("answers", [])
    state = session.get("state", {})
    slides = session.get("slides", MOCK_SLIDES)
    challenge_seed = session.get("challenge_seed") or MOCK_CHALLENGE
    scenario = config.get("scenario", "Academic Presentation")

    # Step 7: QA bank
    # Academic Presentation: already generated in start-session
    # Thesis Defense: generate now post-presentation
    # MBA Case Pitch: skip
    qa_bank = session.get("qa_bank", [])
    if scenario == "Thesis Defense" and not qa_bank:
        _, qa_bank = build_master_engine(
            slides,
            config.get("audience", "Professor"),
            "Academic Presentation",  # use academic challenge types for QA bank
            config.get("difficulty", "Medium"),
        )
        session["qa_bank"] = qa_bank

    # Step 8: Dual evaluation
    pq, cq, interruptions = run_dual_evaluation(
        slides, answers, config, challenge_seed, qa_bank
    )

    challenge_type = challenge_seed.get("challenge_type", "General")

    # Step 9: Training plan
    training_plan = generate_training_plan(pq, cq, config, challenge_type, interruptions)

    evaluation = {
        "presentation_quality": pq,
        "communication_quality": cq,
        "training_plan": training_plan,
        "scenario": scenario,
        "audience": config.get("audience", "Professor"),
        "difficulty": config.get("difficulty", "Medium"),
        "total_interruptions": interruptions,
        "challenge_type": challenge_type,
        "ai_powered": AI_ENABLED,
    }

    session["evaluation"] = evaluation
    return jsonify({"success": True, "redirect": "/report"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
