---
name: Flask session disk offload pattern
description: How large Flask session blobs (slides, reports) are stored on disk to avoid the 4KB cookie limit.
---

## The rule
Any blob that could exceed a few hundred bytes must NOT go into `session[key]`. Instead write it to a JSON file under `uploads/<category>/<uuid>.json` and store only the 36-char UUID key in the cookie.

## Why
Flask's encrypted session cookie tops out at ~4093 bytes. Exceeding that causes the browser to silently reject the cookie, so the *next* request sees an empty session. `session.get("slides", MOCK_SLIDES)` then returns the 3-slide mock deck and the presentation ends after 3 slides — the symptom that surfaced this bug.

## How to apply
- **Reports** → `_save_report(eval, qa_bank, answers)` / `_load_report(key)` → `uploads/reports/<uuid>.json`
- **Slides** → `_save_slides(slides)` / `_load_slides(session)` → `uploads/slide_store/<uuid>.json`; session key is `slide_key`
- Store only UUID strings in the cookie; never store the raw list/dict
- The load helpers fall back to `MOCK_SLIDES` / `None` if the file is missing, so callers stay safe
