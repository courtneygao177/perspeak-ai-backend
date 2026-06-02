---
name: Unified Audio State Machine
description: Single audioMode variable controls exclusive SpeechRecognition access across narration/QA/academic-QA.
---

**Global state:**
```javascript
let audioMode    = 'idle'; // 'idle' | 'narration' | 'qa' | 'acq'
let _narrationRec = null;
let _qaRec        = null;
let _acqRec       = null;
```

**Key functions:**
- `_startNarrationRec()` — internal helper; creates new SR instance for narration; handles auto-restart on `onend`
- `_stopAllRecording()` — stops all three streams, sets audioMode='idle', calls _syncAudioButtons()
- `_syncAudioButtons()` — updates narrationVoiceBtn / voiceBtn / acqVoiceBtn AND recActiveDot / recActiveLabel status badge
- `audioSuspendForQa(wasActive)` — called on INTERRUPT/ACADEMIC_QA_START; saves wasActive flag in `_narrationWasActiveBeforeQA`
- `audioResumeAfterQa()` — called on QA_FINISHED; auto-restarts narration if `_narrationWasActiveBeforeQA` was true
- `toggleNarrationVoice()` — calls _startNarrationRec(); blocked if audioMode==='qa'|'acq'
- `toggleVoice()` — starts _qaRec (interrupt QA panel)
- `toggleAcqVoice()` — starts _acqRec (academic QA panel)

**Continuous Recording across slide transitions:**
In `finishSlide()`, track `wasRecordingNarration = (audioMode === 'narration')` BEFORE the fetch.
For NEXT_SLIDE action: _stopAllRecording() then `setTimeout(() => _startNarrationRec(), 200)` — no user click needed.
For INTERRUPT/ACADEMIC_QA_START: `audioSuspendForQa(wasRecordingNarration)` — stores flag for auto-resume.
For PRESENTATION_DONE: finishPresentation() calls _stopAllRecording() internally.

**Why:** Three independent SpeechRecognition instances caused browser audio stream conflicts. Continuous recording across slides requires stop+restart (new instance = fresh result set) rather than keeping the same stream, because accumulated results would contaminate the next slide's text.

**How to apply:** Always call _startNarrationRec() (not toggleNarrationVoice()) for programmatic starts to avoid the QA-active guard.
