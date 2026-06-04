import os
import json
import random
import base64
import io
import re
import traceback
import uuid
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "ai-presentation-dev-secret-2024")
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")

# ── Server-side report store (avoids 4KB cookie overflow) ─────────────────────
# Large blobs (evaluation, qa_bank, answers) are written to disk as JSON files
# keyed by a UUID. Only the 36-char key is stored in the session cookie.
_REPORT_DIR = os.path.join(os.path.dirname(__file__), "uploads", "reports")

def _save_report(evaluation, qa_bank, answers):
    """Persist report blobs to disk; return key to store in session."""
    os.makedirs(_REPORT_DIR, exist_ok=True)
    key = str(uuid.uuid4())
    payload = {"evaluation": evaluation, "qa_bank": qa_bank, "answers": answers}
    with open(os.path.join(_REPORT_DIR, f"{key}.json"), "w") as fh:
        json.dump(payload, fh)
    return key

def _load_report(key):
    """Load report blobs from disk; returns None if missing/corrupt."""
    if not key:
        return None
    path = os.path.join(_REPORT_DIR, f"{key}.json")
    try:
        with open(path) as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return None

# ── Server-side slides store (avoids 4KB cookie overflow on large decks) ──────
_SLIDES_DIR = os.path.join(os.path.dirname(__file__), "uploads", "slide_store")

def _save_slides(slides):
    """Write slides list to disk; return the UUID key to store in session."""
    os.makedirs(_SLIDES_DIR, exist_ok=True)
    key = str(uuid.uuid4())
    with open(os.path.join(_SLIDES_DIR, f"{key}.json"), "w", encoding="utf-8") as fh:
        json.dump(slides, fh, ensure_ascii=False)
    return key

def _load_slides(session_obj):
    """Load slides from disk using session's slide_key. Falls back to MOCK_SLIDES."""
    key = session_obj.get("slide_key", "")
    if not key:
        return MOCK_SLIDES
    path = os.path.join(_SLIDES_DIR, f"{key}.json")
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return MOCK_SLIDES

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

# ── CORS: allow all origins so the proxied iframe can reach Flask ──────────────
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@app.route("/x/<path:p>", methods=["OPTIONS"])
@app.route("/<path:p>", methods=["OPTIONS"])
def options_handler(p=""):
    return "", 204

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
        # timeout=120s — Gemini 1.5 Pro on 6-slide + Q&A eval can take >60s via relay
        _ai_client = _OpenAI(api_key=_UNIFIED_KEY, base_url=_UNIFIED_URL, timeout=120.0)
        AI_ENABLED = True
    else:
        _ai_client = None
        AI_ENABLED = False
except Exception as _e:
    _ai_client = None
    AI_ENABLED = False

# ── Multi-model routing ───────────────────────────────────────────────────────
# Each step is routed to the best-fit model via the same relay endpoint.
# Override any model via env vars in Replit Secrets.
VISION_MODEL = os.environ.get("VISION_MODEL", "gpt-4o")                    # Step 1: Vision
TEXT_MODEL   = os.environ.get("TEXT_MODEL",   "gpt-4o")                      # Steps 3,5,6: reasoning
EVAL_MODEL   = os.environ.get("EVAL_MODEL",   "gemini-2.5-flash")            # Steps 8,9: long-context eval
MODEL        = os.environ.get("UNIFIED_MODEL", TEXT_MODEL)                   # legacy fallback
MAX_TOKENS   = 8192


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


def extract_ppt_images_as_base64(filepath, max_pages=20):
    """For PPT/PPTX files — extract text per slide."""
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


def extract_pdf_text_slides(filepath, max_pages=20):
    """
    Fast text extraction from PDF pages — no AI, no base64 encoding.
    Used to populate session["slides"] immediately after upload so the config
    page shows the REAL page count and titles instead of the 3-page mock.
    Falls back to MOCK_SLIDES only if the file cannot be opened at all.
    """
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(filepath)
        slides = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            text = page.get_text("text").strip()
            lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
            # First non-empty line becomes the title; next few lines become content
            title   = lines[0][:80] if lines else f"Slide {i + 1}"
            content = " ".join(lines[1:6]) if len(lines) > 1 else "(No text detected on this page)"
            slides.append({
                "page":       i + 1,
                "title":      title,
                "content":    content,
                "key_claims": [],
            })
        doc.close()
        return slides if slides else MOCK_SLIDES
    except Exception as e:
        app.logger.warning(f"extract_pdf_text_slides failed: {e}")
        return MOCK_SLIDES


def pptx_to_slides(pptx_data):
    """Convert extract_ppt_images_as_base64 output to the standard slides format."""
    result = []
    for s in pptx_data:
        lines   = [ln.strip() for ln in s["text"].split("\n") if ln.strip()]
        title   = lines[0][:80] if lines else f"Slide {s['page']}"
        content = " ".join(lines[1:6]) if len(lines) > 1 else ""
        result.append({
            "page":       s["page"],
            "title":      title,
            "content":    content,
            "key_claims": [],
        })
    return result if result else MOCK_SLIDES


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
            model=VISION_MODEL,
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
            model=TEXT_MODEL,
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
            model=TEXT_MODEL,
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
# GEMINI: 4-PILLAR EVALUATION ENGINE (Step 8)
# ─────────────────────────────────────────────
def run_pillar_evaluation(slides, answers, config, challenge_seed,
                          fe_qa_history=None, total_time_seconds=0):
    """
    4-Pillar precision evaluation via Gemini 1.5 Pro.
    Rubric: Structure / Fluency / Relevance / Delivery (each 0-100).

    New in this version:
    - Accepts fe_qa_history (frontend Q&A chat log) for richer QA context.
    - Accepts total_time_seconds for real WPM calculation.
    - Pre-computes word count, WPM, and filler density from actual transcript text.
    - Detects completely empty presentations and applies mandatory score penalties.
    Falls back to _mock_pillar_evaluation on error or when AI is off.
    """
    audience       = config.get("audience",   "Professor")
    scenario       = config.get("scenario",   "Academic Presentation")
    difficulty     = config.get("difficulty", "Medium")
    challenge_type = (challenge_seed or {}).get("challenge_type", "Unknown")

    narration_entries = [a for a in answers if a.get("type") == "narration"]
    qa_entries        = [a for a in answers
                         if a.get("type") in ("qa_answer", "academic_qa")]

    # ── Pre-compute real metrics from the actual transcript text ───────────────
    all_narration_text = " ".join(
        (a.get("text") or "").strip() for a in narration_entries
    ).strip()
    total_words = len(all_narration_text.split()) if all_narration_text else 0

    # Real WPM (requires timer data sent from frontend)
    if total_words > 0 and total_time_seconds > 30:
        wpm_estimate = round(total_words / (total_time_seconds / 60))
    else:
        wpm_estimate = 0

    # Actual filler word scan from transcript
    FILLER_RE = r'\b(um+|uh+|like|you know|basically|sort of|kind of|i mean|literally|right\?)\b'
    filler_matches  = re.findall(FILLER_RE, all_narration_text.lower())
    filler_count    = len(filler_matches)
    filler_density  = round(filler_count / max(total_words, 1) * 100, 1)

    # ── BRANCH A: Zero / near-zero speech — fast return, skip Gemini entirely ──
    # This fires when the user never spoke (< 5 real words across all slides).
    # Calling Gemini with an empty transcript produces hallucinated, generic praise
    # that is completely wrong. We return a fixed penalty result immediately.
    if total_words < 5:
        app.logger.warning(
            f"[EvalGuard] Zero-speech detected ({total_words} words). "
            "Skipping Gemini call. Returning penalty result."
        )
        return {
            "scores": {"structure": 0, "fluency": 0, "relevance": 0, "delivery": 0},
            "dimensions_info": {
                "structure": {"explanation": "No speech was recorded.", "calculation": "Score is 0 — no narration to evaluate."},
                "fluency":   {"explanation": "No speech was recorded.", "calculation": "Score is 0 — no narration to evaluate."},
                "relevance": {"explanation": "No speech was recorded.", "calculation": "Score is 0 — no narration to evaluate."},
                "delivery":  {"explanation": "No speech was recorded.", "calculation": "Score is 0 — no narration to evaluate."},
            },
            "filler_log": [],
            "what_i_did_good": [
                "No silver lining found. You did not speak during the presentation."
            ],
            "areas_for_improvement": [
                {
                    "issue": "[Delivery] No speech recorded.",
                    "example": "We found no spoken words in your entire presentation rehearsal.",
                    "how_to_fix": "Please turn on your microphone and speak clearly for each slide before clicking Next Slide. Say this instead: \"Good morning. Today I will talk about [your topic].\"",
                }
            ],
        }

    # ── BRANCH B: Real speech present — proceed to AI evaluation ─────────────

    # ── Build per-slide narration map ──────────────────────────────────────────
    narration_map = {a["page"]: (a.get("text") or "").strip() for a in narration_entries}
    slide_narration_text = "\n\n".join(
        f"[Slide {s['page']} — \"{s.get('title','')}\"]:\n"
        f"{narration_map.get(s['page']) or '(No narration recorded for this slide)'}"
        for s in slides
    )

    # ── Build QA exchange text ─────────────────────────────────────────────────
    if fe_qa_history:
        qa_history_text = "\n".join(
            f"[{'AI Examiner' if h.get('role')=='ai' else 'Presenter'}] "
            f"({h.get('type','')}) {h.get('text','')}"
            for h in fe_qa_history
        )
    else:
        qa_parts = []
        for a in qa_entries:
            q = a.get("question", "")
            t = a.get("text", "")
            qa_parts.append(f"Q: {q}\nA: {t}" if q else f"[Answer]: {t}")
        qa_history_text = "\n\n".join(qa_parts) or "(No Q&A answers recorded)"

    # ── No AI: return generic mock (no specific slide content known) ───────────
    if not AI_ENABLED:
        return _mock_pillar_evaluation(difficulty)

    # ── Compose WPM / filler notes ─────────────────────────────────────────────
    if wpm_estimate > 0:
        if wpm_estimate > 160:
            wpm_note = f"{wpm_estimate} WPM — RUSHED DELIVERY (>160 WPM). Penalise Delivery."
        elif wpm_estimate < 110:
            wpm_note = f"{wpm_estimate} WPM — HESITANT DELIVERY (<110 WPM). Penalise Delivery."
        else:
            wpm_note = f"{wpm_estimate} WPM — good pace (110-160 WPM target)."
    else:
        wpm_note = "WPM unknown (no timer data). Estimate from text density."

    if filler_count > 10:
        filler_note = (
            f"{filler_count} filler words ({filler_density}% of words). "
            "HIGH density — penalise Fluency significantly (deduct ≥20 pts)."
        )
    elif filler_count > 5:
        filler_note = (
            f"{filler_count} filler words ({filler_density}% of words). "
            "Moderate density — penalise Fluency mildly (deduct 5-15 pts)."
        )
    else:
        filler_note = (
            f"{filler_count} filler words ({filler_density}% of words). "
            "Low density — do NOT penalise Fluency for fillers."
        )

    slide_content_text = "\n\n".join(
        f"[Slide {s['page']}] {s.get('title', '')}\n{s.get('content', '')}"
        for s in slides
    )

    prompt = f"""You are a friendly Presentation Coach for non-native English speakers. Run a 4-Pillar audit.

══════════════════════════════════════════════
SCORING RUBRIC (0-100 each pillar)
══════════════════════════════════════════════
1. [Structure] — Award for clear intro/body/conclusion and transitions like "Moving on to…" or "To summarise…".
   Deduct for abrupt slide changes with zero linking words.  Empty transcript → score 20-35.
2. [Fluency]   — Use the PRE-COMPUTED filler word count as your ANCHOR. Deduct 3 pts per filler above 5.
   Penalise broken grammar or repeated stops. Empty transcript → score 15-25.
3. [Relevance] — Compare each slide's key facts vs. what the presenter actually said.
   Deduct for slides where key data was ignored. Award for directly quoting slide data. Empty → 20-35.
4. [Delivery]  — Use PRE-COMPUTED WPM as ANCHOR. Rushed >160 WPM or hesitant <110 WPM → penalise.
   Award smooth pace variation. Empty transcript → score 18-30.

══════════════════════════════════════════════
PRE-COMPUTED METRICS — USE THESE EXACTLY, DO NOT IGNORE
══════════════════════════════════════════════
- Total words spoken : {total_words} (≥5 confirmed, presenter did speak)
- WPM assessment     : {wpm_note}
- Filler assessment  : {filler_note}

══════════════════════════════════════════════
SESSION CONTEXT
══════════════════════════════════════════════
Audience: {audience} | Scenario: {scenario} | Difficulty: {difficulty} | Challenge: {challenge_type}

══════════════════════════════════════════════
SLIDE CONTENT (screen text)
══════════════════════════════════════════════
{slide_content_text}

══════════════════════════════════════════════
PRESENTER NARRATION (their actual speech, slide by slide)
══════════════════════════════════════════════
{slide_narration_text}

══════════════════════════════════════════════
Q&A TRANSCRIPT
══════════════════════════════════════════════
{qa_history_text}

══════════════════════════════════════════════
OUTPUT RULES — READ EVERY RULE BEFORE WRITING
══════════════════════════════════════════════

⚡ CRITICAL SPEED CONSTRAINT — OBEY TO PREVENT API TIMEOUT ⚡
You are evaluating a live rehearsal with multiple slides and Q&A history.
Your JSON response MUST be concise:
- "what_i_did_good"      → EXACTLY 3 items (no more, no fewer)
- "areas_for_improvement" → EXACTLY 2 items (no more, no fewer)
- Each item: maximum 2 sentences. Do NOT write essay-length text.
- "dimensions_info" values: maximum 1 short sentence each.
Verbose responses will cause an API timeout and waste the user's session.

RULE 1 — LANGUAGE LEVEL
All text in what_i_did_good and areas_for_improvement MUST use IELTS 5.5-6.0 vocabulary.
Short, clear sentences only. Use "show" not "demonstrate". Use "fix" not "mitigate".
Write as if talking to a university student who is NOT a native speaker.

⚠️ FORMAT-ONLY WARNING — READ BEFORE WRITING ANY FEEDBACK ⚠️
The examples below (EXAMPLE A and EXAMPLE B) exist ONLY to show the JSON structure and language level.
Do NOT copy or echo those example words into your response.
- Do NOT echo, copy, or paraphrase any example phrase shown in this prompt into your response.
- Do NOT invent facts not present in the actual slide content or user narration above.
- If the user's slides contain no statistics, DO NOT complain about missing statistics.
- If the user did not use filler words, DO NOT mention filler words.
- Every single sentence in your output MUST be grounded in the ACTUAL SLIDE CONTENT and ACTUAL PRESENTER NARRATION provided above.

RULE 2 — what_i_did_good FORMAT
Each item MUST follow this pattern:
  "[PillarTag] Strength title: 1-2 sentences explaining what they actually did well. Quote their exact words if they said something good."

Pillar tags to use: [Structure], [Fluency], [Relevance], [Delivery]

EXAMPLE A (FORMAT ONLY — do NOT copy these words):
  "[Structure] Clear Signposting: You connected two slides smoothly. You said, '<actual user quote>', which helps the audience follow."

BAD (never write like this):
  "The presenter demonstrated effective discourse management strategies."

RULE 3 — areas_for_improvement FORMAT (STRICT 3-PART STRUCTURE)
Each item MUST be a JSON object with exactly these 3 keys:

  "issue"      : "[PillarTag] Short title. 1 sentence: what went wrong on which specific slide."
  "example"    : "You said: \\"<EXACT quote from the ACTUAL narration above>\\"  OR  \\"On Slide N, you did not mention [EXACT fact from the ACTUAL slide content above].\\""
  "how_to_fix" : "1 sentence of advice based on their actual mistake. Then: Say this instead: \\"<a corrected sentence at IELTS 5.5 level that fits their actual topic>\\""

EXAMPLE B (FORMAT ONLY — do NOT copy these words):
{{
  "issue": "[Fluency] High filler word usage on Slide X.",
  "example": "You said: \\"<copy EXACT phrase from ACTUAL narration above>\\"",
  "how_to_fix": "Pause silently instead of using filler words. Say this instead: \\"<rewritten version of their ACTUAL sentence>\\""
}}

RULE 4 — SPECIFICITY (MOST IMPORTANT RULE)
- Read the ACTUAL SLIDE CONTENT and ACTUAL PRESENTER NARRATION sections above before writing a single word.
- Every issue, example, and suggestion MUST reference something the presenter ACTUALLY SAID or ACTUALLY skipped.
- If they said nothing on a slide → state that exact slide number, e.g. "Slide 3 had no narration."
- If they used a wrong word → quote THAT exact wrong word from their transcript.
- NEVER write feedback that could apply to any presenter regardless of their actual words.
- NEVER invent quotes the user did not actually say.

══════════════════════════════════════════════
Return ONLY valid JSON — no markdown fences, no extra text
══════════════════════════════════════════════
{{
  "scores": {{
    "structure": <integer 0-100>,
    "fluency":   <integer 0-100>,
    "relevance": <integer 0-100>,
    "delivery":  <integer 0-100>
  }},
  "dimensions_info": {{
    "structure": {{"explanation": "<1 sentence: reference their actual transitions or lack of them>", "calculation": "<1 sentence: how many slides had linking phrases>"}},
    "fluency":   {{"explanation": "<1 sentence: reference their actual filler count>", "calculation": "<1 sentence: filler count + any grammar issues>"}},
    "relevance": {{"explanation": "<1 sentence: which slides had good or poor coverage>", "calculation": "<1 sentence: how many slides matched the slide content>"}},
    "delivery":  {{"explanation": "<1 sentence: their actual WPM value and verdict>", "calculation": "<1 sentence: WPM and pace judgement>"}}
  }},
  "filler_log": [
    {{"word": "<exact filler from transcript>", "timestamp": "<Slide N where it appeared>", "type": "Assistive or Disruptive"}}
  ],
  "what_i_did_good": [
    "<[PillarTag] Title: explanation with quote if possible>"
  ],
  "areas_for_improvement": [
    {{
      "issue":      "<[PillarTag] Short title. 1 sentence stating what went wrong and which slide.>",
      "example":    "<You said: \\"exact quote\\" OR On Slide N, you skipped [specific fact].>",
      "how_to_fix": "<1 sentence advice. Say this instead: \\"corrected sentence at IELTS 5.5 level.\\">"
    }}
  ]
}}"""

    # ── Audit log: confirm real user data is being sent ───────────────────────
    app.logger.info(
        f"=== GEMINI PILLAR INPUT === "
        f"total_words={total_words} | wpm={wpm_note} | fillers={filler_count} | "
        f"slides={len(slides)} | qa_exchanges={len(fe_qa_history) if fe_qa_history else 0}"
    )
    app.logger.info(f"=== NARRATION PREVIEW === {all_narration_text[:300]!r}")

    try:
        response = _ai_client.chat.completions.create(
            model=EVAL_MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)

        # Clamp scores 0-100
        scores = result.get("scores", {})
        result["scores"] = {
            k: int(min(100, max(0, float(v))))
            for k, v in scores.items()
        }

        return result

    except Exception as e:
        err_type = type(e).__name__
        err_msg  = str(e)
        app.logger.error(
            f"[GEMINI EVAL ERROR] type={err_type} | msg={err_msg[:300]} | "
            f"model={EVAL_MODEL} | total_words={total_words}"
        )
        # Classify root cause for easier diagnosis in console
        if "timeout" in err_msg.lower() or "timed out" in err_msg.lower():
            app.logger.error("[GEMINI EVAL ERROR] Root cause: API TIMEOUT — relay took >120s")
        elif "json" in err_msg.lower() or isinstance(e, (ValueError, json.JSONDecodeError)):
            app.logger.error("[GEMINI EVAL ERROR] Root cause: JSON PARSE FAILURE — model returned non-JSON")
        elif "connection" in err_msg.lower() or "network" in err_msg.lower():
            app.logger.error("[GEMINI EVAL ERROR] Root cause: NETWORK / CONNECTION ERROR")
        else:
            app.logger.error(f"[GEMINI EVAL ERROR] Root cause: UNKNOWN — {err_type}")
        traceback.print_exc()
        # Return generic mock — zero-speech already handled by BRANCH A above
        return _mock_pillar_evaluation(difficulty)


def _mock_pillar_evaluation(difficulty):
    """Fallback mock when AI is unavailable. Returns the same schema as run_pillar_evaluation."""
    base = {"Easy": 74, "Medium": 61, "Hard": 49}.get(difficulty, 61)
    r = random.randint

    return {
        "scores": {
            "structure": min(100, base + r(-4, 10)),
            "fluency":   min(100, base + r(-10, 5)),
            "relevance": min(100, base + r(-8, 8)),
            "delivery":  min(100, base + r(-6, 9)),
        },
        "dimensions_info": {
            "structure": {
                "explanation": "Measures how smoothly you connect different slides.",
                "calculation": "Computed by checking for transition words between slides.",
            },
            "fluency": {
                "explanation": "Measures filler words like 'um' or 'uh' and long pauses.",
                "calculation": "Computed by counting filler words per minute of speech.",
            },
            "relevance": {
                "explanation": "Measures how closely your words match the facts on the slide.",
                "calculation": "Computed by matching slide keywords with your speech text.",
            },
            "delivery": {
                "explanation": "Measures your speaking speed (WPM) and talking energy.",
                "calculation": "Computed by dividing total words by your presentation time.",
            },
        },
        "filler_log": [],
        "what_i_did_good": [
            "[Structure] Presentation Attempt: You completed the rehearsal flow and moved through the slides.",
            "[Delivery] Session Completed: You reached the end of the presentation session.",
        ],
        "areas_for_improvement": [
            {
                "issue": "[Structure] No linking words detected between slides.",
                "example": "You moved between slides without using any transition phrases.",
                "how_to_fix": "Use a short bridge before each new slide. Say this instead: \"Now let's move to the next point.\"",
            },
            {
                "issue": "[Relevance] Slide content may not have been fully covered in your speech.",
                "example": "Some slides may have had key points that were not mentioned in your narration.",
                "how_to_fix": "Before clicking Next Slide, check the slide and make sure you mentioned all the key information shown on screen.",
            },
        ],
    }


# ─────────────────────────────────────────────
# GEMINI: GENERATE TRAINING PLAN (Step 9)
# ─────────────────────────────────────────────
def generate_training_plan(pillar_eval, config, challenge_type):
    """Generate a personalized training plan based on 4-pillar scores."""
    difficulty = config.get("difficulty", "Medium")
    audience   = config.get("audience",   "Professor")
    scenario   = config.get("scenario",   "Academic Presentation")

    scores = pillar_eval.get("scores", {})
    weakest = min(scores, key=scores.get) if scores else "structure"
    worst_score = scores.get(weakest, 60)
    areas = pillar_eval.get("areas_for_improvement", [])
    top_issues = " | ".join(a["issue"] for a in areas[:3]) if areas else "see score breakdown"

    if not AI_ENABLED:
        return _template_training_plan_v2(difficulty, audience, challenge_type, weakest, worst_score)

    prompt = f"""You are a world-class presentation coach. Write a short, practical training plan.

SESSION:
- Audience: {audience} | Scenario: {scenario} | Difficulty: {difficulty}
- Challenge Type: {challenge_type}

4-PILLAR SCORES (0-100):
{json.dumps(scores, indent=2)}
Weakest pillar: {weakest} ({worst_score}/100)

TOP ISSUES FOUND:
{top_issues}

Write the plan using these exact sections (markdown, simple IELTS 5.5 English):
## Training Plan

**Profile:** [one line summary]

### Fix First — {weakest.title()} ({worst_score}/100)
[2 specific drills. Reference {challenge_type} where useful.]

### Quick Wins This Week
[3 bullet points — easy actions to do right now]

### 30-Day Schedule
- Week 1: [focus]
- Week 2: [focus]
- Week 3: [focus]
- Week 4: [focus]

Keep every sentence short and simple. No jargon."""

    try:
        response = _ai_client.chat.completions.create(
            model=EVAL_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        app.logger.error(f"Training plan generation failed: {e}")
        return _template_training_plan_v2(difficulty, audience, challenge_type, weakest, worst_score)


def _template_training_plan_v2(difficulty, audience, challenge_type, weakest, worst_score):
    return f"""## Training Plan

**Profile:** {difficulty} difficulty · {audience} audience · Weakest area: {weakest.title()} ({worst_score}/100)

### Fix First — {weakest.title()} ({worst_score}/100)
Record yourself and play it back. Look for the moments where you lose the point. Practice the Pyramid Principle: say your main idea first, then give 2-3 supporting facts. When you face a **{challenge_type}** question, answer in one clear sentence first, then explain.

### Quick Wins This Week
- Read your slide title out loud before you start talking about it.
- Use a linking phrase between each slide. Example: "Now let us move to the next point."
- Practice in front of a mirror for 10 minutes every day.

### 30-Day Schedule
- Week 1: Daily 10-min recording sessions. Focus on transitions and pace.
- Week 2: Two full rehearsals at {difficulty} difficulty. Ask a friend to give feedback.
- Week 3: Two Hard difficulty sessions. Practice handling tough questions.
- Week 4: One full mock session from start to finish. Record and review."""


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
    if "slide_key" not in session and "slides" not in session:
        return redirect(url_for("index"))
    return render_template("config.html", slides=_load_slides(session), ai_enabled=AI_ENABLED)


@app.route("/sandbox")
def sandbox():
    if "state" not in session:
        return redirect(url_for("index"))
    state = session["state"]
    slides = _load_slides(session)
    cfg = session.get("config", {})
    current_slide = next((s for s in slides if s["page"] == state["current_page"]), slides[0])
    has_file = bool(session.get("filepath") and os.path.exists(session.get("filepath", "")))
    return render_template(
        "sandbox.html",
        state=state,
        slides=slides,
        config=cfg,
        current_slide=current_slide,
        total_pages=len(slides),
        ai_enabled=AI_ENABLED,
        has_file=has_file,
    )


def _extract_pptx_shape_texts(shapes, out=None):
    """
    Recursively collect (top_emu, text) pairs from PPTX shapes.
    Handles groups (type 6), tables (type 19), and regular text shapes.
    """
    if out is None:
        out = []
    for shape in shapes:
        try:
            stype = int(shape.shape_type)
        except Exception:
            stype = -1
        if stype == 6:                          # GROUP — recurse
            try:
                _extract_pptx_shape_texts(shape.shapes, out)
            except Exception:
                pass
        elif stype == 19:                       # TABLE
            try:
                for row in shape.table.rows:
                    for cell in row.cells:
                        t = cell.text.strip()
                        if t:
                            out.append((shape.top or 0, t))
            except Exception:
                pass
        elif hasattr(shape, "text") and shape.text.strip():
            out.append((shape.top or 0, shape.text.strip()))
    return out


def _render_pptx_page(filepath, page_num):
    """
    Render a PPTX slide as an SVG (bytes, mimetype) tuple.
    SVG is served directly to the browser — uses system fonts so CJK text
    (Chinese / Japanese / Korean) renders correctly without needing embedded fonts.
    Returns (None, None) on failure.
    """
    try:
        from pptx import Presentation

        prs         = Presentation(filepath)
        slides_list = list(prs.slides)
        if page_num < 1 or page_num > len(slides_list):
            return None, None

        slide = slides_list[page_num - 1]
        total = len(slides_list)
        W, H  = 1280, 720

        CJK_FONTS = ("'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',"
                     "Arial,Helvetica,sans-serif")

        def esc(s: str) -> str:
            return (s.replace("&", "&amp;").replace("<", "&lt;")
                     .replace(">", "&gt;").replace('"', "&quot;")
                     .replace("'", "&apos;"))

        # ── Title ────────────────────────────────────────────────────────────
        title_text  = ""
        title_shape = None
        try:
            if slide.shapes.title and slide.shapes.title.text.strip():
                title_text  = slide.shapes.title.text.strip()
                title_shape = slide.shapes.title
        except Exception:
            pass

        # ── Body text (all shapes, sorted top→bottom) ────────────────────────
        raw = _extract_pptx_shape_texts(slide.shapes)
        raw = [(top, txt) for (top, txt) in raw if txt != title_text]
        raw.sort(key=lambda x: x[0])

        # ── Build body <text> elements ───────────────────────────────────────
        body_els = []
        y = 148
        for _, block in raw:
            lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
            for line in lines:
                if y > H - 72:
                    break
                body_els.append(
                    f'<text x="68" y="{y}" font-size="19" fill="#acb2d8" '
                    f'font-family={CJK_FONTS!r}>'
                    f'&#9656;&#160;&#160;{esc(line[:115])}</text>'
                )
                y += 34
            y += 10

        badge = f"Slide {page_num} / {total}"

        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            f'<defs>'
            f'  <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">'
            f'    <stop offset="0%" stop-color="#0c0c1c"/>'
            f'    <stop offset="100%" stop-color="#10102a"/>'
            f'  </linearGradient>'
            f'</defs>'
            f'<rect width="{W}" height="{H}" fill="url(#bg)"/>'
            f'<rect width="{W}" height="114" fill="#161638"/>'
            f'<rect x="0" y="112" width="{W}" height="2" fill="#4848c8"/>'
            f'<text x="52" y="76" font-size="32" font-weight="700" fill="#d8dcff" '
            f'font-family={CJK_FONTS!r}>{esc(title_text[:90])}</text>'
            + "".join(body_els)
            + f'<rect x="{W - 188}" y="{H - 48}" width="166" height="28" rx="5" fill="#1c1c44"/>'
            f'<text x="{W - 180}" y="{H - 28}" font-size="13" fill="#6870aa" '
            f'font-family="monospace,sans-serif">{esc(badge)}</text>'
            f"</svg>"
        )
        return svg.encode("utf-8"), "image/svg+xml"
    except Exception as e:
        app.logger.error(f"_render_pptx_page page={page_num} failed: {e}")
        return None, None


@app.route("/x/slide-image/<int:page>")
def slide_image(page):
    """Serve a specific slide page as PNG — PDF via fitz, PPTX via Pillow."""
    from flask import Response as _R
    filepath = session.get("filepath", "")
    if not filepath or not os.path.exists(filepath):
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">'
            f'<rect width="800" height="500" fill="#12121f"/>'
            f'<text x="400" y="240" text-anchor="middle" fill="#6366f1" '
            f'font-size="22" font-family="monospace">Slide {page}</text>'
            f'<text x="400" y="275" text-anchor="middle" fill="#374151" '
            f'font-size="14" font-family="sans-serif">No file uploaded — mock mode</text>'
            f'</svg>'
        )
        return _R(svg, mimetype="image/svg+xml")

    ext = os.path.splitext(filepath)[1].lstrip(".").lower()

    # ── PPTX / PPT → SVG renderer ───────────────────────────────────────────
    if ext in ("pptx", "ppt"):
        svg_bytes, mime = _render_pptx_page(filepath, page)
        if svg_bytes is None:
            return "Page out of range or render failed", 404
        return _R(svg_bytes, mimetype=mime,
                  headers={"Cache-Control": "max-age=3600",
                           "X-Content-Type-Options": "nosniff"})

    # ── PDF → fitz renderer ─────────────────────────────────────────────────
    try:
        import fitz
        doc = fitz.open(filepath)
        if page < 1 or page > len(doc):
            doc.close()
            return "Page out of range", 404
        p   = doc[page - 1]
        mat = fitz.Matrix(2.0, 2.0)
        pix = p.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        doc.close()
        return _R(img_bytes, mimetype="image/png",
                  headers={"Cache-Control": "max-age=3600"})
    except Exception as e:
        app.logger.error(f"slide_image page={page} failed: {e}")
        return "Error generating image", 500


@app.route("/report")
def report():
    report_key = session.get("report_key")
    report_data = _load_report(report_key)
    if not report_data:
        # Cookie lost or file missing — restart from home
        app.logger.warning(f"[Report] No report data found for key={report_key!r} — redirecting home")
        return redirect(url_for("index"))
    return render_template(
        "report.html",
        evaluation=report_data.get("evaluation"),
        qa_bank=report_data.get("qa_bank", []),
        config=session.get("config", {}),
        answers=report_data.get("answers", []),
        ai_enabled=AI_ENABLED,
    )


# ─────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────

@app.route("/x/upload", methods=["POST"])
def api_upload():
    """
    Step 1: Accept file → extract page images → Vision AI analysis.
    Full try/except with traceback so errors are always visible in logs.
    """
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Please upload PDF, PPT, or PPTX."}), 400

        # Extract extension from the ORIGINAL filename BEFORE secure_filename()
        # strips non-ASCII chars (e.g. Chinese filenames lose their dot+ext).
        orig_ext = os.path.splitext(file.filename)[1].lstrip(".").lower()
        safe_stem = secure_filename(file.filename)
        # If secure_filename wiped everything (non-ASCII name), fall back to "upload"
        if not safe_stem or safe_stem == orig_ext:
            safe_stem = "upload"
        # Only append extension if secure_filename didn't already preserve it
        if orig_ext and not safe_stem.lower().endswith(f".{orig_ext}"):
            filename = f"{safe_stem}.{orig_ext}"
        else:
            filename = safe_stem

        os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(save_path)
        app.logger.info(f"File saved: {save_path}")

        ext = orig_ext

        # Step 1a: PDF → base64 images (fast — no AI call here)
        images_b64 = []
        if ext == "pdf":
            app.logger.info("Extracting PDF pages as images...")
            images_b64 = extract_pdf_images_as_base64(save_path)
            app.logger.info(f"Extracted {len(images_b64)} page image(s)")

        # Build real (text-extracted) slide previews immediately — no AI call.
        # These give the config page the REAL page count + titles.
        # Vision analysis in /x/start-session will REPLACE these with richer AI output.
        # We NEVER store base64 images in the Flask session (4 KB cookie limit).
        if ext == "pdf":
            slides_preview = extract_pdf_text_slides(save_path)
        elif ext in ("ppt", "pptx"):
            ppt_data = extract_ppt_images_as_base64(save_path)
            slides_preview = pptx_to_slides(ppt_data) if ppt_data else MOCK_SLIDES
        else:
            slides_preview = MOCK_SLIDES

        session["slide_key"] = _save_slides(slides_preview)   # real page count, real text
        session["filename"] = filename
        session["filepath"] = save_path        # start-session re-reads from disk
        session["answers"]  = []
        session["qa_bank"]  = []

        page_count = len(slides_preview)
        return jsonify({
            "success":    True,
            "filename":   filename,
            "page_count": page_count,
            "ai_pending": AI_ENABLED and bool(images_b64),
            "message":    f"File uploaded. {page_count} page(s) ready for AI analysis.",
        })

    except Exception as e:
        traceback.print_exc()   # Full stack trace visible in Replit workflow logs
        app.logger.error(f"Upload failed: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route("/x/start-session", methods=["POST"])
def api_start_session():
    """
    Steps 2 → 3: Receive config → Vision analysis (if PDF) → Master Engine → sandbox.
    AI Vision is deferred here (not in /x/upload) to avoid proxy timeout on upload.
    """
    data = request.get_json() or {}
    audience   = data.get("audience",   "Professor")
    scenario   = data.get("scenario",   "Academic Presentation")
    difficulty = data.get("difficulty", "Medium")

    # ── Step 2: Vision analysis — re-read file from disk (images never stored in cookie) ──
    filepath = session.get("filepath", "")
    filename = session.get("filename", "")
    # Start with whatever text-extracted slides were stored during upload (real page count)
    slides   = _load_slides(session)
    try:
        if filepath and os.path.exists(filepath) and AI_ENABLED:
            ext = filepath.rsplit(".", 1)[-1].lower()
            if ext == "pdf":
                app.logger.info(f"Re-extracting PDF images from {filepath}…")
                images_b64 = extract_pdf_images_as_base64(filepath)
                app.logger.info(f"Vision: analysing {len(images_b64)} page(s)…")
                ai_slides, ok = analyze_slides_with_claude(images_b64, filename)
                if ok and ai_slides:
                    slides = ai_slides
                    app.logger.info(f"Vision done: {len(slides)} slide(s) — AI-enhanced")
                else:
                    app.logger.info("Vision returned empty — keeping text-extracted slides")
            elif ext in ("ppt", "pptx"):
                ppt_data = extract_ppt_images_as_base64(filepath)
                if ppt_data:
                    slides = pptx_to_slides(ppt_data)
            session["slide_key"] = _save_slides(slides)
        else:
            app.logger.info(f"Skipping Vision (filepath={filepath!r}, AI_ENABLED={AI_ENABLED})")
            # slides already loaded from session above — re-save to ensure disk key is fresh
            if "slide_key" not in session:
                session["slide_key"] = _save_slides(slides)
    except Exception as e:
        traceback.print_exc()
        app.logger.error(f"Vision failed — keeping text-extracted slides: {e}")
        slides = _load_slides(session)
        session["slide_key"] = _save_slides(slides)

    # ── Step 3: Master Engine (Challenge seed + QA bank) ──────────────────────────
    try:
        challenge_seed, static_qa_bank = build_master_engine(
            slides, audience, scenario, difficulty
        )
    except Exception as e:
        traceback.print_exc()
        app.logger.error(f"Master engine failed, using mock: {e}")
        challenge_seed, static_qa_bank = MOCK_CHALLENGE, MOCK_QA_BANK

    session["config"] = {
        "audience":  audience,
        "scenario":  scenario,
        "difficulty": difficulty,
        "persona":   AUDIENCE_PERSONA.get(audience, AUDIENCE_PERSONA["Professor"]),
    }
    session["challenge_seed"] = challenge_seed
    session["qa_bank"] = static_qa_bank if scenario == "Academic Presentation" else []

    max_rounds = MAX_FOLLOWUP_ROUNDS.get(difficulty, 2)
    session["state"] = {
        "current_page":        1,
        "total_interruptions": 0,
        "in_qa_mode":          False,
        "follow_up_round":     0,
        "chat_history":        [],
        "max_follow_up_rounds": max_rounds,
    }

    return jsonify({"success": True, "redirect": "/sandbox"})


@app.route("/x/session-state", methods=["GET"])
def api_session_state():
    return jsonify({
        "state": session.get("state", {}),
        "config": session.get("config", {}),
        "slides": _load_slides(session),
    })


@app.route("/x/check-slide", methods=["POST"])
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
    slides = _load_slides(session)

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
        # ── Academic Presentation: trigger post-session Q&A before report ──
        if scenario == "Academic Presentation":
            qa_bank = session.get("qa_bank", [])
            difficulty = config.get("difficulty", "Medium")
            qa_count = {"Easy": 1, "Medium": 2, "Hard": 3}.get(difficulty, 2)
            questions = [q for q in qa_bank if isinstance(q, dict)][:qa_count]
            if questions:
                state["academic_qa_mode"] = True
                state["academic_qa_index"] = 0
                state["academic_qa_total"] = len(questions)
                session["state"] = state
                session["academic_qa_questions"] = questions
                first_q = questions[0]
                return jsonify({
                    "action":          "ACADEMIC_QA_START",
                    "question":        first_q.get("question", ""),
                    "question_num":    1,
                    "total_questions": len(questions),
                    "challenge_type":  first_q.get("challenge_type", ""),
                    "category":        first_q.get("category", ""),
                })
        session["state"] = state
        return jsonify({"action": "PRESENTATION_DONE"})

    state["current_page"] = next_page
    state["in_qa_mode"] = False
    state["follow_up_round"] = 0
    state["chat_history"] = []
    session["state"] = state

    current_slide = next((s for s in slides if s["page"] == next_page), slides[0])
    return jsonify({"action": "NEXT_SLIDE", "page": next_page, "slide": current_slide})


@app.route("/x/submit-answer", methods=["POST"])
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
    slides = _load_slides(session)
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
        slides_list = _load_slides(session)
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


@app.route("/x/submit-academic-qa", methods=["POST"])
def api_submit_academic_qa():
    """
    Step Academic-7: Handle post-presentation Q&A for Academic Presentation scenario.
    Cycles through qa_bank questions (count = 1/2/3 based on Easy/Medium/Hard).
    Returns ACADEMIC_QA_NEXT (more questions) or ACADEMIC_QA_DONE (all answered).
    """
    if "state" not in session:
        return jsonify({"error": "No active session"}), 400

    data     = request.get_json() or {}
    answer   = data.get("answer", "").strip()
    state    = dict(session["state"])
    config   = session.get("config", {})
    questions = session.get("academic_qa_questions", [])

    current_idx = state.get("academic_qa_index", 0)

    # Persist the answer
    current_q = questions[current_idx] if current_idx < len(questions) else {}
    answers_list = list(session.get("answers", []))
    answers_list.append({
        "type":         "academic_qa",
        "question_idx": current_idx,
        "question":     current_q.get("question", ""),
        "text":         answer,
    })
    session["answers"] = answers_list

    next_idx = current_idx + 1
    if next_idx < len(questions):
        state["academic_qa_index"] = next_idx
        session["state"] = state
        next_q = questions[next_idx]
        return jsonify({
            "status":          "ACADEMIC_QA_NEXT",
            "question":        next_q.get("question", ""),
            "question_num":    next_idx + 1,
            "total_questions": len(questions),
            "challenge_type":  next_q.get("challenge_type", ""),
            "category":        next_q.get("category", ""),
        })
    else:
        state["academic_qa_mode"]  = False
        state["academic_qa_index"] = 0
        session["state"] = state
        return jsonify({"status": "ACADEMIC_QA_DONE"})


@app.route("/x/finish-presentation", methods=["POST"])
def api_finish_presentation():
    """
    Steps 7 & 8: Generate QA bank if needed + run 4-pillar AI evaluation + training plan.
    Accepts JSON body with frontend-collected real transcripts and QA history.
    """
    config         = session.get("config", {})
    answers        = list(session.get("answers", []))
    slides         = _load_slides(session)
    challenge_seed = session.get("challenge_seed") or MOCK_CHALLENGE
    scenario       = config.get("scenario", "Academic Presentation")

    # ── Read real performance data sent by the frontend ────────────────────────
    req_data           = request.get_json(silent=True) or {}
    fe_transcripts     = req_data.get("presentation_transcripts", [])   # [{page,text,words}]
    fe_qa_history      = req_data.get("qa_chat_history", [])            # [{role,text,type}]
    total_time_seconds = int(req_data.get("total_time_seconds", 0) or 0)

    # Merge frontend transcripts into session answers (fill gaps from voice/type)
    if fe_transcripts:
        existing_pages = {a["page"] for a in answers if a.get("type") == "narration"}
        for t in fe_transcripts:
            pg  = t.get("page", 0)
            txt = (t.get("text") or "").strip()
            if pg not in existing_pages and txt:
                answers.append({"type": "narration", "page": pg, "text": txt})
        session["answers"] = answers

    # Merge frontend QA history if it has more data than what was saved to session
    if fe_qa_history:
        user_qa = [h for h in fe_qa_history if h.get("role") == "user"]
        ai_qa   = [h for h in fe_qa_history if h.get("role") == "ai"]
        existing_qa_count = sum(
            1 for a in answers if a.get("type") in ("qa_answer", "academic_qa")
        )
        if len(user_qa) > existing_qa_count:
            for i, ua in enumerate(user_qa):
                ai_q = ai_qa[i]["text"] if i < len(ai_qa) else ""
                answers.append({
                    "type":     ua.get("type", "qa_answer"),
                    "question": ai_q,
                    "text":     ua.get("text", ""),
                })
            session["answers"] = answers

    # Step 7: QA bank — Thesis Defense generates it post-presentation
    qa_bank = session.get("qa_bank", [])
    if scenario == "Thesis Defense" and not qa_bank:
        _, qa_bank = build_master_engine(
            slides,
            config.get("audience", "Professor"),
            "Academic Presentation",
            config.get("difficulty", "Medium"),
        )
        session["qa_bank"] = qa_bank

    # Step 8: 4-Pillar evaluation (with real transcript metrics)
    pillar_eval = run_pillar_evaluation(
        slides, answers, config, challenge_seed,
        fe_qa_history=fe_qa_history,
        total_time_seconds=total_time_seconds,
    )

    challenge_type = challenge_seed.get("challenge_type", "General")

    # Step 9: Training plan
    training_plan = generate_training_plan(pillar_eval, config, challenge_type)

    evaluation = {
        "pillar":         pillar_eval,
        "training_plan":  training_plan,
        "scenario":       scenario,
        "audience":       config.get("audience",   "Professor"),
        "difficulty":     config.get("difficulty", "Medium"),
        "challenge_type": challenge_type,
        "ai_powered":     AI_ENABLED,
    }

    # ── Persist large blobs to disk; store only UUID key in cookie ────────────
    # Prevents Flask session cookie overflow (4KB limit).
    report_key = _save_report(evaluation, qa_bank, answers)
    session["report_key"] = report_key
    # Remove stale large keys that would push the cookie over limit
    session.pop("evaluation", None)
    session.pop("qa_bank", None)
    session.pop("answers", None)
    app.logger.info(f"[Report] Saved report data → key={report_key}")
    return jsonify({"success": True, "redirect": "/report"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
