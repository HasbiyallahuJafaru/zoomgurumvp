# THE ZOOMGURU CODE GENERATION BIBLE
# Version 1.0 — Permanent Law
# Every session. Every agent. Every file. No exceptions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PREAMBLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This document is the single source of truth for how code is
generated, verified, and committed in the ZoomGuru project.

It exists because:
    - Patching individual lines across sessions produces drift
    - Parallel agents on shared files produce conflicts
    - Code generated without full context produces hallucination
    - Code that is not compiler-verified produces runtime surprises

This system eliminates all four failure modes.

Violation of any rule in this document is not permitted.
Not for speed. Not for convenience. Not for any reason.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — THE FIVE LAWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LAW 1: FULL CONTEXT BEFORE ANY CODE
    No code is written until the entire relevant codebase
    is loaded into context via graphify.
    No exceptions. Not for small changes. Not for "quick fixes."

LAW 2: AUDIT BEFORE FIX
    No code is written until a full dependency audit is complete.
    The audit produces a numbered list of confirmed bugs.
    Confirmed means: exact file, exact line, exact contradiction.
    Suspected bugs are not acted upon. Only confirmed ones.

LAW 3: COMPLETE FILES ONLY
    No patches. No diffs. No "change line 47 to this."
    Every output is a complete, runnable file from line 1 to EOF.
    Partial files are rejected and regenerated in full.

LAW 4: COMPILER VERIFICATION BEFORE HUMAN TESTING
    Every generated file passes tsc --noEmit before any human
    runs or tests it. Zero TypeScript errors is the gate.
    If errors exist, they are fixed before proceeding.
    Human testing begins only after compiler confirmation.

LAW 5: SEQUENTIAL AGENTS, NEVER SIMULTANEOUS ON SHARED FILES
    Multiple agents may run simultaneously ONLY on
    truly isolated codebases (Electron vs Backend).
    No two agents ever write to files that import from each other
    at the same time. Integration verification runs after
    all agents complete, before any code is executed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — THE SESSION PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every Claude Code session follows this exact sequence.
No step may be skipped. No step may be reordered.

STEP 0 — INSTALL GRAPHIFY (once per machine)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pip install graphifyy

STEP 1 — LOAD FULL CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━
    Navigate to the relevant app root:
        cd apps/electron     (for Electron work)
        cd apps/backend      (for Backend work)
        cd apps/landing      (for Landing work)
        cd apps/admin        (for Admin work)

    Run graphify:
        /graphify .

    Wait for the map to complete before proceeding.
    This is non-negotiable. Context is not optional.

STEP 2 — DECLARE INTENT
━━━━━━━━━━━━━━━━━━━━━━━
    Paste the SESSION DECLARATION (see Part 3).
    State exactly what you are trying to accomplish.
    State which files you expect to touch.
    Do not begin work until intent is declared.

STEP 3 — RUN THE AUDIT
━━━━━━━━━━━━━━━━━━━━━━
    Paste the AUDIT PROMPT (see Part 4).
    Wait for the numbered confirmed bug list.
    Do not generate any code during this step.
    Read the audit output. Confirm it makes sense.

STEP 4 — COMPILER BASELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━
    Run the TypeScript compiler before writing anything:
        npx tsc --noEmit 2>&1

    Capture and record the current error count.
    This is your baseline. The target is zero errors.
    Every fix must reduce this number, never increase it.

STEP 5 — GENERATE COMPLETE FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    For each confirmed bug, regenerate the COMPLETE file.
    One file at a time. Never two simultaneously.
    File generation rules (see Part 5) apply to every file.

STEP 6 — VERIFY EACH FILE
━━━━━━━━━━━━━━━━━━━━━━━━━
    After each file is generated:
        npx tsc --noEmit 2>&1

    If errors: fix only the reported lines. Regenerate.
    If zero errors: proceed to next file.
    Never proceed with TypeScript errors present.

STEP 7 — INTEGRATION VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    After all files are generated and compiler-clean:
    Paste the INTEGRATION AUDIT PROMPT (see Part 6).
    This verifies cross-file contracts are intact.

STEP 8 — HUMAN TESTING
━━━━━━━━━━━━━━━━━━━━━
    Only after Steps 1-7 are complete does human
    testing begin. Never before.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — THE SESSION DECLARATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy this. Fill in the blanks. Paste at start of every session.

---
ZOOMGURU SESSION DECLARATION

Project: ZoomGuru
Session scope: [ELECTRON / BACKEND / LANDING / ADMIN]
Date: [DATE]

I am working on: [DESCRIBE WHAT YOU ARE BUILDING OR FIXING]

Files I expect to touch:
- [FILE PATH 1]
- [FILE PATH 2]
- [FILE PATH 3]

Files I must NOT touch:
- [FILE PATH — any file outside the scope]

Success criteria:
- [WHAT DOES WORKING LOOK LIKE? BE SPECIFIC]
- [e.g. "User can log in with username and receive JWT"]
- [e.g. "SSE stream delivers chunks to overlay UI"]

Compiler target: zero TypeScript errors after all changes.

I have run /graphify . and full context is loaded.
I confirm I will follow the ZoomGuru Code Generation Bible.
---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — THE AUDIT PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy this exactly. Paste after the Session Declaration.
Do not modify it. It must be used verbatim every time.

---
ZOOMGURU FULL DEPENDENCY AUDIT

You have the complete codebase graph from graphify.
Do not generate any code during this audit.
Do not suggest fixes during this audit.
Only find and confirm facts.

Perform this audit in full:

AUDIT 1 — Import Resolution
For every file in scope:
  List every import statement
  Confirm the imported file exists at that exact path
  Confirm the imported export name exists in that file
  Flag any import that cannot be resolved as BROKEN

AUDIT 2 — IPC Contract Verification (Electron only)
  List every ipcMain.handle() channel in main.ts
  List every ipcRenderer.invoke() call in preload.ts
  List every window.zoomguru.* call in renderer files
  Confirm every renderer call has a matching preload exposure
  Confirm every preload exposure has a matching main handler
  Flag any mismatch as BROKEN

AUDIT 3 — API Contract Verification
  List every fetch() or EventSource call in the renderer
  For each: record the method, URL path, headers, body shape
  List every endpoint in the backend controllers
  For each: record the HTTP method, path, expected headers, body
  Flag any mismatch between what renderer sends and backend expects as BROKEN

AUDIT 4 — Type Contract Verification
  List every interface and type that is shared across files
  Confirm every usage matches the defined shape exactly
  Flag any shape mismatch as BROKEN

AUDIT 5 — Environment Variable Verification
  List every import.meta.env.* or process.env.* reference
  Confirm each variable is defined in the relevant .env file
  Flag any undefined variable as BROKEN

OUTPUT FORMAT:
Return a numbered list. Each item:
  [NUMBER] [SEVERITY: CRITICAL/HIGH/LOW]
  File: exact/path/to/file.ts
  Line: approximate line number
  Problem: one sentence describing the exact contradiction
  Evidence: quote the conflicting code from both sides

Do not output anything else.
No suggestions. No fixes. No commentary.
Only the numbered confirmed bug list.
---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — FILE GENERATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These rules apply to every single file generated.
Every rule applies every time. No exceptions.

RULE F1 — COMPLETE FILES ONLY
    Output begins at line 1 of the file.
    Output ends at the last line of the file.
    No "..." placeholders.
    No "rest of file unchanged."
    No partial outputs.
    If the file is too large for one response,
    split it into named sections and output each completely.

RULE F2 — EVERY IMPORT MUST RESOLVE
    Before outputting any import statement, confirm:
    - The file being imported exists in the codebase
    - The specific export being imported exists in that file
    - The path is correct relative to the current file
    If any import cannot be confirmed: do not include it.
    Build the alternative instead.

RULE F3 — NO ASSUMED APIS
    Never reference a function, method, variable, or endpoint
    that has not been confirmed to exist in the codebase.
    If something needs to exist but does not:
    - State it explicitly: "This requires X to be created first"
    - Create X in a separate file before referencing it

RULE F4 — NO TODO COMMENTS IN GENERATED CODE
    TODO comments are placeholders for unimplemented code.
    Unimplemented code that is referenced causes runtime failures.
    Either implement it fully or do not reference it at all.
    The word TODO is banned from generated output.

RULE F5 — NO PLACEHOLDER FUNCTIONS
    Every function must have a real implementation.
    Returning empty string, null, or undefined when real logic
    is needed is not acceptable unless the function is
    explicitly and intentionally a stub (marked as such
    with a comment explaining why and when it will be real).

RULE F6 — TYPESCRIPT STRICT COMPLIANCE
    Every file must pass tsc --noEmit with strict: true.
    No type assertions (as any) unless absolutely unavoidable,
    and if used, a comment must explain exactly why.
    No implicit any. No unused variables. No unused imports.

RULE F7 — ENVIRONMENT VARIABLES MUST EXIST
    Never reference an env variable without confirming
    it is defined in the .env file.
    Every env variable referenced must appear in .env.example.

RULE F8 — IPC CHANNELS MUST BE SYMMETRIC
    Every ipcMain.handle('channel') in main.ts
    must have a matching ipcRenderer.invoke('channel') in preload.ts
    must have a matching window.zoomguru.method() in the bridge
    must have a matching call in the renderer.
    All four must exist or none of them work.

RULE F9 — ONE FILE AT A TIME
    Files are generated and verified one at a time.
    The next file is not started until the current file
    passes tsc --noEmit.
    Speed is not a reason to skip verification.

RULE F10 — OUTPUTS ARE STATED BEFORE GENERATION
    Before generating any file, state:
    "I am about to generate [FILENAME].
     It will import from: [LIST]
     It will export: [LIST]
     It will handle these IPC channels: [LIST] (if applicable)
     It will call these endpoints: [LIST] (if applicable)"
    This pre-declaration is checked against the audit findings.
    If there is a contradiction, it is resolved before generation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — THE INTEGRATION AUDIT PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run this after all files are generated and compiler-clean.
This is the final gate before human testing.

---
ZOOMGURU INTEGRATION AUDIT

All files have been generated and pass tsc --noEmit.
Now verify cross-system contracts.

INTEGRATION CHECK 1 — Electron ↔ Backend
  For every fetch() call in Electron renderer files:
    Method: does the backend accept this HTTP method?
    Path: does this endpoint exist in NestJS controllers?
    Headers: does the backend read Authorization and X-Device-ID?
    Body: does the backend destructure these exact field names?
    Response: does the renderer handle the response shape correctly?

INTEGRATION CHECK 2 — SSE Contract
  For every streaming endpoint:
    Backend sends: data: {"chunk": "...", "done": false}\n\n
    Renderer reads: line.startsWith('data: ') and parses JSON
    Confirm the exact SSE format matches on both sides.

INTEGRATION CHECK 3 — Auth Flow
  Confirm the complete auth chain:
    Renderer sends: POST /auth/login {email, password, deviceId}
    Backend returns: {accessToken, refreshToken, user}
    Renderer stores: localStorage + electron-store
    Subsequent requests include: Authorization: Bearer <token>
    Backend verifies: JwtAuthGuard reads Authorization header
    Backend checks: X-Device-ID matches license fingerprint

INTEGRATION CHECK 4 — IPC Full Chain
  For every user-facing feature:
    UI action → window.zoomguru.method()
    → preload ipcRenderer.invoke()
    → main ipcMain.handle()
    → returns to renderer
  Confirm every link in every chain exists and matches.

OUTPUT FORMAT:
  PASS: [check name] — all contracts verified
  FAIL: [check name] — [exact mismatch description]

Only output PASS or FAIL for each check.
If any FAIL exists, do not proceed to human testing.
Fix the FAIL first, re-run tsc --noEmit, re-run this audit.
---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 7 — THE MULTI-AGENT PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When multiple agents are used, these rules govern them.

AGENT ISOLATION RULE
    Agents may only run simultaneously on isolated codebases.
    Isolated means: no shared imports, no shared files.

    Safe simultaneous:
        Agent A → apps/electron/ only
        Agent B → apps/backend/ only
        Agent C → apps/landing/ only
        Agent D → apps/admin/ only

    Never simultaneous:
        Two agents on apps/electron/
        Two agents modifying files that import each other

AGENT SEQUENCING RULE
    When agents must touch related systems:
        Agent 1 completes and commits first
        tsc --noEmit passes for Agent 1's scope
        Agent 2 reads Agent 1's output as context
        Agent 2 then generates its files
        Integration audit runs after both complete

AGENT DECLARATION RULE
    Every agent begins with the Session Declaration.
    Every agent runs graphify on its scope.
    Every agent runs the Audit Prompt on its scope.
    Every agent follows all File Generation Rules.
    Every agent runs tsc --noEmit after every file.

AGENT HANDOFF FORMAT
    When Agent 1 finishes and Agent 2 needs its output:
    Agent 1 produces a CONTRACT SUMMARY:

    ---
    AGENT 1 CONTRACT SUMMARY
    Scope: apps/electron/
    Files generated: [list]
    Exports created: [list]
    IPC channels handled: [list]
    API endpoints called: [exact method, path, headers, body]
    Environment variables used: [list]
    TypeScript errors: 0
    ---

    Agent 2 reads this contract before generating anything.
    Agent 2's imports must match Agent 1's exports exactly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 8 — THE VERIFICATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run this checklist before every commit. Every item must pass.

PRE-COMMIT CHECKLIST

[ ] /graphify . was run at session start
[ ] Session Declaration was completed
[ ] Audit Prompt was run and confirmed bug list produced
[ ] tsc --noEmit baseline was recorded
[ ] All generated files are COMPLETE (not partial)
[ ] Every import in every file resolves to a real export
[ ] No TODO comments in generated code
[ ] No placeholder functions returning empty/null unexpectedly
[ ] tsc --noEmit shows ZERO errors after all changes
[ ] Integration Audit shows all PASS
[ ] No new TypeScript errors introduced vs baseline
[ ] .env files contain all referenced variables
[ ] Every IPC channel has main handler + preload exposure + renderer call

If any item is unchecked: do not commit. Fix first.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 9 — THE TESTING PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Human testing only begins after compiler verification.
Testing follows this exact sequence every time.

TEST SEQUENCE — ELECTRON APP

T1: App launches without crash
    Run: npm run dev
    Expected: no console errors on launch
    Expected: overlay window appears

T2: Screen protection active
    Expected: overlay header shows ● Hidden (green)
    Expected: console shows ✅ Screen protection active

T3: Login flow
    Action: enter credentials, click Sign In
    Expected: network tab shows POST /auth/login
    Expected: 200 response with accessToken
    Expected: overlay unlocks and shows interview UI

T4: Listen mode
    Action: press Cmd/Ctrl+Shift+A
    Expected: isListening indicator appears
    Expected: speak a sentence
    Expected: POST /ai/stream fires with Authorization header
    Expected: answer streams word by word in overlay

T5: Screenshot mode
    Action: press Cmd/Ctrl+Shift+S
    Expected: POST /ai/screenshot fires
    Expected: answer streams in overlay
    Expected: no URL-too-long error

T6: Hide/show
    Action: press Cmd/Ctrl+Shift+H
    Expected: overlay hides to tray
    Action: click tray icon
    Expected: overlay reappears

T7: Screen share invisibility
    Action: open Zoom, share entire screen
    Expected: overlay does NOT appear in Zoom preview
    Expected: overlay header shows ● Hidden

T8: Session end
    Action: click New button in overlay header
    Expected: POST /session/end fires
    Expected: session summary stored
    Expected: fresh session begins

TEST SEQUENCE — BACKEND

B1: Health check
    curl https://api.zoomguru.com/health
    Expected: {"status":"ok"}

B2: Auth endpoints
    POST /auth/register — new user
    POST /auth/login — existing user
    GET /auth/check-username — available username
    Expected: all return correct shapes

B3: SSE streaming
    POST /ai/stream with valid JWT
    Expected: Content-Type: text/event-stream
    Expected: chunks arrive as data: {"chunk":"..."}\n\n
    Expected: final data: {"done":true}\n\n

B4: Admin stats
    GET /admin/stats with x-admin-key header
    Expected: revenue, users, sessions data returned

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 10 — THE RULES FOR NEW FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every new feature follows this process. No shortcuts.

STEP 1 — SPEC BEFORE CODE
    Write what the feature does in plain English.
    List every file it will touch.
    List every new IPC channel it needs.
    List every new API endpoint it needs.
    Get confirmation before writing a single line.

STEP 2 — CONTRACTS BEFORE IMPLEMENTATION
    Define the interface between systems first:
    - IPC channel name and payload shape
    - API endpoint method, path, headers, body, response
    - TypeScript interfaces for all shared data shapes
    Write ONLY these contracts first.
    Verify they are consistent with existing contracts.

STEP 3 — IMPLEMENT OUTWARD IN
    Build in this order:
    1. Database (if new data needed)
    2. Backend endpoint
    3. Backend tests (tsc --noEmit)
    4. Preload IPC bridge (if Electron)
    5. Main process handler (if Electron)
    6. Renderer/UI
    7. Full integration audit
    8. Human testing

    Never build UI before the API exists.
    Never build the API before the DB schema exists.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 11 — WHAT IS FORBIDDEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These actions are permanently banned from this project.

FORBIDDEN 1: Generating code without running graphify first
FORBIDDEN 2: Generating code without running the Audit Prompt first
FORBIDDEN 3: Generating partial files or diffs instead of complete files
FORBIDDEN 4: Committing code with TypeScript errors
FORBIDDEN 5: Simultaneous agents on files that share imports
FORBIDDEN 6: TODO comments in production code
FORBIDDEN 7: Placeholder functions that pretend to work
FORBIDDEN 8: Referencing env variables not in .env
FORBIDDEN 9: Referencing IPC channels not defined in main.ts
FORBIDDEN 10: Referencing API endpoints not defined in the backend
FORBIDDEN 11: Starting human testing before compiler passes
FORBIDDEN 12: Skipping the Integration Audit before testing
FORBIDDEN 13: Writing new code to fix compilation errors
             (instead: fix the specific error lines only)
FORBIDDEN 14: Using as any without a comment explaining why
FORBIDDEN 15: Generating code for a new file before its
              contract is defined and agreed upon

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 12 — THE BIBLE IN FIVE SENTENCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For when you need a reminder in ten seconds:

1. Load the full codebase with graphify before writing anything.
2. Audit first — find all bugs before fixing any of them.
3. Generate complete files, never patches or partial outputs.
4. Verify with the TypeScript compiler before human testing.
5. Sequential agents on isolated scopes, never simultaneous
   on shared files.

These five sentences are the entire system.
Every other rule in this document exists to enforce them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EFFECTIVE DATE: This document governs all ZoomGuru code
from the moment it is placed in .claude/BIBLE.md.
All previous prompting approaches are superseded.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
