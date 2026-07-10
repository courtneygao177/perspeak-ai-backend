---
name: Slide image cache-busting
description: Why slide preview <img> URLs in ai-presentation must include a per-upload version query param
---

`/x/slide-image/<page>` renders whichever deck is in the CURRENT session, but the URL path itself never changes between uploads (same page number → same path). The server also sends `Cache-Control: max-age=3600` on that response.

**Why:** without a cache-busting key, the browser treats `/x/slide-image/1` as the same cacheable resource across different sessions/uploads and serves back a previous deck's cached image bytes — the user sees the same old PPT rendered even though the backend correctly ingested and would render the new one.

**How to apply:** any `<img src="/x/slide-image/...">` (or equivalent per-file server-rendered asset with a stable path) needs a query param derived from something unique to the current upload (e.g. `file_key`/UUID), e.g. `?v={{ deck_version }}`. Apply this pattern to any other per-session-file endpoint with a stable path + cache headers, not just this one.
