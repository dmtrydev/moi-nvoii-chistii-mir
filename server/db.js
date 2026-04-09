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
      // В pg_stat_activity видно, откуда коннект (отладка дублей init при рестартах).
      application_name: process.env.PG_APPLICATION_NAME || 'moinoviichistiimir-app',
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

/** Произвольная пара int4 для pg_advisory_lock (один глобальный init на БД). */
const SCHEMA_INIT_LOCK_K1 = 942_001;
const SCHEMA_INIT_LOCK_K2 = 942_002;

/**
 * Выполняет callback с одним выделенным клиентом и session-level advisory lock.
 * Второй процесс/контейнер ждёт здесь, а не запускает второй init.sql параллельно.
 */
export async function withAdvisorySchemaLock(run) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1::int, $2::int)', [SCHEMA_INIT_LOCK_K1, SCHEMA_INIT_LOCK_K2]);
    await run(client);
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1::int, $2::int)', [SCHEMA_INIT_LOCK_K1, SCHEMA_INIT_LOCK_K2]);
    } catch {
      /* ignore */
    }
    client.release();
  }
}

