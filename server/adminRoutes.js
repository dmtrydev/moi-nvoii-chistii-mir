import express from 'express';
import { query } from './db.js';
import { getPool } from './db.js';
import { requireRole } from './auth.js';
import { createAuditLog } from './audit.js';
import { LICENSE_INN_NORMALIZED_EXPR, normalizeInn, DUPLICATE_INN_MESSAGE } from './innUtils.js';
import { parseFkkoInput } from './fkkoServer.js';
import {
  parseActivityTypesInput,
  normalizeAdminSitesWithIds,
  aggregateFkkoAndActivityFromSites,
} from './licensePayloadNormalize.js';
import { fetchLicenseExtendedJson } from './licenseExtendedFetch.js';
import { approveLicenseInTx, ApproveLicenseError } from './licenseApprove.js';
import { runBatchAiApproveChunk } from './moderationBatch.js';
import {
  runFkkoOfficialTitlesSyncJob,
  getFkkoTitlesSyncStatus,
  isFkkoTitlesSyncRunning,
} from './fkkoTitlesSync.js';
import { upsertFkkoOfficialTitles } from './fkkoOfficialTitles.js';
import { fetchGroroObjectById } from './groroParser.js';
import { enrichFromRusprofile } from './rusprofileEnrich.js';
import { upsertGroroObject } from './groroStore.js';

const adminRouter = express.Router();
const requireSuperadminOnly = requireRole('SUPERADMIN');

const MAX_ADMIN_SEARCH_TOKENS = 12;
const MAX_ADMIN_SEARCH_TOKEN_LEN = 80;
const ADMIN_LICENSES_DEFAULT_LIMIT = 50;
const ADMIN_LICENSES_MAX_LIMIT = 100;

function tokenizeAdminLicenseSearch(q) {
  const s = String(q ?? '').trim();
  if (!s) return [];
  return s
    .split(/\s+/u)
    .map((t) => t.slice(0, MAX_ADMIN_SEARCH_TOKEN_LEN).toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_ADMIN_SEARCH_TOKENS);
}

/**
 * Подстрочный поиск через ILIKE.
 * Семантика совпадает с прошлым POSITION(... in lower(...)) > 0,
 * но оставляет БД возможность использовать trigram-индексы.
 */
function sqlAdminLicenseTokenClause(paramPlaceholder) {
  return `(
    lower(coalesce(company_name, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(inn, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(address, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(region, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(import_source, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(file_original_name, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(file_stored_name, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(moderated_comment, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(coalesce(rejection_note, '')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(cast(id as text)) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(array_to_string(fkko_codes, ' ')) LIKE '%' || ${paramPlaceholder} || '%'
    OR lower(array_to_string(activity_types, ' ')) LIKE '%' || ${paramPlaceholder} || '%'
    OR exists (
      select 1 from license_sites s
      where s.license_id = licenses.id
        and (
          lower(coalesce(s.address, '')) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(coalesce(s.region, '')) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(coalesce(s.site_label, '')) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(array_to_string(s.fkko_codes, ' ')) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(array_to_string(s.activity_types, ' ')) LIKE '%' || ${paramPlaceholder} || '%'
        )
    )
    OR exists (
      select 1 from license_sites s
      inner join site_fkko_activities sfa on sfa.site_id = s.id
      where s.license_id = licenses.id
        and (
          lower(sfa.fkko_code) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(coalesce(sfa.waste_name, '')) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(coalesce(sfa.activity_type, '')) LIKE '%' || ${paramPlaceholder} || '%'
          or lower(coalesce(sfa.hazard_class, '')) LIKE '%' || ${paramPlaceholder} || '%'
        )
    )
  )`;
}

adminRouter.use(requireRole('MODERATOR'));

adminRouter.get('/stats/summary', async (req, res) => {
  const { from, to } = req.query;
  const fromTs = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const toTs = to || new Date().toISOString();

  const [{ rows: licensesByDay }, { rows: moderationQueue }, { rows: registryInactiveRows }] =
    await Promise.all([
      query(
        `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS count
         FROM licenses
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY day
         ORDER BY day ASC`,
        [fromTs, toTs],
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
           COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
         FROM licenses`,
        [],
      ),
      query(
        `SELECT COUNT(*)::int AS c
         FROM licenses
         WHERE import_source = 'rpn_registry'
           AND import_registry_inactive = TRUE`,
        [],
      ),
    ]);

  res.json({
    licensesByDay,
    moderation: moderationQueue[0] ?? { pending: 0, approved: 0, rejected: 0 },
    registryInactiveLicensesCount: registryInactiveRows[0]?.c ?? 0,
  });
});

adminRouter.get('/logs', async (req, res) => {
  const { limit = 50, offset = 0, action, severity } = req.query;
  const where = [];
  const params = [];
  let i = 1;

  if (action) {
    where.push(`action = $${i++}`);
    params.push(String(action));
  }
  if (severity) {
    where.push(`severity = $${i++}`);
    params.push(String(severity));
  }

  params.push(Number(limit));
  params.push(Number(offset));

  const rows = await query(
    `SELECT id, user_id AS "userId", session_id AS "sessionId", action, entity_type AS "entityType",
            entity_id AS "entityId", severity, ip_address AS "ipAddress", user_agent AS "userAgent",
            changes, metadata, created_at AS "createdAt"
     FROM audit_logs
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    params,
  );

  res.json({ items: rows.rows });
});

adminRouter.get('/users', requireSuperadminOnly, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id,
              email,
              full_name AS "fullName",
              role,
              is_active AS "isActive",
              created_at AS "createdAt"
       FROM users
       ORDER BY created_at DESC`,
      [],
    );
    return res.json({ items: rows });
  } catch (err) {
    console.error('admin users list error:', err);
    return res.status(500).json({ message: 'Ошибка загрузки пользователей' });
  }
});

adminRouter.patch('/users/:id/role', requireSuperadminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const nextRole = String(req.body?.role ?? '').trim().toUpperCase();
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id пользователя' });
  }
  if (nextRole !== 'USER' && nextRole !== 'MODERATOR') {
    return res.status(400).json({ message: 'Разрешены роли только USER и MODERATOR' });
  }
  if (Number(req.user?.id) === id) {
    return res.status(400).json({ message: 'Нельзя менять роль самому себе' });
  }

  const beforeResult = await query(
    `SELECT id, email, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  if (!beforeResult.rows.length) {
    return res.status(404).json({ message: 'Пользователь не найден' });
  }
  const before = beforeResult.rows[0];

  const updated = await query(
    `UPDATE users
     SET role = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, full_name AS "fullName", role, is_active AS "isActive", created_at AS "createdAt"`,
    [id, nextRole],
  );

  await createAuditLog({
    req,
    action: 'USER_ROLE_UPDATE',
    entityType: 'USER',
    entityId: String(id),
    severity: 'INFO',
    changes: { before, after: { id: updated.rows[0].id, role: updated.rows[0].role } },
  });

  return res.json({ user: updated.rows[0] });
});

// Сводная статистика по объектам (не удалённые)
adminRouter.get('/licenses/stats', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'recheck')::int AS recheck,
         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
         COUNT(*) FILTER (
           WHERE status = 'rejected' AND rejection_note ~ '^\\[ИИ\\]'
         )::int AS "rejectedByAi"
       FROM licenses
       WHERE deleted_at IS NULL`,
      [],
    );
    const s = rows[0] ?? {};
    return res.json({
      total: s.total ?? 0,
      pending: s.pending ?? 0,
      recheck: s.recheck ?? 0,
      approved: s.approved ?? 0,
      rejected: s.rejected ?? 0,
      rejectedByAi: s.rejectedByAi ?? 0,
    });
  } catch (err) {
    console.error('licenses/stats error:', err);
    return res.status(500).json({ message: 'Ошибка статистики' });
  }
});

// Админский список лицензий (для управления объектами)
adminRouter.get('/licenses', async (req, res) => {
  const {
    includeDeleted = 'false',
    limit = 50,
    offset = 0,
    status: statusQ,
    importSource: importSourceQ,
    importRegistryStatus: importRegistryStatusQ,
    importRegistryInactive: importRegistryInactiveQ,
    importNeedsReview: importNeedsReviewQ,
    q: searchQ,
  } = req.query;
  const showDeleted = String(includeDeleted).toLowerCase() === 'true';
  const statusStr = String(statusQ ?? '').toLowerCase();
  const statusFilter =
    statusStr === 'pending' ||
    statusStr === 'recheck' ||
    statusStr === 'approved' ||
    statusStr === 'rejected'
      ? statusStr
      : null;

  const importSourceStr = String(importSourceQ ?? '').trim();
  const importRegistryStatusStr = String(importRegistryStatusQ ?? '').trim().toLowerCase();
  const allowedRegistryStatuses = new Set([
    'active',
    'annulled',
    'paused',
    'pausedpart',
    'terminated',
    'unknown',
  ]);
  const importRegistryStatusFilter = allowedRegistryStatuses.has(importRegistryStatusStr)
    ? importRegistryStatusStr
    : null;
  const registryInactiveOnly = String(importRegistryInactiveQ ?? '').toLowerCase() === 'true';
  const needsReviewOnly = String(importNeedsReviewQ ?? '').toLowerCase() === 'true';
  const rawLimit = Number(limit);
  const rawOffset = Number(offset);
  const safeLimit = Number.isFinite(rawLimit)
    ? Math.min(ADMIN_LICENSES_MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)))
    : ADMIN_LICENSES_DEFAULT_LIMIT;
  const safeOffset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0;

  const whereParts = [];
  const listParams = [];
  let pi = 1;
  if (!showDeleted) {
    whereParts.push('deleted_at IS NULL');
  }
  if (statusFilter) {
    whereParts.push(`status = $${pi++}`);
    listParams.push(statusFilter);
  }
  if (importSourceStr === 'any') {
    whereParts.push('import_source IS NOT NULL');
  } else if (importSourceStr === 'manual') {
    whereParts.push('import_source IS NULL');
  } else if (importSourceStr.length > 0) {
    whereParts.push(`import_source = $${pi++}`);
    listParams.push(importSourceStr);
  }
  if (registryInactiveOnly) {
    whereParts.push('import_registry_inactive = TRUE');
    whereParts.push(`import_source = $${pi++}`);
    listParams.push('rpn_registry');
  }
  if (importRegistryStatusFilter) {
    whereParts.push(`import_registry_status = $${pi++}`);
    listParams.push(importRegistryStatusFilter);
  }
  if (needsReviewOnly) {
    whereParts.push(`import_needs_review = TRUE`);
  }

  const searchTokens = tokenizeAdminLicenseSearch(searchQ);
  for (const tok of searchTokens) {
    const ph = `$${pi++}`;
    whereParts.push(sqlAdminLicenseTokenClause(ph));
    listParams.push(tok);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  if (importSourceStr === 'groro_parser') {
    const groroWhere = [];
    const groroParams = [];
    let gi = 1;
    if (!showDeleted) {
      groroWhere.push(`o.deleted_at IS NULL`);
    }
    if (statusFilter) {
      groroWhere.push(`o.moderation_status = $${gi++}`);
      groroParams.push(statusFilter);
    }
    if (searchTokens.length > 0) {
      for (const tok of searchTokens) {
        groroWhere.push(`(
          lower(coalesce(o.object_name, '')) LIKE '%' || $${gi} || '%'
          OR lower(coalesce(o.operator_name, '')) LIKE '%' || $${gi} || '%'
          OR lower(coalesce(o.operator_inn, '')) LIKE '%' || $${gi} || '%'
          OR lower(coalesce(o.operator_address, '')) LIKE '%' || $${gi} || '%'
          OR lower(coalesce(o.region, '')) LIKE '%' || $${gi} || '%'
          OR lower(coalesce(o.groro_number, '')) LIKE '%' || $${gi} || '%'
        )`);
        groroParams.push(tok);
        gi += 1;
      }
    }
    if (importRegistryStatusFilter) {
      groroWhere.push(`o.status = $${gi++}`);
      groroParams.push(importRegistryStatusFilter);
    }
    if (needsReviewOnly) {
      groroWhere.push(`(o.operator_inn IS NULL OR length(trim(o.operator_inn)) = 0)`);
    }
    const gWhereSql = groroWhere.length ? `WHERE ${groroWhere.join(' AND ')}` : '';
    const gl = gi++;
    const go = gi++;
    groroParams.push(safeLimit, safeOffset);
    const gRows = await query(
      `SELECT
         o.id,
         o.operator_name AS "companyName",
         o.operator_inn AS inn,
         o.operator_address AS address,
         o.region,
         NULL::float8 AS lat,
         NULL::float8 AS lng,
         COALESCE(array_agg(DISTINCT w.fkko_code) FILTER (WHERE w.fkko_code IS NOT NULL), '{}'::text[]) AS "fkkoCodes",
         COALESCE(array_agg(DISTINCT w.activity_type) FILTER (WHERE w.activity_type IS NOT NULL), '{}'::text[]) AS "activityTypes",
         o.moderation_status AS status,
         o.reward AS reward,
         o.rejection_note AS "rejectionNote",
         o.moderated_comment AS "moderatedComment",
         o.moderated_at AS "moderatedAt",
         NULL::text AS "fileOriginalName",
         NULL::text AS "fileStoredName",
         NULL::int AS "ownerUserId",
         o.deleted_at AS "deletedAt",
         o.deleted_by AS "deletedBy",
         o.created_at AS "createdAt",
         'groro_parser'::text AS "importSource",
         (o.operator_inn IS NULL OR length(trim(o.operator_inn)) = 0) AS "importNeedsReview",
         o.status AS "importRegistryStatus",
         o.status_ru AS "importRegistryStatusRu",
         FALSE AS "importRegistryInactive",
         o.groro_number AS "groroNumber",
         o.status AS "groroStatus",
         o.status_ru AS "groroStatusRu",
         COUNT(*) OVER()::int AS "__total"
       FROM groro_objects o
       LEFT JOIN groro_wastes w ON w.groro_object_id = o.id
       ${gWhereSql}
       GROUP BY o.id
       ORDER BY o.updated_at DESC
       LIMIT $${gl} OFFSET $${go}`,
      groroParams,
    );
    const gTotal = gRows.rows[0]?.__total ?? 0;
    const gItems = gRows.rows.map(({ __total: _total, ...item }) => item);
    return res.json({ items: gItems, total: gTotal });
  }

  const limIdx = pi++;
  const offIdx = pi++;
  listParams.push(safeLimit, safeOffset);
  const rows = await query(
    `SELECT id,
            company_name AS "companyName",
            inn,
            address,
            region,
            lat,
            lng,
            fkko_codes AS "fkkoCodes",
            activity_types AS "activityTypes",
            status,
            reward,
            rejection_note AS "rejectionNote",
            moderated_comment AS "moderatedComment",
            moderated_at AS "moderatedAt",
            file_original_name AS "fileOriginalName",
            file_stored_name AS "fileStoredName",
            owner_user_id AS "ownerUserId",
            deleted_at AS "deletedAt",
            deleted_by AS "deletedBy",
            created_at AS "createdAt",
            import_source AS "importSource",
            import_needs_review AS "importNeedsReview",
            import_registry_status AS "importRegistryStatus",
            import_registry_status_ru AS "importRegistryStatusRu",
            import_registry_inactive AS "importRegistryInactive",
            groro_number AS "groroNumber",
            groro_status AS "groroStatus",
            groro_status_ru AS "groroStatusRu",
            COUNT(*) OVER()::int AS "__total"
     FROM licenses
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    listParams,
  );
  let total = rows.rows[0]?.__total ?? 0;
  if (total === 0 && safeOffset > 0) {
    const { rows: countRows } = await query(`SELECT COUNT(*)::int AS c FROM licenses ${whereSql}`, listParams.slice(0, -2));
    total = countRows[0]?.c ?? 0;
  }
  const items = rows.rows.map(({ __total: _total, ...item }) => item);

  res.json({ items, total });
});

const INN_EXPR = LICENSE_INN_NORMALIZED_EXPR;

adminRouter.get('/licenses/duplicate-groups', async (_req, res) => {
  try {
    const { rows: groups } = await query(
      `SELECT ${INN_EXPR} AS inn_norm,
              array_agg(id ORDER BY id) AS ids
       FROM licenses
       WHERE deleted_at IS NULL
         AND length(${INN_EXPR}) IN (10, 12)
       GROUP BY ${INN_EXPR}
       HAVING COUNT(*) > 1`,
      [],
    );

    const out = [];
    for (const g of groups) {
      const ids = g.ids;
      if (!ids?.length) continue;
      const detail = await query(
        `SELECT id,
                company_name AS "companyName",
                inn,
                status,
                reward,
                owner_user_id AS "ownerUserId",
                created_at AS "createdAt"
         FROM licenses
         WHERE id = ANY($1::int[])
         ORDER BY id ASC`,
        [ids],
      );
      out.push({
        normalizedInn: g.inn_norm,
        keepLicenseId: ids[0],
        licenses: detail.rows,
      });
    }

    return res.json({ groups: out });
  } catch (err) {
    console.error('duplicate-groups error:', err);
    return res.status(500).json({ message: 'Ошибка построения отчёта по дублям' });
  }
});

adminRouter.post('/licenses/resolve-duplicate-inns', async (req, res) => {
  const adminId = req.user?.id ?? null;

  const pool = getPool();
  const client = await pool.connect();
  let removedCount = 0;
  const removedLicenseIds = [];

  try {
    await client.query('BEGIN');

    const { rows: groups } = await client.query(
      `SELECT ${INN_EXPR} AS inn_norm,
              array_agg(id ORDER BY id) AS ids
       FROM licenses
       WHERE deleted_at IS NULL
         AND length(${INN_EXPR}) IN (10, 12)
       GROUP BY ${INN_EXPR}
       HAVING COUNT(*) > 1`,
    );

    for (const g of groups) {
      const ids = g.ids;
      if (!ids || ids.length < 2) continue;
      const removeIds = ids.slice(1);

      for (const rid of removeIds) {
        const licRes = await client.query(
          `SELECT id FROM licenses
           WHERE id = $1 AND deleted_at IS NULL
           LIMIT 1`,
          [rid],
        );
        if (!licRes.rows.length) continue;

        await client.query(
          `UPDATE licenses
           SET deleted_at = NOW(), deleted_by = $2
           WHERE id = $1 AND deleted_at IS NULL`,
          [rid, adminId],
        );
        removedCount += 1;
        removedLicenseIds.push(rid);
      }
    }

    await client.query('COMMIT');

    await createAuditLog({
      req,
      action: 'LICENSE_DEDUP_MERGE',
      entityType: 'LICENSE',
      entityId: removedLicenseIds.length ? String(removedLicenseIds[0]) : 'none',
      severity: 'INFO',
      metadata: {
        removedCount,
        removedLicenseIds,
      },
    });

    return res.json({
      message: removedCount > 0 ? `Удалено дублей: ${removedCount}` : 'Дублей по ИНН не найдено',
      removedCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('resolve-duplicate-inns error:', err);
    return res.status(500).json({ message: 'Ошибка слияния дублей' });
  } finally {
    client.release();
  }
});

function parseCoord(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function replaceSiteFkkoActivities(client, siteId, s) {
  const entries =
    Array.isArray(s.entries) && s.entries.length > 0
      ? s.entries
      : (s.fkkoCodes || []).map((code) => ({
          fkkoCode: code,
          wasteName: null,
          hazardClass: null,
          activityTypes: [...(s.activityTypes || [])],
        }));
  await client.query(`DELETE FROM site_fkko_activities WHERE site_id = $1`, [siteId]);
  for (const entry of entries) {
    for (const actType of entry.activityTypes) {
      await client.query(
        `INSERT INTO site_fkko_activities (site_id, fkko_code, waste_name, hazard_class, activity_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (site_id, fkko_code, activity_type) DO NOTHING`,
        [siteId, entry.fkkoCode, entry.wasteName || null, entry.hazardClass || null, actType],
      );
    }
  }
}

async function fetchGroroExtendedJson(client, id) {
  const rows = await client.query(
    `SELECT
       o.id,
       COALESCE(o.operator_name, o.object_name, 'ГРОРО объект') AS "companyName",
       o.operator_inn AS inn,
       o.operator_address AS address,
       o.region,
       NULL::float8 AS lat,
       NULL::float8 AS lng,
       o.moderation_status AS status,
       o.reward,
       o.rejection_note AS "rejectionNote",
       o.moderated_comment AS "moderatedComment",
       o.moderated_at AS "moderatedAt",
       o.created_at AS "createdAt",
       o.deleted_at AS "deletedAt",
       o.deleted_by AS "deletedBy",
       'groro_parser'::text AS "importSource",
       o.status AS "importRegistryStatus",
       o.status_ru AS "importRegistryStatusRu",
       FALSE AS "importRegistryInactive",
       o.groro_number AS "groroNumber",
       o.status AS "groroStatus",
       o.status_ru AS "groroStatusRu",
       COALESCE(
         array_agg(DISTINCT w.fkko_code) FILTER (WHERE w.fkko_code IS NOT NULL),
         '{}'::text[]
       ) AS "fkkoCodes",
       COALESCE(
         array_agg(DISTINCT w.activity_type) FILTER (WHERE w.activity_type IS NOT NULL),
         '{}'::text[]
       ) AS "activityTypes",
       COALESCE(
         json_agg(
           json_build_object(
             'fkkoCode', w.fkko_code,
             'wasteName', w.waste_name,
             'hazardClass', w.hazard_class,
             'activityTypes', ARRAY[w.activity_type]
           )
         ) FILTER (WHERE w.id IS NOT NULL),
         '[]'::json
       ) AS entries_json
     FROM groro_objects o
     LEFT JOIN groro_wastes w ON w.groro_object_id = o.id
     WHERE o.id = $1
     GROUP BY o.id
     LIMIT 1`,
    [id],
  );
  if (!rows.rows.length) return null;
  const r = rows.rows[0];
  return {
    ...r,
    siteId: r.id,
    sites: [
      {
        id: r.id,
        siteLabel: 'Основная площадка',
        address: r.address ?? '',
        region: r.region ?? null,
        lat: null,
        lng: null,
        fkkoCodes: Array.isArray(r.fkkoCodes) ? r.fkkoCodes : [],
        activityTypes: Array.isArray(r.activityTypes) ? r.activityTypes : [],
        entries: Array.isArray(r.entries_json) ? r.entries_json : [],
      },
    ],
  };
}

adminRouter.post('/import/groro', requireSuperadminOnly, async (req, res) => {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = rawIds
    .map((v) => String(v ?? '').replace(/\D/g, ''))
    .filter(Boolean)
    .slice(0, 1000);
  if (ids.length === 0) {
    return res.status(400).json({ message: 'Передайте ids (массив idObject карточек ГРОРО).' });
  }

  const stats = { total: ids.length, inserted: 0, updated: 0, skipped: 0, failed: 0 };
  const errors = [];
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const idObject of ids) {
      try {
        const card = await fetchGroroObjectById(idObject);
        if (!card?.groroNumber || !Array.isArray(card.wastes) || card.wastes.length === 0) {
          stats.skipped += 1;
          errors.push({ idObject, reason: 'missing-required-fields' });
          continue;
        }
        let operatorInn = card.operatorInn ? normalizeInn(card.operatorInn) : null;
        let operatorAddress = card.operatorAddress ? String(card.operatorAddress).trim() : null;
        let enrichUncertain = false;
        if (!operatorInn || !operatorAddress) {
          const enrich = await enrichFromRusprofile({
            queryName: card.operatorName || card.objectName || card.groroNumber,
            fallbackAddress: operatorAddress,
          });
          if (enrich?.innNorm && !operatorInn) operatorInn = enrich.innNorm;
          if (enrich?.legalAddress && !operatorAddress) operatorAddress = enrich.legalAddress;
          enrichUncertain = true;
        }

        const upsertOut = await upsertGroroObject(client, {
          sourceObjectId: idObject,
          ...card,
          operatorInn,
          operatorAddress,
          enrichUncertain, // сохраняется в raw_payload
        });
        if (upsertOut.action === 'inserted') stats.inserted += 1;
        else if (upsertOut.inserted) stats.inserted += 1;
        else stats.updated += 1;
      } catch (err) {
        stats.failed += 1;
        errors.push({ idObject, reason: err instanceof Error ? err.message : 'failed' });
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка импорта ГРОРО' });
  } finally {
    client.release();
  }

  await createAuditLog({
    req,
    action: 'GRORO_IMPORT',
    entityType: 'LICENSE',
    entityId: `count:${stats.total}`,
    severity: 'INFO',
    metadata: { ...stats, errorsCount: errors.length },
  }).catch(() => {});

  return res.json({ ok: true, ...stats, errors: errors.slice(0, 100) });
});

adminRouter.patch('/licenses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  const body = req.body ?? {};
  const companyNameStr = String(body.companyName ?? '').trim();
  if (!companyNameStr) {
    return res.status(400).json({ message: 'companyName обязателен' });
  }

  let sitesArr = normalizeAdminSitesWithIds(Array.isArray(body.sites) ? body.sites : []);
  if (sitesArr.length === 0) {
    const rootFkko = parseFkkoInput(body.fkkoCodes);
    const rootAct = parseActivityTypesInput(body.activityTypes);
    if (rootFkko.length === 0) {
      return res.status(400).json({
        message: 'Хотя бы один код ФККО обязателен. Добавьте площадки с ФККО или укажите коды на карточке.',
      });
    }
    sitesArr = [
      {
        clientId: null,
        address: String(body.address ?? '').trim() || null,
        region: body.region == null ? null : String(body.region).trim() || null,
        siteLabel: 'Основная площадка',
        lat: parseCoord(body.lat),
        lng: parseCoord(body.lng),
        fkkoCodes: rootFkko,
        activityTypes: rootAct,
        entries: [],
      },
    ];
  }

  const { fkkoArr, activityArr } = aggregateFkkoAndActivityFromSites(sitesArr);
  if (fkkoArr.length === 0) {
    return res.status(400).json({ message: 'Хотя бы один код ФККО обязателен.' });
  }

  const innStr = body.inn == null ? null : String(body.inn).trim() || null;
  const addressStr = body.address == null ? null : String(body.address).trim() || null;
  const regionStr = body.region == null ? null : String(body.region).trim() || null;
  const latLic = parseCoord(body.lat);
  const lngLic = parseCoord(body.lng);

  const clientIds = sitesArr.map((s) => s.clientId).filter((x) => x != null);
  if (clientIds.length !== new Set(clientIds).size) {
    return res.status(400).json({ message: 'В запросе дублируется id площадки' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const beforeExtended = await fetchLicenseExtendedJson(client, id);
    if (!beforeExtended) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Объект не найден' });
    }

    const innNorm = normalizeInn(innStr);
    if (innNorm) {
      const dup = await client.query(
        `SELECT 1 FROM licenses
         WHERE deleted_at IS NULL
           AND id <> $1
           AND ${LICENSE_INN_NORMALIZED_EXPR} = $2
         LIMIT 1`,
        [id, innNorm],
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: DUPLICATE_INN_MESSAGE });
      }
    }

    const existingSites = await client.query(`SELECT id FROM license_sites WHERE license_id = $1`, [id]);
    const dbIds = existingSites.rows.map((r) => Number(r.id));
    const keepIds = clientIds;
    const toDelete = dbIds.filter((dbId) => !keepIds.includes(dbId));
    if (toDelete.length > 0) {
      await client.query(`DELETE FROM license_sites WHERE license_id = $1 AND id = ANY($2::bigint[])`, [
        id,
        toDelete,
      ]);
    }

    for (let idx = 0; idx < sitesArr.length; idx++) {
      const s = sitesArr[idx];
      const fkkoArrS = s.fkkoCodes;
      const actArrS = s.activityTypes;
      const label = s.siteLabel || (idx === 0 ? 'Основная площадка' : null);
      let siteId;
      if (s.clientId) {
        const own = await client.query(`SELECT license_id FROM license_sites WHERE id = $1`, [s.clientId]);
        if (!own.rows.length || Number(own.rows[0].license_id) !== id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Некорректный id площадки' });
        }
        await client.query(
          `UPDATE license_sites
           SET site_label = $2, address = $3, region = $4, lat = $5, lng = $6, fkko_codes = $7, activity_types = $8
           WHERE id = $1`,
          [s.clientId, label, s.address, s.region, s.lat, s.lng, fkkoArrS, actArrS],
        );
        siteId = s.clientId;
      } else {
        const ins = await client.query(
          `INSERT INTO license_sites (license_id, site_label, address, region, lat, lng, fkko_codes, activity_types)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [id, label, s.address, s.region, s.lat, s.lng, fkkoArrS, actArrS],
        );
        siteId = Number(ins.rows[0].id);
      }
      await replaceSiteFkkoActivities(client, siteId, s);
    }

    await client.query(
      `UPDATE licenses
       SET company_name = $2,
           inn = $3,
           address = $4,
           region = $5,
           lat = $6,
           lng = $7,
           fkko_codes = $8,
           activity_types = $9
       WHERE id = $1
         AND deleted_at IS NULL`,
      [id, companyNameStr, innStr, addressStr, regionStr, latLic, lngLic, fkkoArr, activityArr],
    );

    const afterExtended = await fetchLicenseExtendedJson(client, id);
    await client.query('COMMIT');

    const auditBefore = {
      companyName: beforeExtended.companyName,
      inn: beforeExtended.inn,
      sitesCount: Array.isArray(beforeExtended.sites) ? beforeExtended.sites.length : 0,
    };
    const auditAfter = {
      companyName: afterExtended.companyName,
      inn: afterExtended.inn,
      sitesCount: Array.isArray(afterExtended.sites) ? afterExtended.sites.length : 0,
    };

    await createAuditLog({
      req,
      action: 'LICENSE_ADMIN_UPDATE',
      entityType: 'LICENSE',
      entityId: String(id),
      severity: 'INFO',
      changes: { before: auditBefore, after: auditAfter },
      metadata: { licenseId: id },
    });

    return res.json(afterExtended);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('admin patch license error:', err);
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка сохранения' });
  } finally {
    client.release();
  }
});

adminRouter.patch('/groro/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Некорректный id' });
  const body = req.body ?? {};
  const companyNameStr = String(body.companyName ?? '').trim();
  if (!companyNameStr) return res.status(400).json({ message: 'companyName обязателен' });
  const innStr = body.inn == null ? null : normalizeInn(String(body.inn).trim());
  const addressStr = body.address == null ? null : String(body.address).trim() || null;
  const regionStr = body.region == null ? null : String(body.region).trim() || null;
  const sites = normalizeAdminSitesWithIds(Array.isArray(body.sites) ? body.sites : []);
  const entries = sites.flatMap((s) => (Array.isArray(s.entries) ? s.entries : []));
  if (entries.length === 0) {
    return res.status(400).json({ message: 'Добавьте минимум одну строку ФККО для ГРОРО объекта.' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await fetchGroroExtendedJson(client, id);
    if (!before) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'ГРОРО объект не найден' });
    }
    await client.query(
      `UPDATE groro_objects
       SET operator_name = $2,
           object_name = COALESCE(NULLIF(object_name, ''), $2),
           operator_inn = $3,
           operator_address = $4,
           region = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [id, companyNameStr, innStr, addressStr, regionStr],
    );
    await client.query(`DELETE FROM groro_wastes WHERE groro_object_id = $1`, [id]);
    for (const e of entries) {
      const fkkoCode = String(e.fkkoCode ?? '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(fkkoCode)) continue;
      const acts = Array.isArray(e.activityTypes) && e.activityTypes.length ? e.activityTypes : ['Размещение'];
      for (const act of acts) {
        await client.query(
          `INSERT INTO groro_wastes (groro_object_id, fkko_code, waste_name, hazard_class, activity_type)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (groro_object_id, fkko_code, activity_type, waste_name) DO NOTHING`,
          [id, fkkoCode, e.wasteName || null, e.hazardClass || null, act],
        );
      }
    }
    const after = await fetchGroroExtendedJson(client, id);
    await client.query('COMMIT');
    await createAuditLog({
      req,
      action: 'GRORO_ADMIN_UPDATE',
      entityType: 'GRORO_OBJECT',
      entityId: String(id),
      severity: 'INFO',
      changes: { before: { companyName: before.companyName }, after: { companyName: after.companyName } },
    });
    return res.json(after);
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка сохранения ГРОРО' });
  } finally {
    client.release();
  }
});

adminRouter.post('/groro/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Некорректный id' });
  const updated = await query(
    `UPDATE groro_objects
     SET moderation_status = 'approved',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = COALESCE(moderated_comment, ''),
         rejection_note = NULL
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, moderation_status AS status`,
    [id, req.user?.id ?? null],
  );
  if (!updated.rows.length) return res.status(404).json({ message: 'Объект не найден' });
  return res.json({ message: 'ГРОРО объект одобрен', license: updated.rows[0] });
});

adminRouter.post('/groro/:id/recheck', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Некорректный id' });
  const updated = await query(
    `UPDATE groro_objects
     SET moderation_status = 'recheck',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = COALESCE(moderated_comment, ''),
         rejection_note = NULL
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, moderation_status AS status`,
    [id, req.user?.id ?? null],
  );
  if (!updated.rows.length) return res.status(404).json({ message: 'Объект не найден' });
  return res.json({ message: 'ГРОРО объект отправлен на перепроверку', license: updated.rows[0] });
});

adminRouter.post('/groro/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Некорректный id' });
  const note =
    typeof req.body?.note === 'string' && req.body.note.trim()
      ? req.body.note.trim().slice(0, 1000)
      : 'Причина не указана';
  const updated = await query(
    `UPDATE groro_objects
     SET moderation_status = 'rejected',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = $3,
         rejection_note = $3
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, moderation_status AS status, rejection_note AS "rejectionNote"`,
    [id, req.user?.id ?? null, note],
  );
  if (!updated.rows.length) return res.status(404).json({ message: 'Объект не найден' });
  return res.json({ message: 'ГРОРО объект отклонён', license: updated.rows[0] });
});

adminRouter.delete('/groro/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Некорректный id' });
  const updated = await query(
    `UPDATE groro_objects
     SET deleted_at = NOW(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, deleted_at AS "deletedAt", deleted_by AS "deletedBy"`,
    [id, req.user?.id ?? null],
  );
  if (!updated.rows.length) return res.status(404).json({ message: 'Объект не найден или уже удалён' });
  return res.json(updated.rows[0]);
});

adminRouter.delete('/groro/:id/hard', requireSuperadminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const confirm = String(req.body?.confirm ?? '').trim();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Некорректный id' });
  if (confirm !== 'DELETE') return res.status(400).json({ message: 'Подтвердите удаление кодом DELETE' });
  const before = await query(`SELECT id FROM groro_objects WHERE id = $1 LIMIT 1`, [id]);
  if (!before.rows.length) return res.status(404).json({ message: 'Объект не найден' });
  await query(`DELETE FROM groro_objects WHERE id = $1`, [id]);
  return res.json({ ok: true, id });
});

adminRouter.post('/licenses/batch-ai-approve', async (req, res) => {
  try {
    const cursor = Number(req.body?.cursor ?? 0) || 0;
    const batchSize = Number(req.body?.batchSize ?? 10);
    const dryRun = Boolean(req.body?.dryRun);
    const pool = getPool();
    const out = await runBatchAiApproveChunk(pool, { cursor, batchSize, dryRun, req });
    return res.json(out);
  } catch (err) {
    console.error('batch-ai-approve:', err);
    return res.status(500).json({ message: 'Ошибка пакетной модерации' });
  }
});

adminRouter.post('/licenses/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let approveResult;
    try {
      approveResult = await approveLicenseInTx(client, id, req.user?.id ?? null);
    } catch (e) {
      await client.query('ROLLBACK');
      if (e instanceof ApproveLicenseError) {
        if (e.code === 'NOT_FOUND') return res.status(404).json({ message: e.message });
        if (e.code === 'ALREADY_APPROVED' || e.code === 'NOT_PENDING') {
          return res.status(400).json({ message: e.message });
        }
        return res.status(400).json({ message: e.message });
      }
      throw e;
    }
    await client.query('COMMIT');
    await createAuditLog({
      req,
      action: 'LICENSE_APPROVE',
      entityType: 'LICENSE',
      entityId: String(id),
      severity: 'INFO',
      changes: { before: approveResult.before, after: approveResult.after },
      metadata: {
        rewardGranted: approveResult.rewardGranted,
        ...(approveResult.manualOverrideFromRejected ? { manualOverrideFromRejected: true } : {}),
      },
    });
    return res.json({
      message: 'Лицензия одобрена',
      license: approveResult.after,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approve license error:', err);
    return res.status(500).json({ message: 'Ошибка одобрения лицензии' });
  } finally {
    client.release();
  }
});

adminRouter.post('/licenses/:id/recheck', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  const existing = await query(
    `SELECT id,
            status,
            rejection_note AS "rejectionNote",
            moderated_comment AS "moderatedComment"
     FROM licenses
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  if (!existing.rows.length) {
    return res.status(404).json({ message: 'Объект не найден' });
  }

  const before = existing.rows[0];
  if (before.status === 'recheck') {
    return res.json({ message: 'Объект уже на перепроверке', license: before });
  }

  const updated = await query(
    `UPDATE licenses
     SET status = 'recheck',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = COALESCE(moderated_comment, ''),
         rejection_note = NULL
     WHERE id = $1
     RETURNING id,
               status,
               reward,
               rejection_note AS "rejectionNote",
               moderated_comment AS "moderatedComment",
               moderated_at AS "moderatedAt",
               moderated_by AS "moderatedBy"`,
    [id, req.user?.id ?? null],
  );

  await createAuditLog({
    req,
    action: 'LICENSE_MARK_RECHECK',
    entityType: 'LICENSE',
    entityId: String(id),
    severity: 'INFO',
    changes: { before, after: updated.rows[0] },
  });

  return res.json({ message: 'Объект отправлен на перепроверку', license: updated.rows[0] });
});

adminRouter.post('/licenses/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  const note =
    typeof req.body?.note === 'string' && req.body.note.trim()
      ? req.body.note.trim().slice(0, 1000)
      : 'Причина не указана';

  const existing = await query(
    `SELECT id, status, moderated_comment AS "moderatedComment", rejection_note AS "rejectionNote"
     FROM licenses
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  if (!existing.rows.length) {
    return res.status(404).json({ message: 'Объект не найден' });
  }

  const before = existing.rows[0];
  const updated = await query(
    `UPDATE licenses
     SET status = 'rejected',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = $3,
         rejection_note = $3
     WHERE id = $1
     RETURNING id,
               status,
               reward,
               rejection_note AS "rejectionNote",
               moderated_comment AS "moderatedComment",
               moderated_at AS "moderatedAt",
               moderated_by AS "moderatedBy"`,
    [id, req.user?.id ?? null, note],
  );

  await createAuditLog({
    req,
    action: 'LICENSE_REJECT',
    entityType: 'LICENSE',
    entityId: String(id),
    severity: 'INFO',
    changes: { before, after: updated.rows[0] },
  });

  return res.json({ message: 'Лицензия отклонена', license: updated.rows[0] });
});

// Мягкое удаление лицензии (объекта)
adminRouter.delete('/licenses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  const existing = await query(
    `SELECT id,
            company_name AS "companyName",
            inn,
            address,
            region,
            lat,
            lng,
            fkko_codes AS "fkkoCodes",
            activity_types AS "activityTypes",
            status,
            owner_user_id AS "ownerUserId",
            deleted_at AS "deletedAt",
            deleted_by AS "deletedBy",
            created_at AS "createdAt"
     FROM licenses
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  if (!existing.rows.length) {
    return res.status(404).json({ message: 'Объект не найден' });
  }

  const before = existing.rows[0];
  if (before.deletedAt) {
    return res.status(400).json({ message: 'Объект уже удалён' });
  }

  const updated = await query(
    `UPDATE licenses
     SET deleted_at = NOW(), deleted_by = $2
     WHERE id = $1
     RETURNING id,
               company_name AS "companyName",
               inn,
               address,
               region,
               lat,
               lng,
               fkko_codes AS "fkkoCodes",
               status,
               owner_user_id AS "ownerUserId",
               deleted_at AS "deletedAt",
               deleted_by AS "deletedBy",
               created_at AS "createdAt"`,
    [id, req.user?.id ?? null],
  );

  await createAuditLog({
    req,
    action: 'LICENSE_DELETE',
    entityType: 'LICENSE',
    entityId: String(id),
    severity: 'INFO',
    changes: { before, after: updated.rows[0] },
  });

  res.json(updated.rows[0]);
});

adminRouter.delete('/licenses/:id/hard', requireSuperadminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const confirm = String(req.body?.confirm ?? '').trim();
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }
  if (confirm !== 'DELETE') {
    return res.status(400).json({ message: 'Подтвердите удаление кодом DELETE' });
  }

  const existing = await query(
    `SELECT id, company_name AS "companyName", status, deleted_at AS "deletedAt"
     FROM licenses
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  if (!existing.rows.length) {
    return res.status(404).json({ message: 'Объект не найден' });
  }
  const before = existing.rows[0];

  await query(`DELETE FROM licenses WHERE id = $1`, [id]);

  await createAuditLog({
    req,
    action: 'LICENSE_HARD_DELETE',
    entityType: 'LICENSE',
    entityId: String(id),
    severity: 'WARNING',
    changes: { before, after: null },
  });

  return res.json({ ok: true, id });
});

/**
 * Жёсткое удаление всех лицензий импорта реестра РПН с флагом «неактивна в реестре».
 * Площадки и site_fkko_activities удаляются каскадом.
 */
adminRouter.post('/licenses/purge-registry-inactive', requireSuperadminOnly, async (req, res) => {
  const confirm = String(req.body?.confirm ?? '').trim();
  if (confirm !== 'PURGE_REGISTRY_INACTIVE') {
    return res.status(400).json({
      message:
        'Укажите в JSON теле: { "confirm": "PURGE_REGISTRY_INACTIVE" } — операция необратима.',
    });
  }
  try {
    const sel = await query(
      `SELECT id, company_name AS "companyName", status
       FROM licenses
       WHERE import_source = 'rpn_registry'
         AND import_registry_inactive = TRUE`,
      [],
    );
    const ids = sel.rows.map((r) => r.id);
    if (ids.length === 0) {
      return res.json({ deleted: 0, message: 'Нет записей для удаления' });
    }
    await query(
      `DELETE FROM licenses
       WHERE import_source = 'rpn_registry'
         AND import_registry_inactive = TRUE`,
      [],
    );
    await createAuditLog({
      req,
      action: 'LICENSES_PURGE_REGISTRY_INACTIVE',
      entityType: 'LICENSE',
      entityId: `count:${ids.length}`,
      severity: 'WARNING',
      changes: { deletedCount: ids.length, idsSample: ids.slice(0, 200) },
    });
    return res.json({ deleted: ids.length });
  } catch (err) {
    console.error('purge registry-inactive licenses:', err);
    return res.status(500).json({ message: err.message || 'Ошибка удаления' });
  }
});

/** Фоновая подтяжка наименований ФККО с РПН по всем кодам из одобренных лицензий → fkko_official_titles */
adminRouter.post('/fkko/sync-official-titles', async (_req, res) => {
  if (isFkkoTitlesSyncRunning()) {
    return res.status(409).json({
      message: 'Синхронизация уже выполняется',
      status: getFkkoTitlesSyncStatus(),
    });
  }
  void runFkkoOfficialTitlesSyncJob();
  return res.status(202).json({
    message: 'Синхронизация запущена. Статус можно опросить методом GET.',
    status: getFkkoTitlesSyncStatus(),
  });
});

adminRouter.get('/fkko/sync-official-titles/status', (_req, res) => {
  return res.json(getFkkoTitlesSyncStatus());
});

/** Коды ФККО из одобренных лицензий, для которых в БД нет непустого наименования */
adminRouter.get('/fkko/titles/missing', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT sfa.fkko_code AS code
       FROM site_fkko_activities sfa
       JOIN license_sites s ON s.id = sfa.site_id
       JOIN licenses l ON l.id = s.license_id
       WHERE l.deleted_at IS NULL
         AND l.status = 'approved'
         AND (l.import_source IS DISTINCT FROM 'rpn_registry' OR NOT l.import_registry_inactive)
         AND sfa.fkko_code ~ '^[0-9]{11}$'
         AND NOT EXISTS (
           SELECT 1
           FROM fkko_official_titles t
           WHERE t.code = sfa.fkko_code
             AND length(trim(t.title)) > 0
         )
       ORDER BY code ASC`,
      [],
    );
    const codes = rows.rows.map((r) => String(r.code ?? '').trim()).filter(Boolean);
    return res.json({ codes });
  } catch (err) {
    console.error('admin fkko titles missing:', err);
    return res.status(500).json({ message: err.message || 'Ошибка' });
  }
});

const MAX_MANUAL_FKKO_TITLES_BATCH = 80;
const MAX_FKKO_TITLE_LEN = 2000;

/** Ручное добавление/обновление наименований в fkko_official_titles */
adminRouter.post('/fkko/titles/manual', async (req, res) => {
  try {
    const raw = req.body?.titles;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return res.status(400).json({
        message: 'Ожидается JSON: { "titles": { "47110101521": "Текст наименования" } }',
      });
    }
    const normalized = {};
    for (const [k, v] of Object.entries(raw)) {
      const code = String(k ?? '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(code)) continue;
      const title = String(v ?? '').trim();
      if (!title) continue;
      if (title.length > MAX_FKKO_TITLE_LEN) {
        return res.status(400).json({
          message: `Наименование для кода ${code} длиннее ${MAX_FKKO_TITLE_LEN} символов`,
        });
      }
      normalized[code] = title;
    }
    const keys = Object.keys(normalized);
    if (keys.length === 0) {
      return res.status(400).json({ message: 'Нет валидных пар «11 цифр кода» — «непустое наименование»' });
    }
    if (keys.length > MAX_MANUAL_FKKO_TITLES_BATCH) {
      return res.status(400).json({
        message: `Не более ${MAX_MANUAL_FKKO_TITLES_BATCH} кодов за один запрос`,
      });
    }
    await upsertFkkoOfficialTitles(normalized);
    await createAuditLog({
      req,
      action: 'FKKO_TITLES_MANUAL_UPSERT',
      entityType: 'FKKO',
      entityId: keys.length === 1 ? keys[0] : `batch:${keys.length}`,
      severity: 'INFO',
      changes: { codes: keys },
    });
    return res.json({ ok: true, saved: keys.length });
  } catch (err) {
    console.error('admin fkko titles manual:', err);
    return res.status(500).json({ message: err.message || 'Ошибка сохранения' });
  }
});

export default adminRouter;

