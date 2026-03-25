/**
 * Запуск SQL-скрипта миграции без psql.
 * Usage (из папки server):
 *   node scripts/apply-sql-migration.js db/migrations/eco-auth-dashboard.sql
 */
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getPool } from '../db.js';

async function main() {
  const sqlRelPath = process.argv[2] ?? 'db/migrations/eco-auth-dashboard.sql';
  const sqlPath = path.resolve(process.cwd(), sqlRelPath);

  const sql = await fs.readFile(sqlPath, 'utf8');
  const pool = getPool();

  try {
    await pool.query(sql);
    console.log(`OK: migration applied: ${sqlRelPath}`);
  } catch (err) {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  // Закрываем пул, чтобы процесс корректно завершился.
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});

