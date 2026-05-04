/**
 * Эндпойнты для cron-синхронизации с реестром РПН.
 *
 * Авторизация: Bearer-токен из env `RPN_SYNC_TOKEN`. Это сервисный токен, отдельный
 * от пользовательского JWT — чтобы скрипт на VDS мог обновлять данные без UI-логина.
 * Если переменная не задана, эндпойнты закрыты (отдают 503), чтобы случайно не открыть
 * запись в БД на проде.
 */
import express from 'express';
import { getPool } from './db.js';
import { rateLimit } from './rateLimit.js';
import { createAuditLog } from './audit.js';
import { normalizeInn } from './innUtils.js';
import { selectInnsToSync, upsertSnapshotsBatch, getSnapshotStats } from './rpnRegistrySnapshot.js';

const router = express.Router();

const MAX_BATCH_ROWS = 500;

/**
 * Безопасное сравнение токенов в постоянное время (защита от time-attack).
 * Так как токены — обычная ASCII-строка, побайтовое сравнение по charCodeAt достаточно.
 */
function safeEqual(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) {
    diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  }
  return diff === 0;
}

function requireSyncToken(req, res, next) {
  const expected = String(process.env.RPN_SYNC_TOKEN ?? '').trim();
  if (!expected) {
    return res.status(503).json({
      message: 'RPN_SYNC_TOKEN не задан на сервере — синхронизация отключена.',
    });
  }
  const auth = String(req.headers.authorization ?? '');
  const provided = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  if (!safeEqual(provided, expected)) {
    return res.status(401).json({ message: 'Неверный токен синхронизации.' });
  }
  return next();
}

router.use(rateLimit({ name: 'rpn-sync', windowMs: 60_000, max: 60 }));
router.use(requireSyncToken);

/**
 * Список ИНН для синка с приоритизацией. Возвращает не больше limit (по умолчанию 10000).
 * Опции:
 *   - limit: 1..200000
 *   - staleDays: 1..365
 */
router.get('/inns-to-sync', async (req, res) => {
  try {
    const limit = Number.parseInt(String(req.query.limit ?? '10000'), 10);
    const staleDays = Number.parseInt(String(req.query.staleDays ?? '7'), 10);
    const pool = getPool();
    const out = await selectInnsToSync(pool, { limit, staleDays });
    return res.json({
      inns: out.inns,
      counts: out.counts,
    });
  } catch (err) {
    console.error('rpn-sync inns-to-sync error:', err);
    return res.status(500).json({ message: 'Ошибка выборки ИНН' });
  }
});

/**
 * Bulk upsert снапшотов. Тело:
 *   { snapshots: [{ innNorm, licenseNumber, dateIssued, registryStatus, ... }, ...] }
 *
 * Невалидные строки пропускаются с сообщением в `skipped`. Лимит 500 строк за запрос.
 */
router.post('/upsert', async (req, res) => {
  const startedAt = Date.now();
  try {
    const raw = req.body?.snapshots;
    if (!Array.isArray(raw)) {
      return res.status(400).json({
        message: 'Ожидается тело { "snapshots": [...] }',
      });
    }
    if (raw.length > MAX_BATCH_ROWS) {
      return res.status(400).json({
        message: `Максимум ${MAX_BATCH_ROWS} строк за запрос; передано ${raw.length}`,
      });
    }

    const valid = [];
    const skipped = [];
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      if (!r || typeof r !== 'object') {
        skipped.push({ index: i, reason: 'not-object' });
        continue;
      }
      const innNorm = normalizeInn(r.innNorm);
      if (!innNorm) {
        skipped.push({ index: i, reason: 'invalid-inn' });
        continue;
      }
      const registryStatus = String(r.registryStatus ?? '').trim().toLowerCase() || 'unknown';
      valid.push({
        innNorm,
        licenseNumber: r.licenseNumber == null ? null : String(r.licenseNumber).slice(0, 200),
        dateIssued: r.dateIssued == null ? null : String(r.dateIssued),
        registryStatus,
        registryStatusRu:
          r.registryStatusRu == null ? null : String(r.registryStatusRu).slice(0, 200),
        registryInactive: Boolean(r.registryInactive),
        unitShortName:
          r.unitShortName == null ? null : String(r.unitShortName).slice(0, 500),
        registryModifiedAt: r.registryModifiedAt == null ? null : String(r.registryModifiedAt),
        ppsDeadlineAt: r.ppsDeadlineAt == null ? null : String(r.ppsDeadlineAt),
        rawJson: r.rawJson && typeof r.rawJson === 'object' ? r.rawJson : null,
      });
    }

    if (valid.length === 0) {
      return res.json({
        ok: true,
        inserted: 0,
        updated: 0,
        skipped,
        durationMs: Date.now() - startedAt,
      });
    }

    const pool = getPool();
    const stats = await upsertSnapshotsBatch(pool, valid);

    // В audit_logs пишем только агрегаты, без раскрытия персональных данных контрагентов.
    await createAuditLog({
      req,
      action: 'RPN_SYNC_UPSERT',
      entityType: 'RPN_SNAPSHOT',
      entityId: `batch:${valid.length}`,
      severity: 'INFO',
      metadata: {
        inserted: stats.inserted,
        updated: stats.updated,
        total: stats.total,
        skippedCount: skipped.length,
        durationMs: Date.now() - startedAt,
      },
    }).catch((auditErr) => {
      console.warn('rpn-sync audit log failed (не критично):', auditErr?.message ?? auditErr);
    });

    return res.json({
      ok: true,
      inserted: stats.inserted,
      updated: stats.updated,
      total: stats.total,
      skipped,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('rpn-sync upsert error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка синхронизации',
    });
  }
});

/** Сводная статистика snapshot — для проверки cron-job извне. */
router.get('/stats', async (_req, res) => {
  try {
    const pool = getPool();
    const stats = await getSnapshotStats(pool);
    return res.json(stats ?? {});
  } catch (err) {
    console.error('rpn-sync stats error:', err);
    return res.status(500).json({ message: 'Ошибка статистики' });
  }
});

export default router;
