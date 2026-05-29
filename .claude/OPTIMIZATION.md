# ZoomGuru — Cost & Efficiency Optimization Session
# Run this file at the start of a new Claude Code session.
# Two sessions required: Backend first, then Electron.
# Do NOT run both simultaneously — they share context via Overlay.tsx constants.

---

## Background

The following four optimizations were identified to reduce per-session AI costs
from ~$0.12 to ~$0.045 (62% reduction), improving gross margin from ~88% to ~96%
at a $20/mo subscription with 20 sessions/user/month.

| # | Change | File | Impact |
|---|--------|------|--------|
| 1 | Truncate CV + JD before sending to AI | ai.service.ts | ~60% input token reduction |
| 2 | Tighten R1 routing — remove ambiguous keywords | ai.service.ts | ~30% fewer R1 calls |
| 3 | Reduce R1 max_tokens: 4000 → 1500 | ai.service.ts | ~60% R1 output cost reduction |
| 4 | Raise MIN_BLOB_BYTES to pre-filter auto-mode audio | Overlay.tsx | ~30% fewer transcription calls |

Sessions below are ordered: backend first, electron second.

---

---

# SESSION A — BACKEND
# Scope: apps/backend/src/ai/ai.service.ts
# Changes: Optimizations 1, 2, 3

---

## Step 1 — Paste this Session Declaration

```
ZOOMGURU SESSION DECLARATION

Project: ZoomGuru
Session scope: BACKEND
Date: [TODAY'S DATE]

I am working on: Cost and efficiency optimizations in the AI service.
Three changes, all contained within a single file: ai.service.ts.

Files I expect to touch:
- apps/backend/src/ai/ai.service.ts

Files I must NOT touch:
- apps/backend/src/ai/ai.controller.ts
- apps/backend/src/ai/ai.module.ts
- apps/backend/src/auth/*
- apps/backend/src/database/*
- apps/backend/src/main.ts
- apps/backend/src/app.module.ts
- apps/electron/* (entire electron app — different session)

Success criteria:
- buildSystemPrompt() truncates cvText to 1500 chars and jdText to 1000 chars
  before inserting them into the prompt.
- routeModel() no longer routes to deepseek-reasoner for the keywords:
  design, architect, scale, system, microservice, database, cache, load balancer.
  Only unambiguously technical keywords trigger R1.
- max_tokens for deepseek-reasoner is reduced from 4000 to 1500.
- All other logic in ai.service.ts is untouched.
- npx tsc --noEmit passes with zero errors after changes.

Compiler target: zero TypeScript errors after all changes.

I have run /graphify . and full context is loaded.
I confirm I will follow the ZoomGuru Code Generation Bible.
```

---

## Step 2 — Paste this Audit Prompt

```
ZOOMGURU FULL DEPENDENCY AUDIT — ai.service.ts only

You have the complete codebase graph from graphify.
Do not generate any code during this audit.
Only find and confirm facts about ai.service.ts.

AUDIT 1 — Current buildSystemPrompt() behaviour
  Quote the exact lines where cvText and jdText are inserted into the prompt.
  Confirm there is no truncation applied to either before insertion.
  State the maximum possible token count for cvText (assume a 3-page CV, ~3000 tokens).
  State the maximum possible token count for jdText (assume a full JD, ~1200 tokens).

AUDIT 2 — Current routeModel() keyword list
  List every keyword currently triggering deepseek-reasoner.
  For each keyword, assess: is it unambiguously technical, or could it appear
  in a behavioral/general interview question?
  Label each: TECHNICAL-ONLY or AMBIGUOUS.

AUDIT 3 — Current max_tokens values
  Quote the exact line where max_tokens is set for deepseek-reasoner.
  Quote the exact line where max_tokens is set for deepseek-chat.
  State the approximate cost difference per call between 4000 and 1500 output tokens
  at DeepSeek R1 pricing (~$2.19/1M output tokens).

AUDIT 4 — Confirm no other files reference these constants
  Confirm that max_tokens is set only inside buildBody() in ai.service.ts.
  Confirm that routeModel() is called only from streamAnswer() in ai.service.ts.
  Confirm that buildSystemPrompt() is called only from buildBody() in ai.service.ts.

OUTPUT FORMAT:
Return a numbered list. Each item:
  [NUMBER] [SEVERITY: CRITICAL/HIGH/LOW]
  File: exact/path/to/file.ts
  Line: approximate line number
  Finding: one sentence describing exactly what was found
  Evidence: quote the relevant code

Do not output anything else. No suggestions. No fixes.
```

---

## Step 3 — Paste this Implementation Prompt

```
ZOOMGURU IMPLEMENTATION — ai.service.ts cost optimizations

Pre-declaration (confirm before generating):
  File: apps/backend/src/ai/ai.service.ts
  Imports: unchanged (no new imports needed)
  Exports: unchanged
  Endpoints called: unchanged

Apply exactly these three changes to ai.service.ts. Complete file only.

CHANGE 1 — Truncate CV and JD in buildSystemPrompt()
  Before inserting cvText into the prompt, truncate it to a maximum of 1500 characters.
  Before inserting jdText into the prompt, truncate it to a maximum of 1000 characters.
  Apply the same truncation in buildVisionPrompt() for consistency.
  Do not truncate with a hard slice that cuts mid-word — truncate at the nearest
  whitespace boundary at or before the character limit.
  No ellipsis or truncation notice needed. Just slice cleanly.

CHANGE 2 — Tighten routeModel() keyword list
  Remove these keywords from the R1 trigger list — they are AMBIGUOUS and fire
  R1 on common behavioral questions:
    design, architect, scale, system, microservice, database, cache, load balancer
  Keep only these TECHNICAL-ONLY keywords that unambiguously indicate a coding question:
    implement, algorithm, complexity, leetcode, function, code, binary, array,
    tree, graph, dynamic, calculate, probability, formula, proof, derive
  Do not add any new keywords. Do not reorder the remaining list.

CHANGE 3 — Reduce R1 max_tokens
  In buildBody(), change max_tokens for deepseek-reasoner from 4000 to 1500.
  Leave max_tokens for deepseek-chat at 800 — unchanged.

All other logic in ai.service.ts must be byte-for-byte identical to the current file.
After generating the complete file, run npx tsc --noEmit and confirm zero errors.
```

---

## Step 4 — Verify

After the file is generated, run the following and confirm the output:

```bash
cd apps/backend
npx tsc --noEmit
```

Expected: no output (zero errors).

Then manually verify in the generated file:
- `buildSystemPrompt`: contains a truncation helper or inline slice before `cvText` and `jdText` are used
- `routeModel`: keyword array does NOT contain "design", "system", "database", "cache"
- `buildBody`: `max_tokens` for `deepseek-reasoner` is `1500`, not `4000`

---

---

# SESSION B — ELECTRON
# Scope: apps/electron/src/overlay/Overlay.tsx
# Change: Optimization 4 — raise MIN_BLOB_BYTES pre-filter

---

## Step 1 — Paste this Session Declaration

```
ZOOMGURU SESSION DECLARATION

Project: ZoomGuru
Session scope: ELECTRON
Date: [TODAY'S DATE]

I am working on: Reducing wasteful transcription API calls in Auto mode.
One constant change in Overlay.tsx. No logic changes.

Files I expect to touch:
- apps/electron/src/overlay/Overlay.tsx

Files I must NOT touch:
- apps/electron/electron/main.ts
- apps/electron/electron/preload.ts
- apps/electron/src/global.d.ts
- apps/electron/src/App.tsx
- apps/electron/src/auth/*
- apps/electron/src/onboarding/*
- apps/electron/src/overlay/AnswerStream.tsx
- apps/backend/* (entire backend — different session)

Success criteria:
- MIN_BLOB_BYTES is raised from 15_000 to 25_000.
- No other constant, function, or logic is changed.
- npx tsc --noEmit passes with zero errors after change.

Compiler target: zero TypeScript errors after all changes.

I have run /graphify . and full context is loaded.
I confirm I will follow the ZoomGuru Code Generation Bible.
```

---

## Step 2 — Paste this Audit Prompt

```
ZOOMGURU AUDIT — Overlay.tsx auto-mode pre-filter

Do not generate any code during this audit.

AUDIT 1 — Locate MIN_BLOB_BYTES
  Quote the exact line where MIN_BLOB_BYTES is defined in Overlay.tsx.
  State its current value.

AUDIT 2 — Trace how MIN_BLOB_BYTES is used
  Quote every line in Overlay.tsx that references MIN_BLOB_BYTES.
  Confirm it gates audio blob size before the transcription fetch call.
  Confirm no other code path bypasses this gate.

AUDIT 3 — Confirm the transcription call location
  Quote the exact fetch() call to /ai/transcribe in Overlay.tsx.
  Confirm MIN_BLOB_BYTES check happens before this fetch is reached.

OUTPUT FORMAT:
Return a numbered list. Each item:
  [NUMBER] File: ... Line: ... Finding: ... Evidence: ...
No suggestions. No fixes.
```

---

## Step 3 — Paste this Implementation Prompt

```
ZOOMGURU IMPLEMENTATION — Overlay.tsx MIN_BLOB_BYTES increase

Pre-declaration:
  File: apps/electron/src/overlay/Overlay.tsx
  Imports: unchanged
  Exports: unchanged
  IPC channels: unchanged
  API calls: unchanged

Apply exactly one change to Overlay.tsx:

CHANGE — Raise MIN_BLOB_BYTES constant
  At the top of the file where constants are defined, change:
    const MIN_BLOB_BYTES = 15_000;
  to:
    const MIN_BLOB_BYTES = 25_000;

This is the only change. Every other line in the file must be identical
to the current version.

After generating the complete file, run:
  cd apps/electron && npx tsc --noEmit

Confirm zero errors before considering this done.
```

---

## Step 4 — Verify

```bash
cd apps/electron
npx tsc --noEmit
```

Expected: no output (zero errors).

Manually verify: `MIN_BLOB_BYTES = 25_000` appears at the top of Overlay.tsx.

---

---

# Summary — What These Changes Achieve

```
Before optimizations:
  Input tokens/session:   ~125,000  (full CV + JD on every call)
  R1 trigger rate:        ~50% of questions
  R1 max output:          4,000 tokens
  Wasted transcriptions:  ~15% of auto-mode segments
  Cost/session:           ~$0.12

After optimizations:
  Input tokens/session:   ~42,000   (truncated CV + JD)
  R1 trigger rate:        ~25% of questions
  R1 max output:          1,500 tokens
  Wasted transcriptions:  ~5% of auto-mode segments
  Cost/session:           ~$0.045

Estimated gross margin improvement:
  @ $20/mo, 20 sessions/user/month
  Before: ~88%   After: ~96%
```
