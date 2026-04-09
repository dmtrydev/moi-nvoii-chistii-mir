import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL не задан');
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
      // Иначе при недоступной БД первый query() может висеть очень долго — HTTP не поднимется, снаружи будет connection refused.
      connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 15_000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

