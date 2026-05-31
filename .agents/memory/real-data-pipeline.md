---
name: Real Data Pipeline to Gemini
description: How frontend transcripts and QA history flow to the backend evaluation engine.
---

**Frontend sends to /x/finish-presentation (POST JSON body):**
```javascript
{
  presentation_transcripts: [{page, text, words}],  // per-slide narrations
  qa_chat_history:          [{role:'ai'|'user', text, type:'interrupt'|'academic'}],
  slide_logic_tree:         slides,  // the JS `slides` array
  total_time_seconds:       timerSeconds,  // from the sandbox timer
}
```

**Accumulation points in sandbox.html:**
- `presentationTranscripts.push(...)` on NEXT_SLIDE, ACADEMIC_QA_START, PRESENTATION_DONE, and INTERRUPT (narration before interrupt saved)
- `qaChatHistory.push({role:'ai',...})` when INTERRUPT/ACADEMIC_QA_START fires (AI question)
- `qaChatHistory.push({role:'user',...})` in submitAnswer() and submitAcademicQa() before the fetch
- `qaChatHistory.push({role:'ai',...})` on CONTINUE_QA and ACADEMIC_QA_NEXT responses

**Backend merges POST body into session:**
- `api_finish_presentation` reads JSON body; fills in narrations missing from session["answers"]
- Merges QA history if frontend has more entries than session

**run_pillar_evaluation pre-computes:**
- `total_words` from all narration text
- `wpm_estimate = total_words / (total_time_seconds / 60)`
- `filler_count` via regex `\b(um+|uh+|like|you know|basically|...)\b`
- `all_empty = total_words < 10` → mandatory score cap at 40

**Why:** Without this, all sessions returned the same scores regardless of speech. Gemini now receives per-slide narration, real WPM, and filler density as anchors.
