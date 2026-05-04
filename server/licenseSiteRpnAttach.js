/**
 * Обогащает строку ответа `/api/license-sites*` и `/api/search/enterprises`
 * полями `rpnSnapshot` и `pps` так же, как карточка лицензии.
 *
 * SQL должен выбирать временные колонки с префиксом `__rpnSnap` (ниже — константы),
 * которые здесь вырезаются из ответа.
 */
import { enrichLicenseWithRpnSnapshot } from './licenseRpnEnrich.js';

/** Фрагмент LEFT JOIN для всех запросов «площадка + лицензия». */
export const LICENSE_SITES_RPN_JOIN_SQL = `
LEFT JOIN rpn_registry_snapshot rpn
  ON rpn.inn_norm = regexp_replace(COALESCE(l.inn, ''), '[^0-9]', '', 'g')
`;

/** Дополнительные колонки SELECT (после `site_label`, через запятую). */
export const LICENSE_SITES_RPN_SELECT_COLUMNS = `rpn.inn_norm AS "__rpnSnapInnNorm",
        rpn.license_number AS "__rpnSnapLicenseNumber",
        rpn.date_issued AS "__rpnSnapDateIssued",
        rpn.registry_status AS "__rpnSnapRegistryStatus",
        rpn.registry_status_ru AS "__rpnSnapRegistryStatusRu",
        rpn.registry_inactive AS "__rpnSnapRegistryInactive",
        rpn.unit_short_name AS "__rpnSnapUnitShortName",
        rpn.registry_modified_at AS "__rpnSnapRegistryModifiedAt",
        rpn.pps_deadline_at AS "__rpnSnapPpsDeadlineAt",
        rpn.synced_at AS "__rpnSnapSyncedAt"`;

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function toIso(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  }
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** @param {Record<string, unknown>} row */
function pickSnapshot(row) {
  const innNorm = row.__rpnSnapInnNorm;
  if (innNorm == null || innNorm === '') return null;
  return {
    innNorm: String(innNorm),
    licenseNumber: row.__rpnSnapLicenseNumber == null ? null : String(row.__rpnSnapLicenseNumber),
    dateIssued: toIso(row.__rpnSnapDateIssued),
    registryStatus: String(row.__rpnSnapRegistryStatus ?? 'unknown').trim().toLowerCase() || 'unknown',
    registryStatusRu:
      row.__rpnSnapRegistryStatusRu == null ? null : String(row.__rpnSnapRegistryStatusRu),
    registryInactive: Boolean(row.__rpnSnapRegistryInactive),
    unitShortName: row.__rpnSnapUnitShortName == null ? null : String(row.__rpnSnapUnitShortName),
    registryModifiedAt: toIso(row.__rpnSnapRegistryModifiedAt),
    ppsDeadlineAt: toIso(row.__rpnSnapPpsDeadlineAt),
    syncedAt: toIso(row.__rpnSnapSyncedAt),
  };
}

/**
 * Удалить служебные ключи `__rpnSnap*` из объекта.
 * @param {Record<string, unknown>} row
 */
function stripRpnSnapColumns(row) {
  /** @type {Record<string, unknown>} */
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (k.startsWith('__rpnSnap')) delete out[k];
  }
  return out;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function enrichLicenseSiteApiRow(row) {
  const snapshot = pickSnapshot(row);
  const base = stripRpnSnapColumns(row);
  return enrichLicenseWithRpnSnapshot(base, snapshot);
}
