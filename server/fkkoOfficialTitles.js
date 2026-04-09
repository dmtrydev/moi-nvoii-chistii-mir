import { query } from './db.js';

/** Те же условия, что у GET /api/filters/fkko */
export async function queryDistinctApprovedFkkoCodes() {
  const rows = await query(
    `SELECT DISTINCT sfa.fkko_code AS code
     FROM site_fkko_activities sfa
     JOIN license_sites s ON s.id = sfa.site_id
     JOIN licenses l ON l.id = s.license_id
     WHERE l.deleted_at IS NULL AND l.status = 'approved'
       AND (l.import_source IS DISTINCT FROM 'rpn_registry' OR NOT l.import_registry_inactive)
       AND sfa.fkko_code ~ '^[0-9]{11}$'
     ORDER BY code ASC`,
    [],
  );
  return rows.rows.map((r) => String(r.code ?? '').trim()).filter(Boolean);
}

/**
 * @param {string[]} codes11
 * @returns {Promise<Record<string, string>>}
 */
export async function loadFkkoTitlesFromDb(codes11) {
  const normalized = [...new Set(codes11.map((c) => String(c ?? '').replace(/\D/g, '')).filter((c) => /^\d{11}$/.test(c)))];
  if (normalized.length === 0) return {};
  const rows = await query(
    `SELECT code, title FROM fkko_official_titles WHERE code = ANY($1::text[])`,
    [normalized],
  );
  const out = /** @type {Record<string, string>} */ ({});
  for (const r of rows.rows) {
    const code = String(r.code ?? '');
    const title = String(r.title ?? '').trim();
    if (code && title) out[code] = title;
  }
  return out;
}

/**
 * @param {Record<string, string>} titlesByCode
 */
export async function upsertFkkoOfficialTitles(titlesByCode) {
  const entries = Object.entries(titlesByCode).filter(
    ([c, t]) => /^\d{11}$/.test(String(c)) && String(t ?? '').trim(),
  );
  if (entries.length === 0) return;
  const codes = entries.map(([c]) => c);
  const titles = entries.map(([, t]) => String(t).trim());
  await query(
    `INSERT INTO fkko_official_titles (code, title)
     SELECT * FROM unnest($1::text[], $2::text[])
     ON CONFLICT (code) DO UPDATE SET
       title = EXCLUDED.title,
       updated_at = now()`,
    [codes, titles],
  );
}
