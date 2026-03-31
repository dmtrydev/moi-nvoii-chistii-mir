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

const adminRouter = express.Router();

const MAX_ADMIN_SEARCH_TOKENS = 12;
const MAX_ADMIN_SEARCH_TOKEN_LEN = 80;

function tokenizeAdminLicenseSearch(q) {
  const s = String(q ?? '').trim();
  if (!s) return [];
  return s
    .split(/\s+/u)
    .map((t) => t.slice(0, MAX_ADMIN_SEARCH_TOKEN_LEN).toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_ADMIN_SEARCH_TOKENS);
}

/** Подстрока безопасна для POSITION: без wildcard как у ILIKE */
function sqlAdminLicenseTokenClause(paramPlaceholder) {
  return `(
    position(${paramPlaceholder} in lower(coalesce(company_name, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(inn, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(address, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(region, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(import_external_ref, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(import_source, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(file_original_name, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(file_stored_name, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(moderated_comment, ''))) > 0
    OR position(${paramPlaceholder} in lower(coalesce(rejection_note, ''))) > 0
    OR position(${paramPlaceholder} in lower(cast(id as text))) > 0
    OR position(${paramPlaceholder} in lower(array_to_string(fkko_codes, ' '))) > 0
    OR position(${paramPlaceholder} in lower(array_to_string(activity_types, ' '))) > 0
    OR exists (
      select 1 from license_sites s
      where s.license_id = licenses.id
        and (
          position(${paramPlaceholder} in lower(coalesce(s.address, ''))) > 0
          or position(${paramPlaceholder} in lower(coalesce(s.region, ''))) > 0
          or position(${paramPlaceholder} in lower(coalesce(s.site_label, ''))) > 0
          or position(${paramPlaceholder} in lower(array_to_string(s.fkko_codes, ' '))) > 0
          or position(${paramPlaceholder} in lower(array_to_string(s.activity_types, ' '))) > 0
        )
    )
    OR exists (
      select 1 from license_sites s
      inner join site_fkko_activities sfa on sfa.site_id = s.id
      where s.license_id = licenses.id
        and (
          position(${paramPlaceholder} in lower(sfa.fkko_code)) > 0
          or position(${paramPlaceholder} in lower(coalesce(sfa.waste_name, ''))) > 0
          or position(${paramPlaceholder} in lower(coalesce(sfa.activity_type, ''))) > 0
          or position(${paramPlaceholder} in lower(coalesce(sfa.hazard_class, ''))) > 0
        )
    )
  )`;
}

adminRouter.use(requireRole('SUPERADMIN'));

adminRouter.get('/stats/summary', async (req, res) => {
  const { from, to } = req.query;
  const fromTs = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const toTs = to || new Date().toISOString();

  const [{ rows: licensesByDay }, { rows: moderationQueue }] = await Promise.all([
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
  ]);

  res.json({
    licensesByDay,
    moderation: moderationQueue[0] ?? { pending: 0, approved: 0, rejected: 0 },
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
    importRegistryInactive: importRegistryInactiveQ,
    needsReview: needsReviewQ,
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
  const registryInactiveOnly = String(importRegistryInactiveQ ?? '').toLowerCase() === 'true';

  const needsReviewFilter = String(needsReviewQ ?? '').toLowerCase() === 'true';

  const whereParts = [];
  const countParams = [];
  let pi = 1;
  if (!showDeleted) {
    whereParts.push('deleted_at IS NULL');
  }
  if (statusFilter) {
    whereParts.push(`status = $${pi++}`);
    countParams.push(statusFilter);
  }
  if (importSourceStr === 'any') {
    whereParts.push('import_source IS NOT NULL');
  } else if (importSourceStr === 'manual') {
    whereParts.push('import_source IS NULL');
  } else if (importSourceStr.length > 0) {
    whereParts.push(`import_source = $${pi++}`);
    countParams.push(importSourceStr);
  }
  if (registryInactiveOnly) {
    whereParts.push('import_registry_inactive = TRUE');
    whereParts.push(`import_source = $${pi++}`);
    countParams.push('rpn_registry');
  }
  if (needsReviewFilter) {
    whereParts.push('import_needs_review = TRUE');
  }

  const searchTokens = tokenizeAdminLicenseSearch(searchQ);
  for (const tok of searchTokens) {
    const ph = `$${pi++}`;
    whereParts.push(sqlAdminLicenseTokenClause(ph));
    countParams.push(tok);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS c FROM licenses ${whereSql}`,
    countParams,
  );
  const total = countRows[0]?.c ?? 0;

  const listParams = [...countParams, Number(limit), Number(offset)];
  const limIdx = pi++;
  const offIdx = pi;
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
            import_external_ref AS "importExternalRef",
            import_needs_review AS "importNeedsReview",
            import_registry_inactive AS "importRegistryInactive"
     FROM licenses
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    listParams,
  );

  res.json({ items: rows.rows, total });
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
  const deductEcoCoins = Boolean(req.body?.deductEcoCoins);
  const adminId = req.user?.id ?? null;

  const pool = getPool();
  const client = await pool.connect();
  let removedCount = 0;
  let clawbackTotal = 0;
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
          `SELECT id, status, owner_user_id AS "ownerUserId"
           FROM licenses
           WHERE id = $1 AND deleted_at IS NULL
           LIMIT 1`,
          [rid],
        );
        if (!licRes.rows.length) continue;

        const row = licRes.rows[0];
        if (deductEcoCoins && row.status === 'approved') {
          const txRes = await client.query(
            `SELECT user_id AS "userId", amount
             FROM transactions
             WHERE license_id = $1
             LIMIT 1`,
            [rid],
          );
          if (txRes.rows.length) {
            const { userId, amount } = txRes.rows[0];
            const amt = Number(amount);
            await client.query(
              `UPDATE users
               SET eco_coins = GREATEST(0, eco_coins - $2)
               WHERE id = $1`,
              [userId, amt],
            );
            await client.query(`DELETE FROM transactions WHERE license_id = $1`, [rid]);
            clawbackTotal += amt;
          }
        }

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
        deductEcoCoins,
        clawbackTotal,
      },
    });

    return res.json({
      message:
        removedCount > 0
          ? `Удалено дублей: ${removedCount}${deductEcoCoins && clawbackTotal > 0 ? `. Списано экокоинов: ${clawbackTotal}` : ''}`
          : 'Дублей по ИНН не найдено',
      removedCount,
      deductEcoCoins,
      clawbackTotal,
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

/** Снять флаг «нужна перепроверка» у записи, импортированной из внешнего реестра. */
adminRouter.post('/licenses/:id/import-mark-reviewed', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Некорректный id' });
  }
  try {
    const { rows } = await query(
      `UPDATE licenses
       SET import_needs_review = FALSE
       WHERE id = $1
         AND deleted_at IS NULL
         AND import_source IS NOT NULL
       RETURNING id`,
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({
        message: 'Объект не найден, удалён или не является импортом из реестра',
      });
    }
    await createAuditLog({
      req,
      action: 'LICENSE_IMPORT_MARK_REVIEWED',
      entityType: 'LICENSE',
      entityId: String(id),
      severity: 'INFO',
    });
    return res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('import-mark-reviewed:', err);
    return res.status(500).json({ message: 'Ошибка обновления' });
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
      message: approveResult.rewardGranted ? 'Лицензия одобрена, экокоины начислены' : 'Лицензия одобрена',
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

export default adminRouter;

