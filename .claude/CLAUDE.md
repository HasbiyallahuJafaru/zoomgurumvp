# ZoomGuru MVP — Local Deployment
# Master Context File
# Read this before every session. No exceptions.

---

## What ZoomGuru Is

A desktop Electron app that sits as a transparent overlay
on the user's screen during job interviews. It listens to
questions via microphone, captures screenshots on demand,
and streams AI-generated answers in real time.

The overlay is invisible to screen share software.
The user sees it. The interviewer does not.

---

## Current Phase

LOCAL MVP — runs entirely on the developer's machine.
No cloud hosting. No SSL. No Cloudflare. No auto-updater.
Goal: get the four core flows working reliably before
adding any infrastructure complexity.

---

## The Four Core Flows (Nothing Else Matters Yet)

```
FLOW 1: Window
    App launches → transparent overlay appears
    Open Zoom → overlay is invisible to screen share
    ✅ Gate: hidden from screen share confirmed

FLOW 2: Login
    User enters email + password
    POST localhost:3000/auth/login
    Token stored → overlay unlocks
    ✅ Gate: can log in and see blank overlay

FLOW 3: Listen
    Press Cmd/Ctrl+Shift+A
    Speak a question
    Answer streams word by word in overlay
    ✅ Gate: text flows end to end

FLOW 4: Screenshot
    Press Cmd/Ctrl+Shift+S
    Screen captured → AI reads it → answer streams
    ✅ Gate: image flows end to end
```

---

## Monorepo Structure (MVP scope only)

```
zoomguru/
├── .claude/
│   ├── CLAUDE.md          ← this file
│   ├── BIBLE.md           ← code generation law
│   ├── ELECTRON.md        ← electron app spec
│   ├── BACKEND.md         ← backend spec
│   └── DATABASE.md        ← neon schema
├── apps/
│   ├── electron/          ← desktop overlay app
│   └── backend/           ← nestjs local server
└── package.json
```

---

## Tech Stack — MVP Only

```
Electron App
    ├── Electron (latest)
    ├── Vite + React 18
    ├── TypeScript strict
    └── No external UI library — plain inline styles

Backend (runs locally on port 3000)
    ├── NestJS + Fastify adapter
    ├── @neondatabase/serverless (Neon PostgreSQL)
    ├── @nestjs/jwt (simple JWT, long expiry)
    └── No Redis, no Prisma, no ORMs

AI
    ├── DeepSeek V3 (deepseek-chat) — text questions
    ├── DeepSeek R1 (deepseek-reasoner) — coding/math
    └── Qwen VL (qwen-vl-max) — screenshot vision

Database
    └── Neon PostgreSQL — direct SQL, @neondatabase/serverless
```

---

## Paystack Integration (Inline.js — current approach)

Paystack uses the inline.js script tag injected at runtime.
No redirect, no popup mode, no server-side checkout session.

```
Monthly plan  → pop.setup({ plan: VITE_PAYSTACK_PLAN_MONTHLY })
                Paystack subscription — recurring ₦50,000/month
                Plan code (PLN_xxx) must be created in Paystack dashboard

Lifetime plan → pop.setup({ amount: 100_000_000 })
                One-time payment — ₦1,000,000 (amount in kobo)
                No plan code needed — hardcoded in Dashboard.tsx

After payment → POST /subscription/verify { reference }
                Backend calls Paystack API to confirm
                Monthly: no period_end set (webhook sets it later)
                Lifetime: current_period_end set to 2099-12-31
```

Note: VITE_PAYSTACK_PLAN_ANNUAL has been removed.
The second plan is now lifetime (one-time), not annual (recurring).

---

## What Is Deliberately CUT From MVP

These exist in the full spec but are NOT built yet.
Do not reference or implement them in MVP sessions.

```
DEFERRED (build after core works):
    ├── Google OAuth — email/password only for now
    ├── Wake word (Porcupine) — hotkeys only
    ├── Auto-updater — not needed locally
    ├── Protection self-test — trust setContentProtection
    ├── Paywall / free tier limits — everyone unlimited
    ├── Session summary saving — no DB writes during session
    ├── Referral system — post-launch
    ├── Onboarding flow — skip to overlay directly
    ├── Zustand state management — plain useState
    ├── CV upload — system prompt uses generic base prompt
    ├── Mode switching UI — one smart mode, auto-detected
    ├── ModeBar component — removed
    ├── Opacity slider — hardcoded 20%
    ├── Admin dashboard — post-launch
    ├── User dashboard — post-launch
    ├── Landing page payments — post-launch
    ├── Device fingerprint locking — post-launch
    ├── Cloudflare protection — post-launch
    └── Rate limiting — post-launch
```

---

## Local Environment

```
Backend URL:     http://localhost:3000
Frontend URL:    http://localhost:5173 (Vite dev server)
Database:        Neon PostgreSQL (cloud, always accessible)
AI APIs:         DeepSeek + Qwen (cloud, need internet)

Start backend:   cd apps/backend && npm run start:dev
Start electron:  cd apps/electron && npm run dev

Both must be running simultaneously for the app to work.
```

---

## Universal Rules (Active Every Session)

1. Run graphify claude install once per machine (done)
2. Always read BIBLE.md before generating any code
3. Complete files only — never patches or partial output
4. tsc --noEmit must pass before any file is considered done
5. One file at a time — verify before moving to next
6. IPC channels must exist in all four places:
   main.ts + preload.ts + type definition + renderer call
7. API calls must match endpoint method + path + headers + body
8. No TODO comments in generated code
9. No placeholder functions
10. No assumed APIs — only use what exists in this codebase

---

## Andrej Karpathy Coding Guidelines (forrestchang/andrej-karpathy-skills)

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.
Before implementing: state assumptions, present multiple interpretations if they exist, push back when a simpler approach exists, stop and ask if something is unclear.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code. No "flexibility" that wasn't requested. No error handling for impossible scenarios. If 200 lines could be 50, rewrite it.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting. Don't refactor things that aren't broken. Match existing style. Remove imports/variables/functions that YOUR changes made unused — don't touch pre-existing dead code unless asked.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.
Transform tasks into verifiable goals. For multi-step tasks, state a brief plan with verify steps before starting.
