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

Stripe. No other provider.

Stripe concepts used:
- Stripe Customer (one per ZoomGuru user)
- Stripe Checkout Session (hosted payment page)
- Stripe Subscription (recurring billing object)
- Stripe Webhook (Stripe → backend event push)

---

## LAYER 1 — Database

### New table: subscriptions

Add to `apps/backend/src/database/init.ts` alongside the existing users table:

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'inactive',
  plan                    TEXT,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
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

One row per user. Insert on first checkout attempt.
Query by user_id. Never query by subscription_id directly from the app.

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
Auth:     JwtAuthGuard (Bearer token required)
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
  1. Get user id from JWT (req.user.sub)
  2. SELECT * FROM subscriptions WHERE user_id = $userId LIMIT 1
  3. If no row found: return { status: 'inactive', plan: null, daysRemaining: null, currentPeriodEnd: null }
  4. If row found:
       - daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd - now) / 86400000))
       - Return all four fields
```

---

### Endpoint 2: POST /subscription/checkout

```
Auth:     JwtAuthGuard (Bearer token required)
Headers:  Authorization: Bearer <token>
          X-Device-ID: <fingerprint>
          Content-Type: application/json
Body:     { plan: 'monthly' | 'annual' }

Response 200:
{
  checkoutUrl: string   ← Stripe hosted checkout URL, open in browser
}

Logic:
  1. Get user id and email from JWT (req.user.sub, req.user.email)
  2. SELECT stripe_customer_id FROM subscriptions WHERE user_id = $userId
  3. If no stripe_customer_id:
       - Create Stripe customer: stripe.customers.create({ email })
       - UPSERT into subscriptions (user_id, stripe_customer_id, status='inactive')
  4. Select correct price ID from env:
       plan === 'monthly' → process.env.STRIPE_PRICE_MONTHLY
       plan === 'annual'  → process.env.STRIPE_PRICE_ANNUAL
  5. Create Stripe Checkout Session:
       stripe.checkout.sessions.create({
         customer: stripeCustomerId,
         mode: 'subscription',
         line_items: [{ price: priceId, quantity: 1 }],
         success_url: process.env.STRIPE_SUCCESS_URL,
         cancel_url: process.env.STRIPE_CANCEL_URL,
       })
  6. Return { checkoutUrl: session.url }
```

---

### Endpoint 3: POST /subscription/webhook

```
Auth:     NONE — Stripe signs the request, verify signature instead
Headers:  stripe-signature: <sig>   ← provided by Stripe, read this header
Body:     raw Buffer (NOT parsed JSON — must be raw for signature verification)

Response 200: { received: true }   ← always return 200 to Stripe immediately

CRITICAL: This endpoint must receive the raw request body.
In NestJS/Fastify, add rawBody: true to the FastifyAdapter options in main.ts:
  new FastifyAdapter({ logger: false, rawBody: true })
Then access it as req.rawBody in the controller.

Events to handle (ignore all others silently):

  customer.subscription.created
  customer.subscription.updated
      → UPDATE subscriptions SET
            status = subscription.status,   ← map Stripe status to our status values
            plan = (price interval === 'month' ? 'monthly' : 'annual'),
            current_period_start = new Date(subscription.current_period_start * 1000),
            current_period_end   = new Date(subscription.current_period_end * 1000),
            stripe_subscription_id = subscription.id,
            updated_at = NOW()
          WHERE stripe_customer_id = subscription.customer

  customer.subscription.deleted
      → UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
          WHERE stripe_customer_id = subscription.customer

  invoice.payment_failed
      → UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
          WHERE stripe_customer_id = invoice.customer

Stripe status → our status mapping:
  'active'   → 'active'
  'past_due' → 'past_due'
  'canceled' → 'cancelled'   ← note: Stripe spells it with one 'l'
  anything else → 'inactive'

Signature verification (must do this before touching the DB):
  const event = stripe.webhooks.constructEvent(
    req.rawBody,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  )
  If constructEvent throws: return HTTP 400.
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
# Stripe
STRIPE_SECRET_KEY=sk_live_xxxx          ← from Stripe Dashboard → Developers → API Keys
STRIPE_WEBHOOK_SECRET=whsec_xxxx        ← from Stripe Dashboard → Webhooks → signing secret
STRIPE_PRICE_MONTHLY=price_xxxx         ← from Stripe Dashboard → Products → Monthly price ID
STRIPE_PRICE_ANNUAL=price_xxxx          ← from Stripe Dashboard → Products → Annual price ID
STRIPE_SUCCESS_URL=http://localhost:5173/payment-success
STRIPE_CANCEL_URL=http://localhost:5173/payment-cancel
```

Add all six to the startup validation array in main.ts:
```typescript
const REQUIRED = [
  'DATABASE_URL', 'JWT_SECRET', 'DEEPSEEK_API_KEY', 'QWEN_API_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_ANNUAL',
  'STRIPE_SUCCESS_URL', 'STRIPE_CANCEL_URL',
];
```

---

## New Backend Dependency

```bash
cd apps/backend
npm install stripe
```

The `stripe` npm package provides the official Stripe Node SDK.
Import as:
```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

Instantiate once in subscription.service.ts, not per-request.

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
apps/backend/src/main.ts                  ← add rawBody: true to FastifyAdapter
apps/backend/.env                         ← add 6 new vars
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
2. `npm install stripe`
3. `database/init.ts` — add subscriptions table
4. `subscription.module.ts`
5. `subscription.service.ts`
6. `subscription.controller.ts`
7. `app.module.ts` — register SubscriptionModule
8. `main.ts` — add rawBody: true
9. `npx tsc --noEmit` — must be 0 errors
10. Add env vars to .env

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
[ ] Complete Stripe checkout → webhook fires → DB row updated
[ ] Dashboard refresh → status shows 'active', green badge, real days remaining
[ ] Expired subscription → days remaining shows "Expired"
[ ] 401 on any call → logout fires
```

---

## Stripe Setup Steps (do before running backend session)

```
1. Create Stripe account at stripe.com
2. Dashboard → Products → Create product "ZoomGuru"
3. Add two prices:
       Monthly: recurring, your price, interval = month
       Annual:  recurring, your price, interval = year
4. Copy both price IDs (price_xxx) into .env
5. Dashboard → Developers → API Keys → copy Secret key into .env
6. Dashboard → Developers → Webhooks → Add endpoint:
       URL: use Stripe CLI for local testing (stripe listen --forward-to localhost:3000/subscription/webhook)
       Events to listen for:
           customer.subscription.created
           customer.subscription.updated
           customer.subscription.deleted
           invoice.payment_failed
7. Copy webhook signing secret (whsec_xxx) into .env
8. Install Stripe CLI locally for webhook forwarding during dev
```

---

## Stripe CLI Command for Local Webhook Testing

```bash
stripe listen --forward-to localhost:3000/subscription/webhook
```

Run this in a third terminal alongside backend and electron.
It proxies Stripe webhook events to your local server.
