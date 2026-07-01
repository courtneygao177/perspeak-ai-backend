---
name: ai-presentation app quirks
description: Environment/tooling quirks specific to the PerspeakAI (ai-presentation) Flask app.
---

## Screenshot tool can't target this app

The `screenshot` tool's `app_preview` mode requires `artifact_dir_name` to match a registered artifact (checked via `listArtifacts()` / registered artifact dirs). This Flask app runs via the root "Start application" workflow and is not registered as an artifact, so `app_preview` screenshots fail with "Artifact not found".

**Why:** the app predates/bypasses the artifacts system — it's a single-file Flask app run directly, not scaffolded through the artifacts skill.

**How to apply:** to verify UI/behavior changes, drive the app via `curl`/HTTP requests against `http://127.0.0.1:8000` (cookie-jar for session state) and inspect the returned HTML/JSON directly, rather than reaching for the screenshot tool.
