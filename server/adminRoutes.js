import express from 'express';
import { query } from './db.js';
import { getPool } from './db.js';
import { requireRole } from './auth.js';
import { createAuditLog } from './audit.js';

const adminRouter = express.Router();

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

// Админский список лицензий (для управления объектами)
adminRouter.get('/licenses', async (req, res) => {
  const { includeDeleted = 'false', limit = 50, offset = 0 } = req.query;
  const showDeleted = String(includeDeleted).toLowerCase() === 'true';

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
            created_at AS "createdAt"
     FROM licenses
     ${showDeleted ? '' : 'WHERE deleted_at IS NULL'}
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), Number(offset)],
  );

  res.json({ items: rows.rows });
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
    const beforeResult = await client.query(
      `SELECT id,
              status,
              reward,
              owner_user_id AS "ownerUserId",
              rejection_note AS "rejectionNote"
       FROM licenses
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    if (!beforeResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Объект не найден' });
    }
    const before = beforeResult.rows[0];
    if (before.status === 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Лицензия уже одобрена' });
    }
    if (!before.ownerUserId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'У лицензии нет владельца для начисления экокоинов' });
    }

    const updated = await client.query(
      `UPDATE licenses
       SET status = 'approved',
           moderated_by = $2,
           moderated_at = NOW(),
           moderated_comment = COALESCE(moderated_comment, ''),
           rejection_note = NULL
       WHERE id = $1
       RETURNING id,
                 status,
                 reward,
                 owner_user_id AS "ownerUserId",
                 moderated_at AS "moderatedAt",
                 moderated_by AS "moderatedBy"`,
      [id, req.user?.id ?? null],
    );

    const txInsert = await client.query(
      `INSERT INTO transactions (user_id, license_id, amount, type)
       VALUES ($1, $2, $3, 'LICENSE_REWARD')
       ON CONFLICT (license_id) DO NOTHING
       RETURNING id`,
      [before.ownerUserId, id, Number(before.reward ?? 100)],
    );

    if (txInsert.rowCount > 0) {
      await client.query(
        `UPDATE users
         SET eco_coins = eco_coins + $2
         WHERE id = $1`,
        [before.ownerUserId, Number(before.reward ?? 100)],
      );
    }

    await client.query('COMMIT');
    await createAuditLog({
      req,
      action: 'LICENSE_APPROVE',
      entityType: 'LICENSE',
      entityId: String(id),
      severity: 'INFO',
      changes: { before, after: updated.rows[0] },
      metadata: { rewardGranted: txInsert.rowCount > 0 },
    });
    return res.json({
      message: txInsert.rowCount > 0 ? 'Лицензия одобрена, экокоины начислены' : 'Лицензия одобрена',
      license: updated.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approve license error:', err);
    return res.status(500).json({ message: 'Ошибка одобрения лицензии' });
  } finally {
    client.release();
  }
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

