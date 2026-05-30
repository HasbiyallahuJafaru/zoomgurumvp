# ZoomGuru — Payment Dashboard Spec
# Status: UI shell built. Backend + wiring NOT built.
# Read this entire file before writing a single line.

---

## What Already Exists (Do Not Rebuild)

```
apps/electron/src/dashboard/Dashboard.tsx
    ← UI shell complete. Mocked data only.
    ← Props: { onContinue: () => void; onLogout: () => void }
    ← Subscribe button is disabled, labelled "Subscribe — Coming soon"
    ← Status card shows static "No active plan", "—" days, "Monthly / Annual"

apps/electron/src/App.tsx
    ← Step type includes 'dashboard'
    ← Flow: login → dashboard → cv → overlay
    ← Register → dashboard → cv → overlay
    ← Token on load → dashboard (not cv)
```

---

## What Needs To Be Built (This Spec)

```
LAYER 1: Database
    New table: subscriptions

LAYER 2: Backend
    New module: apps/backend/src/subscription/
    New endpoints: GET /subscription/status
                   POST /subscription/checkout
                   POST /subscription/webhook

LAYER 3: IPC Bridge
    New channel: open-external
    Touches: main.ts, preload.ts, global.d.ts

LAYER 4: Dashboard.tsx
    Replace mocked data with real API calls
    Wire Subscribe button to checkout flow
```

Build in this exact order. Never jump ahead.

---

## Payment Provider

Paystack. No other provider.

Paystack concepts used:
- Paystack Customer (one per ZoomGuru user, identified by customer_code)
- Paystack Transaction Initialize (returns authorization_url — hosted payment page)
- Paystack Subscription (recurring billing object, identified by subscription_code)
- Paystack Webhook (Paystack → backend event push, verified with HMAC SHA512)

Pricing:
- Monthly plan: 50,000 NGN per month
- In Paystack, all amounts are in kobo: 50,000 NGN = 5,000,000 kobo
- Plans are created in the Paystack dashboard and referenced by plan_code

No Paystack npm package is required. All API calls use Node's global fetch
(available in Node 18+). No new dependency needs to be installed.

---

## LAYER 1 — Database

### New table: subscriptions

Add to `apps/backend/src/database/init.ts` alongside the existing users table:

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                      TEXT NOT NULL DEFAULT 'inactive',
  plan                        TEXT,
  current_period_start        TIMESTAMPTZ,
  current_period_end          TIMESTAMPTZ,
  paystack_customer_code      TEXT UNIQUE,
  paystack_subscription_code  TEXT UNIQUE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

### status values (exhaustive — no others)

```
'inactive'   — no subscription, never paid
'active'     — paid, within billing period
'past_due'   — payment failed, grace period
'cancelled'  — cancelled, access until period end
```

### Relationship

One row per user (enforced by UNIQUE on user_id).
Insert on first checkout attempt.
Query by user_id. Never query by subscription_code directly from the app.

---

## LAYER 2 — Backend

### New files to create

```
apps/backend/src/subscription/
├── subscription.module.ts
├── subscription.controller.ts
└── subscription.service.ts
```

### Register the module

In `apps/backend/src/app.module.ts`, import and add SubscriptionModule
to the imports array alongside AuthModule and AiModule.

---

### Endpoint 1: GET /subscription/status

```
Auth:     AuthGuard('jwt') (Bearer token required)
Headers:  Authorization: Bearer <token>
          X-Device-ID: <fingerprint>
Body:     none

Response 200:
{
  status: 'inactive' | 'active' | 'past_due' | 'cancelled',
  plan: 'monthly' | 'annual' | null,
  daysRemaining: number | null,
  currentPeriodEnd: string | null   ← ISO 8601 date string, e.g. "2025-06-30T00:00:00.000Z"
}

Logic:
  1. Get user id from JWT (req.user.userId — note: JwtStrategy.validate returns { userId, email })
  2. SELECT * FROM subscriptions WHERE user_id = $userId LIMIT 1
  3. If no row found: return { status: 'inactive', plan: null, daysRemaining: null, currentPeriodEnd: null }
  4. If row found:
       - daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd - now) / 86400000))
       - Return all four fields
```

---

### Endpoint 2: POST /subscription/checkout

```
Auth:     AuthGuard('jwt') (Bearer token required)
Headers:  Authorization: Bearer <token>
          X-Device-ID: <fingerprint>
          Content-Type: application/json
Body:     { plan: 'monthly' | 'annual' }

Response 200:
{
  checkoutUrl: string   ← Paystack authorization_url, open in browser
}

Logic:
  1. Get user id and email from JWT (req.user.userId, req.user.email)
  2. SELECT paystack_customer_code FROM subscriptions WHERE user_id = $userId
  3. If no paystack_customer_code:
       - Create Paystack customer:
           POST https://api.paystack.co/customer
           Authorization: Bearer PAYSTACK_SECRET_KEY
           Body: { email }
           → response.data.customer_code
       - UPSERT into subscriptions (user_id, paystack_customer_code, status='inactive')
           ON CONFLICT (user_id) DO UPDATE SET paystack_customer_code = $code
  4. Select correct plan code from env:
       plan === 'monthly' → process.env.PAYSTACK_PLAN_MONTHLY
       plan === 'annual'  → process.env.PAYSTACK_PLAN_ANNUAL
  5. Initialize Paystack transaction:
       POST https://api.paystack.co/transaction/initialize
       Authorization: Bearer PAYSTACK_SECRET_KEY
       Body: {
         email,
         amount: 5000000,   ← 50,000 NGN in kobo (matches the plan price)
         plan: planCode,
         callback_url: process.env.PAYSTACK_SUCCESS_URL,
         metadata: { user_id: userId },
       }
       → response.data.authorization_url
  6. Return { checkoutUrl: authorization_url }
```

---

### Endpoint 3: POST /subscription/webhook

```
Auth:     NONE — Paystack signs the request, verify signature instead
Headers:  x-paystack-signature: <sig>   ← provided by Paystack, read this header
Body:     raw Buffer (NOT parsed JSON — must be raw for signature verification)

Response 200: { received: true }   ← always return 200 to Paystack immediately

CRITICAL: This endpoint must receive the raw request body.
In NestJS/Fastify, add rawBody: true to the FastifyAdapter options in main.ts:
  new FastifyAdapter({ logger: false, rawBody: true })
Then access it as req.rawBody in the controller.

Signature verification (HMAC SHA512 — must do before touching the DB):
  import crypto from 'node:crypto';
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(req.rawBody)
    .digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    return HTTP 400;
  }

Events to handle (ignore all others silently):

  subscription.create
      → UPDATE subscriptions SET
            status = 'active',
            plan = (data.plan.interval === 'monthly' ? 'monthly' : 'annual'),
            paystack_subscription_code = data.subscription_code,
            current_period_start = new Date(data.created_at),
            current_period_end   = new Date(data.next_payment_date),
            updated_at = NOW()
          WHERE paystack_customer_code = data.customer.customer_code

  subscription.disable
  subscription.not_renew
      → UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
          WHERE paystack_customer_code = data.customer.customer_code

  invoice.update   (fires on successful renewal payment)
      → Only act if data.paid_at is set (i.e. invoice was paid):
        UPDATE subscriptions SET
            status = 'active',
            current_period_start = new Date(data.paid_at),
            current_period_end   = new Date(data.subscription.next_payment_date),
            updated_at = NOW()
          WHERE paystack_customer_code = data.subscription.customer.customer_code

  invoice.payment_failed
      → UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
          WHERE paystack_customer_code = data.subscription.customer.customer_code

Paystack subscription status → our status mapping:
  subscription.create fires  → 'active'
  subscription.disable fires → 'cancelled'
  subscription.not_renew fires → 'cancelled'   ← Paystack spelling
  invoice.payment_failed fires → 'past_due'
  invoice.update with paid_at → 'active'
```

---

## LAYER 3 — IPC Bridge

The Subscribe button needs to open a browser URL from inside Electron.
This requires a new IPC channel in all four places.

### 1. main.ts — add handler

```typescript
import { shell } from 'electron';

ipcMain.handle('open-external', (_event, url: string) => {
  void shell.openExternal(url);
});
```

### 2. preload.ts — expose on bridge

```typescript
openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
```

### 3. global.d.ts — add to ZoomGuruBridge interface

```typescript
openExternal(url: string): Promise<void>;
```

### 4. Dashboard.tsx — call site (see Layer 4)

```typescript
await window.zoomguru.openExternal(checkoutUrl);
```

All four must exist or none of them work.

---

## LAYER 4 — Dashboard.tsx (replace mocked data)

### New imports needed

```typescript
import { useState, useEffect, type CSSProperties } from 'react';
```

### New state

```typescript
type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

interface SubData {
  status: SubStatus;
  plan: 'monthly' | 'annual' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
}

const [sub, setSub] = useState<SubData | null>(null);
const [loadingSub, setLoadingSub] = useState(true);
const [checkingOut, setCheckingOut] = useState(false);
const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
```

### Fetch subscription status on mount

```typescript
useEffect(() => {
  void (async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const deviceId = await window.zoomguru.getDeviceId();
      const res = await fetch(`${API_URL}/subscription/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
      });
      if (res.status === 401) { onLogout(); return; }
      if (res.ok) {
        const data = await res.json() as SubData;
        setSub(data);
      }
    } finally {
      setLoadingSub(false);
    }
  })();
}, []);
```

### Subscribe button handler

```typescript
async function handleSubscribe(): Promise<void> {
  setCheckingOut(true);
  try {
    const token = localStorage.getItem('access_token') || '';
    const deviceId = await window.zoomguru.getDeviceId();
    const res = await fetch(`${API_URL}/subscription/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify({ plan: selectedPlan }),
    });
    if (res.status === 401) { onLogout(); return; }
    if (!res.ok) return;
    const data = await res.json() as { checkoutUrl: string };
    await window.zoomguru.openExternal(data.checkoutUrl);
  } finally {
    setCheckingOut(false);
  }
}
```

### Status card display logic

```
loadingSub === true         → show "Loading…" in each card row
sub === null                → show "—" in each card row
sub.status === 'inactive'   → Status: "No active plan" (dim badge)
sub.status === 'active'     → Status: "Active" (green badge)
sub.status === 'past_due'   → Status: "Payment overdue" (red badge)
sub.status === 'cancelled'  → Status: "Cancelled" (dim badge)

sub.plan === 'monthly'      → Billing: "Monthly"
sub.plan === 'annual'       → Billing: "Annual"
sub.plan === null           → Billing: "—"

sub.daysRemaining === null  → Days remaining: "—"
sub.daysRemaining === 0     → Days remaining: "Expired"
sub.daysRemaining > 0       → Days remaining: "${sub.daysRemaining} days"
```

### Subscribe button states

```
loadingSub === true                        → disabled, label: "Loading…"
sub?.status === 'active'                   → disabled, label: "Active subscription"
checkingOut === true                       → disabled, label: "Opening…"
otherwise                                  → enabled, label: "Subscribe"
```

### Plan selector (show only when status is not 'active')

Two toggle buttons above the Subscribe button:
- Monthly | Annual
- Selected plan has white background, unselected is transparent
- onClick sets selectedPlan state
- Hide entirely when sub?.status === 'active'

---

## New Environment Variables (backend .env)

```env
# Paystack
PAYSTACK_SECRET_KEY=sk_live_xxxx          ← from Paystack Dashboard → Settings → API Keys & Webhooks
PAYSTACK_PLAN_MONTHLY=PLN_xxxx            ← from Paystack Dashboard → Products → Plans → Monthly plan code
PAYSTACK_PLAN_ANNUAL=PLN_xxxx             ← from Paystack Dashboard → Products → Plans → Annual plan code
PAYSTACK_SUCCESS_URL=http://localhost:5173/payment-success
```

Add all four to the startup validation array in main.ts:
```typescript
const REQUIRED = [
  'DATABASE_URL', 'JWT_SECRET', 'DEEPSEEK_API_KEY', 'QWEN_API_KEY',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PLAN_MONTHLY', 'PAYSTACK_PLAN_ANNUAL',
  'PAYSTACK_SUCCESS_URL',
];
```

Note: Paystack webhook signature verification uses PAYSTACK_SECRET_KEY (same key
as the API key). There is no separate webhook signing secret.

---

## No New Backend Dependency

No npm package installation required.
All Paystack API calls use the global fetch() built into Node 18+.
Do NOT install any paystack npm package.

API calls in subscription.service.ts use this pattern:
```typescript
const res = await fetch('https://api.paystack.co/...', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ... }),
});
const data = await res.json() as { data: { ... } };
```

Webhook signature verification uses Node's built-in crypto module:
```typescript
import crypto from 'node:crypto';
const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
  .update(rawBody)
  .digest('hex');
```

---

## Files to Touch — Exhaustive List

### Backend session (do this first, in order)

```
apps/backend/src/database/init.ts         ← add subscriptions table CREATE
apps/backend/src/subscription/            ← create this directory
apps/backend/src/subscription/subscription.module.ts    ← new file
apps/backend/src/subscription/subscription.service.ts   ← new file
apps/backend/src/subscription/subscription.controller.ts ← new file
apps/backend/src/app.module.ts            ← import SubscriptionModule
apps/backend/src/main.ts                  ← add rawBody: true to FastifyAdapter, add Paystack env vars to REQUIRED
apps/backend/.env                         ← add 4 new vars
```

### Electron session (do this second, after backend passes tsc)

```
apps/electron/electron/main.ts            ← add open-external handler
apps/electron/electron/preload.ts         ← expose openExternal
apps/electron/src/global.d.ts             ← add openExternal to ZoomGuruBridge
apps/electron/src/dashboard/Dashboard.tsx ← replace mocked data with real calls
```

---

## Build Order Within Each Session

### Backend session

1. Run `npx tsc --noEmit` — establish baseline (should be 0 errors)
2. `database/init.ts` — add subscriptions table
3. `subscription.module.ts`
4. `subscription.service.ts`
5. `subscription.controller.ts`
6. `app.module.ts` — register SubscriptionModule
7. `main.ts` — add rawBody: true, add Paystack vars to REQUIRED
8. `npx tsc --noEmit` — must be 0 errors
9. Add env vars to .env

### Electron session (separate session, after backend is done)

1. Run `npx tsc --noEmit` — establish baseline
2. `main.ts` — open-external handler
3. `preload.ts` — openExternal
4. `global.d.ts` — ZoomGuruBridge extension
5. `npx tsc --noEmit` — must be 0 errors (IPC chain verified)
6. `Dashboard.tsx` — replace mocked data, wire Subscribe
7. `npx tsc --noEmit` — must be 0 errors

---

## Testing Checklist (after both sessions complete)

```
[ ] GET /subscription/status with valid JWT → { status: 'inactive', ... }
[ ] Dashboard mounts → card populates with real data (not mocked)
[ ] Subscribe button → POST /subscription/checkout → returns checkoutUrl
[ ] checkoutUrl opens in browser (not inside Electron)
[ ] Complete Paystack checkout → webhook fires → DB row updated
[ ] Dashboard refresh → status shows 'active', green badge, real days remaining
[ ] Expired subscription → days remaining shows "Expired"
[ ] 401 on any call → logout fires
[ ] POST /subscription/webhook with wrong signature → HTTP 400
```

---

## Paystack Setup Steps (do before running backend session)

```
1. Create Paystack account at paystack.com
2. Dashboard → Products → Plans → Create plan "ZoomGuru Monthly"
       Amount: 50,000 NGN
       Interval: Monthly
   Copy the plan_code (PLN_xxx) into .env as PAYSTACK_PLAN_MONTHLY

3. (Optional) Create plan "ZoomGuru Annual"
       Amount: your annual price in NGN
       Interval: Annually
   Copy the plan_code into .env as PAYSTACK_PLAN_ANNUAL

4. Dashboard → Settings → API Keys & Webhooks
       Copy the Secret Key (sk_live_xxx or sk_test_xxx) into .env as PAYSTACK_SECRET_KEY

5. Dashboard → Settings → API Keys & Webhooks → Webhooks
       Add webhook URL: use ngrok for local testing (see below)
       Events to listen for:
           subscription.create
           subscription.disable
           subscription.not_renew
           invoice.update
           invoice.payment_failed
```

---

## ngrok Command for Local Webhook Testing

Paystack does not have its own CLI for forwarding webhooks.
Use ngrok to expose localhost:3000 to the internet during development:

```bash
ngrok http 3000
```

ngrok will print a public URL like https://abc123.ngrok.io
Set the Paystack webhook URL to: https://abc123.ngrok.io/subscription/webhook

Run ngrok in a third terminal alongside backend and electron.

Note: The ngrok URL changes on every restart (free tier).
Update the Paystack webhook URL in the dashboard whenever you restart ngrok.
