<div align="right">

**English** | [简体中文](README.zh-CN.md)

</div>

# PerspeakAI — AI Presentation Coach

Practice your presentation **before** you step on stage. PerspeakAI is an AI-powered presentation simulator for non-native English speakers: upload your slides, pick who is sitting in the audience, present out loud — and get interrupted, questioned, and scored the way it happens in real life.

## Features

- **Real slide ingestion** — upload PDF / PPT / PPTX; pages are parsed locally (PyMuPDF / python-pptx), and with AI enabled, PDF pages are additionally analyzed by a vision model for titles, summaries, and key claims.
- **Configurable simulation** — choose your audience (**Professor** / **Classmates** / **VC**), scenario (**Class Presentation** / **Thesis Defense** / **MBA Case Pitch**), and difficulty (**Easy** / **Medium** / **Hard**).
- **Live sandbox** — slide viewer, session timer, and voice narration captured with the browser's built-in Web Speech API (no API key required).
- **Interrupt challenges** — in MBA Case Pitch mode the AI examiner cuts in mid-presentation with a targeted challenge and up to 2 rounds of dynamic follow-up questions.
- **Post-presentation Q&A** — Class Presentation uses a dual-track question bank (one free AI question + one anchored question); Thesis Defense draws 3 / 5 / 8 questions (by difficulty) from a defense question bank, each customized to your actual slides.
- **Pronunciation diagnosis** *(optional)* — per-slide audio is scored phoneme-by-phoneme via the SpeechAce API, with TTS pronunciation demos via DashScope.
- **Multi-dimensional evaluation** — three evaluation passes run in parallel (presentation quality pillars, communication quality, per-slide content quality), then merge into a report with radar/bar charts (Chart.js) and a 4-week training plan.
- **Mock mode** — everything above degrades gracefully: with **zero** API keys configured, the full 9-step flow still runs end-to-end on built-in mock data.

## Quick start

Requires Python 3.11+.

```bash
pip install -r artifacts/ai-presentation/requirements.txt
python artifacts/ai-presentation/app.py
# open http://localhost:8000
```

That's it — with no environment variables you get mock mode. To enable real AI, set the variables below before starting.

## Configuration

All AI calls go through a single **OpenAI-compatible endpoint** (works with OpenAI itself or any relay/proxy), with per-step model routing.

| Variable | Required | Purpose |
|---|---|---|
| `UNIFIED_API_KEY` | for real AI | API key for the OpenAI-compatible endpoint |
| `UNIFIED_BASE_URL` | for real AI | Base URL, e.g. `https://api.openai.com/v1` |
| `VISION_MODEL` | optional | Slide vision analysis (default: `claude-sonnet-5`) |
| `TEXT_MODEL` | optional | Question generation / reasoning (default: `gpt-4o`) |
| `EVAL_MODEL` | optional | Long-context evaluation (default: `gemini-2.5-flash`) |
| `SESSION_SECRET` | recommended | Flask session signing secret |
| `SPEECHACE_API_KEY` | optional | Pronunciation scoring ([SpeechAce](https://www.speechace.com/)) |
| `SPEECHACE_REGION` | optional | `singapore` (default) or `us` |
| `QWEN_API_KEY` | optional | DashScope TTS pronunciation demos |

## How a session flows

1. **Upload** your deck → pages and titles are extracted immediately.
2. **Configure** audience / scenario / difficulty.
3. **Present** in the sandbox: narrate each slide by voice or keyboard.
4. Depending on the scenario, the examiner **interrupts** you mid-flight or grills you in a **post-presentation Q&A**.
5. **Finish** → three evaluation engines run in parallel.
6. **Report**: scores across all dimensions, per-question feedback, pronunciation diagnosis, and a personalized training plan.

## Project layout

```
artifacts/ai-presentation/   ← the Flask application
├── app.py                   # routes, state machine, evaluation engines
├── audio_engine.py          # SpeechAce scoring + DashScope TTS
├── config/                  # thesis-defense question bank
└── templates/               # Jinja2 pages (Tailwind CSS + vanilla JS)
```

The rest of the repository (`lib/`, `scripts/`, other `artifacts/`) is workspace scaffolding from the original development environment and is not needed to run the app.

## Tech stack

Flask 3 · Jinja2 + Tailwind CSS (CDN) + vanilla JS · Chart.js · PyMuPDF · python-pptx · Web Speech API. No database — session state plus JSON files on disk.
