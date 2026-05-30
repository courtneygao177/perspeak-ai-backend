---
name: Academic Q&A Post-Session Flow
description: How Academic Presentation triggers post-session Q&A before the report.
---

**Scenario routing:**
- `Academic Presentation` → check-slide on last slide returns `ACADEMIC_QA_START` (1/2/3 questions based on Easy/Medium/Hard). JS shows `#academicQaPanel`. Answers posted to `/x/submit-academic-qa`. Returns `ACADEMIC_QA_NEXT` or `ACADEMIC_QA_DONE`. When done → `finishPresentation()`.
- `Thesis Defense` → mid-session interrupt only (INTERRUPT action at page 2). No post-session Q&A panel.
- `MBA Case Pitch` → mid-session interrupt only. No post-session Q&A. No Q&A bank generated.

**State machine keys in session:**
- `session["state"]["academic_qa_mode"]` — bool
- `session["state"]["academic_qa_index"]` — current question index
- `session["state"]["academic_qa_total"]` — total questions
- `session["academic_qa_questions"]` — list of question dicts from qa_bank

**Why:** Academic Presentation uses a calmer post-session format vs the disruptive mid-session interrupt used for Thesis/MBA. Having separate panels (`#academicQaPanel` indigo vs `#qaPanel` red) signals the different tone.
