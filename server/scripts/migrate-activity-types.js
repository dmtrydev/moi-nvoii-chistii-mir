/**
 * Миграция: добавить колонку activity_types в таблицу licenses.
 * Запуск: из папки server выполните:
 *   node scripts/migrate-activity-types.js
 * Убедитесь, что в .env задан DATABASE_URL.
 */
import 'dotenv/config';
import { query } from '../db.js';

async function migrate() {
  try {
    await query(`
      ALTER TABLE licenses
      ADD COLUMN IF NOT EXISTS activity_types TEXT[] NOT NULL DEFAULT '{}'
    `);
    console.log('Миграция выполнена: колонка activity_types добавлена (или уже существует).');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_licenses_activity_types_gin
      ON licenses USING GIN (activity_types)
    `);
    console.log('Индекс idx_licenses_activity_types_gin создан.');
  } catch (err) {
    console.error('Ошибка миграции:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
