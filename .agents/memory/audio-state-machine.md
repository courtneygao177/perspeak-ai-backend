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
- `_stopAllRecording()` — stops all three streams, sets audioMode='idle', calls _syncAudioButtons()
- `_syncAudioButtons()` — updates innerHTML of narrationVoiceBtn / voiceBtn / acqVoiceBtn based on audioMode
- `audioSuspendForQa()` — called on INTERRUPT and ACADEMIC_QA_START → _stopAllRecording()
- `audioResumeAfterQa()` — called on QA_FINISHED → _stopAllRecording() (user re-clicks to restart narration)
- `toggleNarrationVoice()` — starts _narrationRec; blocked if audioMode==='qa'|'acq'
- `toggleVoice()` — starts _qaRec (interrupt QA panel)
- `toggleAcqVoice()` — starts _acqRec (academic QA panel)

**Why:** Three independent SpeechRecognition instances caused browser audio stream conflicts. Only one stream can be active at a time. The `audioMode` variable enforces this invariant.

**How to apply:** Always check/set audioMode before creating a new SpeechRecognition. Never create a new SR without calling _stopAllRecording() first.
