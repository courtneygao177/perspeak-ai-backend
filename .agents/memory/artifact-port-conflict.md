---
name: Artifact port conflict between manual and artifact-managed workflows
description: What to do when the manually-configured "Start application" workflow and its auto-generated artifact-managed workflow both bind the same port and fight each other.
---

When an artifact is registered, the platform auto-generates a second workflow (`artifacts/<dir>: <title>`) bound to the same `localPort` declared in `artifact.toml`. If a separate manually-configured workflow (e.g. "Start application") also starts the same server, only one process can hold the port — whichever started last wins, and the other fails with "Address already in use".

**Why:** `[services.development.env]` PORT overrides in `artifact.toml` do NOT actually change what port the dev process binds to or what port the workflow's `waitForPort` checks — the platform still ties the workflow to the service's declared `localPort`. Editing this does nothing for the conflict.

**How to apply:** To recover, find and kill the stray `python app.py` (or equivalent) process via `ps aux` + `kill -9`, freeing the port, then restart the desired workflow immediately. Expect the auto-generated artifact workflow to keep failing in the background if a separate manual workflow is the canonical one being used for dev — that's usually harmless as long as the manual workflow serves the preview correctly.
