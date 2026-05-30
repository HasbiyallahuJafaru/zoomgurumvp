import { getDB } from './db';

export async function initDB(): Promise<void> {
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = 2000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const pool = getDB();

      await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email         TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name          TEXT,
          username      TEXT UNIQUE,
          is_pro        BOOLEAN DEFAULT true,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id                     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status                      TEXT NOT NULL DEFAULT 'inactive'
                                        CHECK (status IN ('inactive', 'active', 'past_due', 'cancelled')),
          plan                        TEXT,
          current_period_start        TIMESTAMPTZ,
          current_period_end          TIMESTAMPTZ,
          paystack_customer_code      TEXT UNIQUE,
          paystack_subscription_code  TEXT UNIQUE,
          created_at                  TIMESTAMPTZ DEFAULT NOW(),
          updated_at                  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await Promise.all([
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_subscriptions_status
            ON subscriptions(status)
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
            ON subscriptions(current_period_end)
            WHERE current_period_end IS NOT NULL
        `),
      ]);

      console.log('✅ ZoomGuru DB ready');
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS));
      }
    }
  }

  throw lastError;
}
