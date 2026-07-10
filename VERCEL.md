# Deploying on Vercel

This repo deploys directly on Vercel as a Python (Flask) serverless app.

## One-time setup

1. `vercel link` — create/link the Vercel project.
2. Create a **public** Blob store and connect it to the project
   (`vercel blob create-store <name> --access public`, then link it to the
   project so `BLOB_READ_WRITE_TOKEN` is injected). Without it the app still
   runs, but uploads/sessions only live in each instance's `/tmp` — fine for
   local dev (`python artifacts/ai-presentation/app.py`), not for production.
3. Set `SESSION_SECRET` (any long random string).
4. `vercel deploy --prod`.

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | prod: yes | Vercel Blob — uploaded decks, slides, reports, sessions |
| `SESSION_SECRET` | yes | cookie signing |
| `UNIFIED_API_KEY` / `UNIFIED_BASE_URL` | for real AI | OpenAI-compatible relay; without them the app runs in mock mode |
| `VISION_MODEL` / `TEXT_MODEL` / `EVAL_MODEL` | optional | model routing overrides (defaults: claude-sonnet-5 / gpt-4o / gemini-2.5-flash) |
| `SPEECHACE_API_KEY`, `SPEECHACE_REGION` | optional | pronunciation scoring |
| `QWEN_API_KEY` | optional | TTS pronunciation demos (also add `dashscope` to `api/requirements.txt`) |

## How the serverless adaptation works

- `api/index.py` exposes the Flask app; `vercel.json` rewrites all routes to it
  (`maxDuration: 300` for the LLM evaluation step).
- `artifacts/ai-presentation/server_store.py` is the persistence layer:
  local disk in dev, Vercel Blob + `/tmp` cache on Vercel. Flask sessions are
  stored server-side through it (cookie holds only a UUID) — Flask's 4KB
  cookie limit previously froze session state mid-run.
- Files >4.5MB (Vercel's request-body cap) upload from the browser straight
  to Vercel Blob via a signed client token (`/x/blob-token`), then the server
  ingests them from Blob (`/x/upload-blob`).
- Blob objects are publicly readable at unguessable UUID URLs and are never
  expired automatically — acceptable for a demo, revisit for real user data.
