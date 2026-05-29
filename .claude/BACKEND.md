# ZoomGuru MVP — Backend

## Purpose
Local NestJS server that handles auth, proxies AI calls,
and streams responses back to the Electron app.
Runs on http://localhost:3000 during development.

---

## File Structure (MVP — nothing else)

```
apps/backend/
├── src/
│   ├── main.ts                    ← bootstrap, port 3000
│   ├── app.module.ts              ← root module
│   ├── database/
│   │   ├── db.ts                  ← neon client singleton
│   │   └── init.ts                ← CREATE TABLE IF NOT EXISTS
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts     ← POST /auth/login only
│   │   ├── auth.service.ts        ← login logic + JWT
│   │   └── jwt.strategy.ts        ← passport JWT
│   └── ai/
│       ├── ai.module.ts
│       ├── ai.controller.ts       ← POST /ai/stream + /ai/screenshot
│       └── ai.service.ts          ← DeepSeek + Qwen calls
├── .env                           ← secrets (never commit)
├── tsconfig.json
└── package.json
```

---

## The Three Endpoints (MVP — nothing else)

```
POST /auth/login
    Headers: X-Device-ID: <fingerprint>
    Body: { email: string, password: string }
    Returns: {
      accessToken: string,
      user: { id, email, name, username }
    }
    Auth: none (this IS the auth endpoint)

POST /ai/stream
    Headers: Authorization: Bearer <token>
             X-Device-ID: <fingerprint>
    Body: { transcript: string, sessionId?: string }
    Returns: text/event-stream
    Chunks: data: {"chunk":"word "}\n\n
    Final:  data: {"done":true}\n\n
    Auth: JwtAuthGuard

POST /ai/screenshot
    Headers: Authorization: Bearer <token>
             X-Device-ID: <fingerprint>
    Body: { image: string (base64), sessionId?: string }
    Returns: text/event-stream
    Same chunk format as /ai/stream
    Auth: JwtAuthGuard
```

---

## Database (Neon — direct SQL)

Driver: @neondatabase/serverless
No ORM. No Prisma. Raw SQL only.

```typescript
// database/db.ts
import { neon } from '@neondatabase/serverless';
let _sql: ReturnType<typeof neon> | null = null;
export function getDB() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql;
}
```

Tables needed for MVP:
```sql
-- users table (minimal)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  username TEXT UNIQUE,
  is_pro BOOLEAN DEFAULT true,  -- everyone is pro locally
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

That is the only table needed for local MVP.
Sessions, payments, referrals — all deferred.

---

## Auth (JWT — simple, long expiry for local)

```typescript
// JWT config for local development
{
  secret: process.env.JWT_SECRET,
  expiresIn: '30d',  // long expiry, no refresh token needed locally
}

// Token payload
{
  sub: userId,
  email: userEmail,
}
```

No refresh tokens for local MVP.
No device fingerprint binding.
Just: valid JWT = access granted.

---

## AI Service — Model Routing

```
Question type detection (simple keyword matching):
    coding/algorithm keywords  → deepseek-reasoner (R1)
    system design keywords     → deepseek-reasoner (R1)
    math/calculate keywords    → deepseek-reasoner (R1)
    everything else            → deepseek-chat (V3)

Screenshot:
    Step 1: Qwen VL reads the image → text description
    Step 2: deepseek-reasoner solves it (always R1 for screenshots)
```

---

## System Prompt (Generic — no CV for MVP)

```
You are ZoomGuru, an AI interview assistant.
Answer the following interview question clearly and confidently,
as if the user is speaking directly to the interviewer.
Be concise, specific, and professional.
For coding questions: show your approach first, then the code.
For behavioral questions: use the STAR format naturally.
For system design: structure your answer with components.
Keep answers focused — 3 to 6 sentences for most questions.
```

---

## SSE Streaming Format

Every streaming endpoint writes this exact format:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Access-Control-Allow-Origin: *

data: {"chunk":"First ","done":false}\n\n
data: {"chunk":"word ","done":false}\n\n
data: {"chunk":"arrives.","done":false}\n\n
data: {"done":true,"fullAnswer":"First word arrives."}\n\n
```

The renderer splits on `\n`, looks for lines starting with
`data: `, parses the JSON, appends chunk to answer state.

---

## CORS Configuration

For local development, allow everything:
```typescript
app.enableCors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'app://.',                // Electron production
  ],
  credentials: true,
});
```

---

## Environment Variables

```env
# apps/backend/.env
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/zoomguru?sslmode=require
JWT_SECRET=any_long_random_string_for_local_dev
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
QWEN_API_KEY=sk-xxxxxxxxxxxxxxxx
PORT=3000
NODE_ENV=development
```

Validation on startup:
```typescript
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'DEEPSEEK_API_KEY', 'QWEN_API_KEY'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing env vars:', missing);
  process.exit(1);
}
```

---

## main.ts (Local MVP)

```typescript
// Runs on port 3000
// Fastify adapter for speed
// No SSL locally
// CORS open for localhost

async function bootstrap() {
  // env validation first
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );
  app.enableCors({ origin: true, credentials: true });
  await initDB();
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log('ZoomGuru backend running on http://localhost:3000');
}
```

---

## Compiler Verification

After every generated file:
```bash
cd apps/backend
npx tsc --noEmit
```

Zero errors = ready.
