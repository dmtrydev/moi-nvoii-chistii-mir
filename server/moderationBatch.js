import path from 'node:path';
import { existsSync } from 'node:fs';
import fsPromises from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LICENSE_INN_NORMALIZED_EXPR, normalizeInn } from './innUtils.js';
import { buildModerationPdfSnippet, extractTextFromPdf } from './pdfText.js';
import { callTimewebAiRaw, isTimewebAiConfigured } from './aiClient.js';
import { approveLicenseInTx, rejectLicenseInTx, ApproveLicenseError } from './licenseApprove.js';
import { createAuditLog } from './audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_LICENSES = path.join(__dirname, '..', 'uploads', 'licenses');
const INN_EXPR = LICENSE_INN_NORMALIZED_EXPR;

function guessRegionFromAddress(address) {
  const a = String(address || '').trim();
  if (!a) return '';
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean);
  const withKeywords = parts.find((p) => /(область|край|республика|округ|АО|А\.О\.)/i.test(p));
  if (withKeywords) return withKeywords;
  const first = parts[0] ?? '';
  return first.length <= 80 ? first : '';
}

function parseModerationAiArray(raw) {
  let s = String(raw).trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  s = s.trim();
  const parsed = JSON.parse(s);
  if (!Array.isArray(parsed)) {
    throw new Error('Ответ ИИ должен быть JSON-массивом');
  }
  return parsed;
}

const MODERATION_BATCH_SYSTEM = `Ты помощник модератора лицензий на обращение с отходами (РФ).
По каждой заявке из входного JSON (поле licenses) верни РОВНО один объект в массиве ответа — на тот же licenseId.

Решение decision:
- "approve" — если данные корректны для публикации: ИНН 10 цифр (юрлицо) или 12 (физлицо/ИП); адреса площадок — реальные почтовые адреса в РФ (населённый пункт, улица/проспект и т.д.).
- "reject" — если ИНН не похож на действительный, адрес вместо места деятельности — юридическая формулировка (орган выдавший документ, "Росприроднадзор", "выписка из реестра", "территориальный орган" без конкретного адреса объекта), явное несоответствие фрагменту PDF.

Если адреса в БД частично ошибочны, но в pdfSnippet виден верный адрес конкретной площадки — decision "approve" и заполни correctedSites: [{ "siteId": <число из входных sites>, "address": "полный исправленный адрес" }]. siteId только из входного списка.

Ответь СТРОГО валидным JSON-массивом (без markdown), например:
[{"licenseId":1,"decision":"approve","reason":"кратко","innOk":true,"correctedSites":[]}]`;

/**
 * @param {import('pg').Pool} pool
 * @param {{ cursor: number, batchSize: number, dryRun: boolean, req: import('express').Request }} opts
 */
export async function runBatchAiApproveChunk(pool, opts) {
  const cursor = Number(opts.cursor) || 0;
  const batchSize = Math.min(15, Math.max(1, Number(opts.batchSize) || 10));
  const dryRun = Boolean(opts.dryRun);
  const req = opts.req;
  const adminId = req?.user?.id ?? null;

  const results = [];
  const summary = { approved: 0, rejected: 0, skipped: 0, wouldApprove: 0, wouldReject: 0 };

  const { rows: licenses } = await pool.query(
    `SELECT id,
            company_name AS "companyName",
            inn,
            address,
            region,
            status,
            owner_user_id AS "ownerUserId",
            file_stored_name AS "fileStoredName"
     FROM licenses
     WHERE deleted_at IS NULL AND status = 'pending' AND id > $1
     ORDER BY id ASC
     LIMIT $2`,
    [cursor, batchSize],
  );

  if (licenses.length === 0) {
    return { results, nextCursor: null, summary };
  }

  const nextCursor = licenses.length < batchSize ? null : licenses[licenses.length - 1].id;

  /** @type {Map<number, { id: number, address: string|null, region: string|null }[]>} */
  const sitesByLicense = new Map();
  for (const lic of licenses) {
    const s = await pool.query(
      `SELECT id, address, region
       FROM license_sites
       WHERE license_id = $1
       ORDER BY id ASC`,
      [lic.id],
    );
    sitesByLicense.set(lic.id, s.rows);
  }

  /** @type {{ lic: object, payload: object }[]} */
  const aiQueue = [];
  /** @type {Map<number, { action: string, reason?: string, duplicateOfId?: number }>} */
  const prelim = new Map();

  for (const lic of licenses) {
    const licId = lic.id;

    const innRaw = lic.inn == null ? '' : String(lic.inn).trim();
    const innNorm = normalizeInn(innRaw);
    if (innRaw && !innNorm) {
      prelim.set(licId, { action: 'skipped', reason: 'invalid_inn' });
      continue;
    }

    if (innNorm) {
      const dup = await pool.query(
        `SELECT id FROM licenses
         WHERE deleted_at IS NULL
           AND id <> $1
           AND ${INN_EXPR} = $2
           AND id < $1
         LIMIT 1`,
        [licId, innNorm],
      );
      if (dup.rows.length) {
        prelim.set(licId, { action: 'skipped', reason: 'duplicate_inn', duplicateOfId: dup.rows[0].id });
        continue;
      }
    }

    let pdfSnippet = null;
    const stored = lic.fileStoredName ? String(lic.fileStoredName).trim() : '';
    if (stored) {
      const fp = path.join(UPLOADS_LICENSES, stored);
      if (existsSync(fp)) {
        try {
          const buf = await fsPromises.readFile(fp);
          const fullText = await extractTextFromPdf(buf);
          pdfSnippet = buildModerationPdfSnippet(fullText, 7000) || null;
        } catch {
          pdfSnippet = null;
        }
      }
    }

    const sites = sitesByLicense.get(licId) || [];
    const payload = {
      licenseId: licId,
      companyName: lic.companyName,
      inn: innRaw,
      normalizedInn: innNorm,
      region: lic.region,
      sites: sites.map((s) => ({
        siteId: Number(s.id),
        address: s.address,
        region: s.region,
      })),
      ...(pdfSnippet ? { pdfSnippet } : {}),
    };
    aiQueue.push({ lic, payload });
  }

  /** @type {Map<number, object>} */
  let aiById = new Map();
  if (aiQueue.length > 0) {
    if (!isTimewebAiConfigured()) {
      for (const { lic } of aiQueue) {
        prelim.set(lic.id, { action: 'skipped', reason: 'ai_not_configured' });
      }
    } else {
      const userContent = JSON.stringify({ licenses: aiQueue.map((x) => x.payload) });
      try {
        const raw = await callTimewebAiRaw(MODERATION_BATCH_SYSTEM, userContent, 8000);
        const arr = parseModerationAiArray(raw);
        for (const row of arr) {
          const lid = Number(row.licenseId);
          if (Number.isFinite(lid)) {
            aiById.set(lid, row);
          }
        }
      } catch (err) {
        for (const { lic } of aiQueue) {
          prelim.set(lic.id, {
            action: 'skipped',
            reason: 'ai_error',
            detail: String(err.message || err).slice(0, 300),
          });
        }
        aiById = new Map();
      }
    }
  }

  for (const lic of licenses) {
    const licId = lic.id;

    if (prelim.has(licId)) {
      const p = prelim.get(licId);
      results.push({
        id: licId,
        action: p.action,
        reason: p.reason,
        duplicateOfId: p.duplicateOfId,
        detail: p.detail,
      });
      summary.skipped += 1;
      continue;
    }

    if (!aiById.has(licId)) {
      results.push({ id: licId, action: 'skipped', reason: 'ai_no_verdict' });
      summary.skipped += 1;
      continue;
    }

    const verdict = aiById.get(licId);
    const decision = String(verdict.decision || '').toLowerCase();
    const reason = String(verdict.reason || '').trim().slice(0, 1000) || 'Модерация ИИ';

    if (decision === 'reject') {
      if (!dryRun) {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          await rejectLicenseInTx(c, licId, adminId, `[ИИ] ${reason}`);
          await c.query('COMMIT');
          await createAuditLog({
            req,
            action: 'LICENSE_REJECT',
            entityType: 'LICENSE',
            entityId: String(licId),
            severity: 'INFO',
            metadata: { batchAi: true, reason },
          });
        } catch (e) {
          await c.query('ROLLBACK');
          results.push({ id: licId, action: 'error', reason: String(e.message || e) });
          continue;
        } finally {
          c.release();
        }
      }
      results.push({ id: licId, action: dryRun ? 'would_reject' : 'rejected', reason, dryRun });
      if (dryRun) summary.wouldReject += 1;
      else summary.rejected += 1;
      continue;
    }

    if (decision !== 'approve') {
      results.push({ id: licId, action: 'skipped', reason: 'ai_invalid_decision' });
      summary.skipped += 1;
      continue;
    }

    const corrected = Array.isArray(verdict.correctedSites) ? verdict.correctedSites : [];

    if (!dryRun) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');

        for (const cs of corrected) {
          const sid = Number(cs.siteId);
          const addr = String(cs.address ?? '').trim();
          if (!Number.isFinite(sid) || !addr) continue;
          const belongs = await c.query(
            `SELECT id FROM license_sites WHERE id = $1 AND license_id = $2 LIMIT 1`,
            [sid, licId],
          );
          if (!belongs.rows.length) continue;
          const reg = guessRegionFromAddress(addr) || null;
          await c.query(
            `UPDATE license_sites SET address = $2, region = COALESCE($3, region) WHERE id = $1 AND license_id = $4`,
            [sid, addr, reg, licId],
          );
        }

        if (corrected.length > 0) {
          const sitesNow = await c.query(
            `SELECT address, region FROM license_sites WHERE license_id = $1 ORDER BY id ASC`,
            [licId],
          );
          const primary = sitesNow.rows[0];
          if (primary?.address) {
            const aggAddr = String(primary.address).trim();
            const aggReg = primary.region || guessRegionFromAddress(aggAddr) || null;
            await c.query(`UPDATE licenses SET address = $2, region = COALESCE($3, region) WHERE id = $1`, [
              licId,
              aggAddr,
              aggReg,
            ]);
          }
        }

        const approveResult = await approveLicenseInTx(c, licId, adminId);
        await c.query('COMMIT');

        await createAuditLog({
          req,
          action: 'LICENSE_APPROVE',
          entityType: 'LICENSE',
          entityId: String(licId),
          severity: 'INFO',
          changes: { before: approveResult.before, after: approveResult.after },
          metadata: {
            batchAi: true,
            correctedSites: corrected.length,
            rewardGranted: approveResult.rewardGranted,
          },
        });
      } catch (e) {
        await c.query('ROLLBACK');
        if (e instanceof ApproveLicenseError) {
          results.push({ id: licId, action: 'error', reason: e.message, code: e.code });
        } else {
          results.push({ id: licId, action: 'error', reason: String(e.message || e) });
        }
        continue;
      } finally {
        c.release();
      }
    }

    results.push({
      id: licId,
      action: dryRun ? 'would_approve' : 'approved',
      correctedSites: corrected.length,
      dryRun,
    });
    if (dryRun) {
      summary.wouldApprove += 1;
    } else {
      summary.approved += 1;
    }
  }

  return { results, nextCursor, summary };
}
