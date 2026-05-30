import { Pool } from '@neondatabase/serverless';

let _pool: Pool | null = null;

export function getDB(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
  }
  return _pool;
}
