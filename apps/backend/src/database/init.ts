import { getDB } from './db';

export async function initDB(): Promise<void> {
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = 2000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const sql = getDB();

      await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email         TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name          TEXT,
          username      TEXT UNIQUE,
          is_pro        BOOLEAN DEFAULT true,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `;

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
