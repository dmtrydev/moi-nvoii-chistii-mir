/**
 * Репозиторий для таблицы `rpn_registry_snapshot`.
 * Содержит:
 *   - bulk upsert (батчи по 500 строк, как в insertSiteFkkoActivitiesBatch);
 *   - чтение снапшота по ИНН (для расширения карточки лицензии);
 *   - подбор ИНН для очередного цикла синхронизации с приоритизацией.
 */
import { LICENSE_INN_NORMALIZED_EXPR, normalizeInn } from './innUtils.js';

/** Максимальное число строк в одном INSERT (10 параметров на строку → ~5000 параметров). */
const UPSERT_CHUNK = 500;

/**
 * Bulk upsert снапшотов. Идемпотентен: повторный вызов перезапишет поля и обновит synced_at.
 *
 * @param {import('pg').PoolClient | import('pg').Pool} client
 * @param {Array<{
 *   innNorm: string,
 *   licenseNumber: string | null,
 *   dateIssued: string | null,
 *   registryStatus: string,
 *   registryStatusRu: string | null,
 *   registryInactive: boolean,
 *   unitShortName: string | null,
 *   registryModifiedAt: string | null,
 *   ppsDeadlineAt: string | null,
 *   rawJson: object,
 * }>} rows
 * @returns {Promise<{ inserted: number, updated: number, total: number }>}
 */
export async function upsertSnapshotsBatch(client, rows) {
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    if (chunk.length === 0) continue;
    const valSql = [];
    const params = [];
    let p = 1;
    for (const r of chunk) {
      valSql.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},NOW())`,
      );
      params.push(
        r.innNorm,
        r.licenseNumber,
        r.dateIssued,
        r.registryStatus,
        r.registryStatusRu,
        Boolean(r.registryInactive),
        r.unitShortName,
        r.registryModifiedAt,
        r.ppsDeadlineAt,
        r.rawJson != null ? JSON.stringify(r.rawJson) : null,
      );
    }
    // RETURNING (xmax = 0) даёт TRUE на INSERT и FALSE на UPDATE — стандартный приём в Postgres.
    const sql = `
      INSERT INTO rpn_registry_snapshot
        (inn_norm, license_number, date_issued, registry_status, registry_status_ru,
         registry_inactive, unit_short_name, registry_modified_at, pps_deadline_at, raw_json,
         synced_at)
      VALUES ${valSql.join(',')}
      ON CONFLICT (inn_norm) DO UPDATE SET
        license_number       = EXCLUDED.license_number,
        date_issued          = EXCLUDED.date_issued,
        registry_status      = EXCLUDED.registry_status,
        registry_status_ru   = EXCLUDED.registry_status_ru,
        registry_inactive    = EXCLUDED.registry_inactive,
        unit_short_name      = EXCLUDED.unit_short_name,
        registry_modified_at = EXCLUDED.registry_modified_at,
        pps_deadline_at      = EXCLUDED.pps_deadline_at,
        raw_json             = EXCLUDED.raw_json,
        synced_at            = NOW()
      RETURNING (xmax = 0) AS is_insert
    `;
    const res = await client.query(sql, params);
    for (const row of res.rows) {
      if (row.is_insert) inserted += 1;
      else updated += 1;
    }
  }
  return { inserted, updated, total: rows.length };
}

/**
 * @param {import('pg').PoolClient | import('pg').Pool} client
 * @param {string} innNorm
 */
export async function fetchSnapshotByInn(client, innNorm) {
  const inn = normalizeInn(innNorm);
  if (!inn) return null;
  const res = await client.query(
    `SELECT inn_norm AS "innNorm",
            license_number AS "licenseNumber",
            date_issued AS "dateIssued",
            registry_status AS "registryStatus",
            registry_status_ru AS "registryStatusRu",
            registry_inactive AS "registryInactive",
            unit_short_name AS "unitShortName",
            registry_modified_at AS "registryModifiedAt",
            pps_deadline_at AS "ppsDeadlineAt",
            synced_at AS "syncedAt"
     FROM rpn_registry_snapshot
     WHERE inn_norm = $1
     LIMIT 1`,
    [inn],
  );
  return res.rows[0] ?? null;
}

/**
 * Список ИНН для очередного цикла синхронизации с приоритизацией.
 *
 * Приоритеты:
 *   HIGH   — ИНН из licenses, по которому ещё нет ни одного снапшота;
 *   MEDIUM — снапшот есть, registry_status = 'active', synced_at старше staleDays;
 *   LOW    — снапшот есть, registry_status != 'active', synced_at старше staleDays * 4
 *            (неактивные обновляем реже).
 *
 * @param {import('pg').PoolClient | import('pg').Pool} client
 * @param {object} [opts]
 * @param {number} [opts.limit=10000]
 * @param {number} [opts.staleDays=7]
 * @returns {Promise<{
 *   inns: string[],
 *   counts: { high: number, medium: number, low: number, total: number },
 * }>}
 */
export async function selectInnsToSync(client, opts = {}) {
  const limit = Math.max(1, Math.min(Number(opts.limit) || 10_000, 200_000));
  const staleDays = Math.max(1, Math.min(Number(opts.staleDays) || 7, 365));
  const inn = LICENSE_INN_NORMALIZED_EXPR;

  // Используем DISTINCT по нормализованному ИНН — у одной компании может быть несколько лицензий.
  // Сортировка: HIGH (нет снапшота) → MEDIUM (active stale) → LOW (inactive stale).
  const sql = `
    WITH all_inns AS (
      SELECT DISTINCT ${inn} AS inn_norm
      FROM licenses
      WHERE deleted_at IS NULL
        AND length(${inn}) IN (10, 12)
    )
    SELECT a.inn_norm,
           CASE
             WHEN s.inn_norm IS NULL THEN 'high'
             WHEN s.registry_status = 'active'
                  AND s.synced_at < NOW() - ($1::int * INTERVAL '1 day') THEN 'medium'
             WHEN COALESCE(s.registry_status, '') <> 'active'
                  AND s.synced_at < NOW() - (($1::int * 4) * INTERVAL '1 day') THEN 'low'
             ELSE 'fresh'
           END AS priority,
           s.synced_at
    FROM all_inns a
    LEFT JOIN rpn_registry_snapshot s ON s.inn_norm = a.inn_norm
    WHERE s.inn_norm IS NULL
       OR (s.registry_status = 'active'
           AND s.synced_at < NOW() - ($1::int * INTERVAL '1 day'))
       OR (COALESCE(s.registry_status, '') <> 'active'
           AND s.synced_at < NOW() - (($1::int * 4) * INTERVAL '1 day'))
    ORDER BY
      CASE
        WHEN s.inn_norm IS NULL THEN 0
        WHEN s.registry_status = 'active' THEN 1
        ELSE 2
      END ASC,
      s.synced_at ASC NULLS FIRST
    LIMIT $2::int
  `;
  const res = await client.query(sql, [staleDays, limit]);
  const inns = res.rows.map((r) => String(r.inn_norm));
  const counts = { high: 0, medium: 0, low: 0, total: inns.length };
  for (const r of res.rows) {
    if (r.priority === 'high') counts.high += 1;
    else if (r.priority === 'medium') counts.medium += 1;
    else if (r.priority === 'low') counts.low += 1;
  }
  return { inns, counts };
}

/**
 * Сводная статистика snapshot для админки и мониторинга.
 *
 * @param {import('pg').PoolClient | import('pg').Pool} client
 */
export async function getSnapshotStats(client) {
  const res = await client.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE registry_status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE registry_inactive = TRUE)::int AS inactive,
       COUNT(*) FILTER (WHERE pps_deadline_at IS NOT NULL
                          AND pps_deadline_at < NOW() + INTERVAL '30 days'
                          AND pps_deadline_at >= NOW())::int AS "expiringIn30d",
       COUNT(*) FILTER (WHERE pps_deadline_at IS NOT NULL
                          AND pps_deadline_at < NOW())::int AS "alreadyExpired",
       MAX(synced_at) AS "lastSyncedAt",
       MIN(synced_at) AS "oldestSyncedAt"
     FROM rpn_registry_snapshot`,
  );
  return res.rows[0] ?? null;
}
