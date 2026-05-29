# ZoomGuru MVP — Database

## Driver
@neondatabase/serverless — direct SQL, no ORM, no Prisma.

---

## MVP Schema (One Table Only)

```sql
-- Run once on backend startup via initDB()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  username      TEXT UNIQUE,
  is_pro        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

That is the entire MVP schema.
No sessions table. No payments. No licenses.
Add those after core flows work.

---

## db.ts — Singleton Client

```typescript
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDB(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
```

---

## init.ts — Auto Schema on Boot

```typescript
import { getDB } from './db';

export async function initDB(): Promise<void> {
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
}
```

---

## Common Queries

```typescript
// Find user by email or username
const [user] = await sql`
  SELECT id, email, name, username, password_hash, is_pro
  FROM users
  WHERE email = ${identifier}
  OR username = ${identifier}
  LIMIT 1
`;

// Create user
const [user] = await sql`
  INSERT INTO users (email, password_hash, name, username)
  VALUES (${email}, ${hash}, ${name}, ${username})
  RETURNING id, email, name, username
`;
```

---

## Neon Connection String Format

```
postgresql://username:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
```

Get from: console.neon.tech → your project → Connection Details.
Copy the connection string exactly. Include ?sslmode=require.

---

## Creating Your First Admin User

After backend starts, run this in Neon SQL Editor:

```sql
-- Insert yourself as the first user
INSERT INTO users (email, password_hash, name, username, is_pro)
VALUES (
  'your@email.com',
  crypt('yourpassword', gen_salt('bf')),
  'Your Name',
  'yourusername',
  true
);
```

Or use the /auth/register endpoint if you build it.
For local MVP, manual insert is fine.
