# ZoomGuru

A desktop overlay app that sits transparently over your screen during job interviews. It listens to questions via microphone, captures screenshots on demand, and streams answers in real time. The overlay is invisible to screen share software — the user sees it, the interviewer does not.

---

## How it works

1. Launch the app. A transparent overlay appears above all other windows.
2. Join your interview call. The overlay is hidden from Zoom, Meet, Teams, and Webex via OS content protection.
3. Press `Ctrl+Shift+A`, speak the question you just heard. An answer streams onto the overlay word by word in under two seconds.
4. For coding challenges, press `Ctrl+Shift+S` to capture the screen. The vision model reads the problem and streams a full solution.

---

## Repository structure

```
zoomguru/
├── apps/
│   ├── electron/       Desktop overlay app (Electron + Vite + React)
│   ├── backend/        Local API server (NestJS + Fastify, port 3000)
│   └── landing/        Marketing page (plain HTML, no build step)
└── .claude/            Project context and specs
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop app | Electron, Vite, React 18, TypeScript strict |
| Backend | NestJS, Fastify adapter, TypeScript |
| Database | Neon PostgreSQL, `@neondatabase/serverless`, raw SQL |
| Auth | JWT via `@nestjs/jwt`, 30-day expiry |
| Text answers | DeepSeek V3 (`deepseek-chat`) and R1 (`deepseek-reasoner`) |
| Screenshot reading | Groq vision (`llama-4-scout-17b-16e-instruct`) |
| Voice transcription | Groq Whisper (`whisper-large-v3-turbo`) |
| Payments | Paystack |

---

## Prerequisites

- Node.js 20+
- A Neon PostgreSQL database (free tier works)
- A DeepSeek API key
- A Groq API key
- A Paystack account (test keys are fine for development)

---

## Setup

### 1. Install dependencies

```bash
cd apps/backend && npm install
cd ../electron && npm install
```

### 2. Configure the backend

```bash
cp apps/backend/.env.example apps/backend/.env
```

Fill in `apps/backend/.env`:

```env
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
JWT_SECRET=any_long_random_string

DEEPSEEK_API_KEY=sk-...
GROQ_API_KEY=gsk_...

PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PLAN_MONTHLY=PLN_...
PAYSTACK_PLAN_ANNUAL=PLN_...
PAYSTACK_SUCCESS_URL=http://localhost:5173/payment-success

PORT=3000
NODE_ENV=development
```

The backend validates all required variables on startup and exits immediately if any are missing.

### 3. Configure the Electron app

Create `apps/electron/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development
```

### 4. Seed the database

The backend runs `CREATE TABLE IF NOT EXISTS` on first boot — no migration step needed. Connect to your Neon database and insert a user manually to log in:

```sql
INSERT INTO users (email, password_hash, name, is_active)
VALUES (
  'you@example.com',
  '$2b$10$...',
  'Your Name',
  true
);
```

To generate a bcrypt hash:

```bash
node -e "const b=require('bcrypt'); b.hash('yourpassword', 10).then(console.log)"
```

---

## Running

Both processes must be running simultaneously.

```bash
# Terminal 1 — backend
cd apps/backend
npm run start:dev

# Terminal 2 — Electron app
cd apps/electron
npm run dev
```

The backend starts on `http://localhost:3000`. The Electron app connects to it automatically.

---

## Hotkeys

| Hotkey | Action |
|---|---|
| `Ctrl+Shift+A` | Start microphone, speak your question |
| `Ctrl+Shift+S` | Capture screen and solve what is visible |
| `Ctrl+Shift+H` | Toggle overlay visibility |
| `Ctrl+Shift+C` | Clear current answer |

---

## API endpoints

```
POST /auth/login
  Body:    { email, password }
  Returns: { accessToken, user }

POST /ai/stream
  Auth:    Bearer token
  Body:    { transcript, sessionId? }
  Returns: text/event-stream — chunks: { chunk, done }

POST /ai/screenshot
  Auth:    Bearer token
  Body:    { image (base64), sessionId? }
  Returns: text/event-stream — same format as /ai/stream

POST /subscription/initialize
  Auth:    Bearer token
  Returns: { checkoutUrl } — Paystack hosted checkout

POST /subscription/verify
  Auth:    Bearer token
  Body:    { reference }
  Returns: { active, plan, expiresAt }

GET /subscription/status
  Auth:    Bearer token
  Returns: { active, plan, expiresAt }
```

---

## Building a distributable

```bash
# Windows installer
cd apps/electron
npm run dist:win

# macOS dmg
cd apps/electron
npm run dist:mac
```

Output lands in `apps/electron/dist-release/`.

---

## Screen share invisibility

The overlay is hidden from screen share software using `win.setContentProtection(true)` — the same OS API used by banking apps to block screen capture. This is called before the window is shown, and re-applied after the first `show` event on Windows. It works on Zoom, Google Meet, Microsoft Teams, and Webex without any configuration.

---

## Model routing

The backend routes each question to the appropriate model automatically:

- Coding, algorithms, system design, maths — DeepSeek R1 (`deepseek-reasoner`)
- Behavioural, situational, general — DeepSeek V3 (`deepseek-chat`)
- Screenshots — Groq vision reads the image, R1 solves the problem

---

## Landing page

`apps/landing/index.html` is a single self-contained file with no build step. Open it directly in a browser or serve it from any static host.

```bash
npx serve apps/landing
```
