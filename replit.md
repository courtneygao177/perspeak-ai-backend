# PresentAI — AI Presentation Coach

AI-powered presentation simulation platform for non-native English speakers, featuring multi-round Q&A challenges, dual evaluation engine, and personalized training plans.

## Run & Operate

- **Start app:** `python artifacts/ai-presentation/app.py` (port 8000)
- **Workflow:** "Start application" in Replit — runs the Flask server

## Stack

- **Backend:** Python 3.11 + Flask 3 (server-side sessions via cookies)
- **Frontend:** Jinja2 HTML templates + Tailwind CSS CDN + vanilla JS
- **Charts:** Chart.js 4 (radar + bar charts in the report)
- **Speech:** Web Speech API (browser-native, no key required)

## Where things live

- `artifacts/ai-presentation/app.py` — Flask app: all routes + state machine + mock data + evaluation engine
- `artifacts/ai-presentation/templates/` — Jinja2 HTML pages (base, index, config, sandbox, report)
- `artifacts/ai-presentation/static/` — Static assets
- `artifacts/ai-presentation/uploads/` — Uploaded files (gitignored)

## 9-Step Demo Flow

1. **Upload** (`/`) — Drag & drop PPT/PDF upload with Tailwind dark UI
2. **Logic Tree** — Backend builds mock slide JSON + seeds challenge at slide 2
3. **Config** (`/config`) — 3-card selection: Audience / Scenario / Difficulty
4. **Sandbox** (`/sandbox`) — PPT display, waveform, narration input, session log
5. **State Machine** (`POST /api/check-slide`) — Interrupt logic: Thesis Defense / MBA Case Pitch trigger at page 2
6. **Follow-up** (`POST /api/submit-answer`) — Up to 2 rounds of dynamic Q&A; tracks `follow_up_round` and `chat_history`
7. **Q&A Bank** — Auto-generated for Academic / Thesis (skipped for MBA Case Pitch)
8. **Dual Eval** (`POST /api/finish-presentation`) — PQ (6 dims) + CQ (5 dims) scoring engine
9. **Report** (`/report`) — Radar charts + bar chart + score bars + training plan

## Session State Machine (Flask session cookie)

```
state = {
  current_page, total_interruptions, in_qa_mode,
  follow_up_round, chat_history
}
```

## Architecture decisions

- Server-side session state stored in Flask encrypted cookie — no DB needed for MVP
- All AI responses are Mocked — swap `MOCK_SLIDES`, `CHALLENGE_SEED`, `FOLLOW_UP_POOL` with real LLM calls
- Web Speech API used for voice input (browser-native, no API key required)
- Chart.js + Tailwind loaded from CDN — no build step needed
- Jinja2 templates + vanilla JS keeps stack minimal while allowing full server-side control flow

## User preferences

- Language: Python (Flask) + HTML/JS + Tailwind CSS (dark mode)
- No React, no Node.js frontend
- All 9 demo steps must be fully wired end-to-end

## Gotchas

- Always run from workspace root: `python artifacts/ai-presentation/app.py`
- `SESSION_SECRET` env var controls Flask session signing
- Flask debug mode is on by default — disable for production
- Upload folder (`uploads/`) must exist before starting

## Product

Non-native English speakers (university students, international students) practice presentation skills against an AI examiner that simulates professors, classmates, or VCs with configurable aggression levels and mid-session interruption challenges.
