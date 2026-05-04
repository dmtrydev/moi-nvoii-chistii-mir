/**
 * Узкий маппинг записи реестра РПН (`tor.knd.gov.ru/ext/search/licensesWasteRPN`)
 * в snapshot-row для таблицы `rpn_registry_snapshot`.
 *
 * Не пересекается с `mapRegistryEntryToSites` из `scripts/import-rpn-licenses-json.js`:
 * та функция строит полные строки `licenses` + `license_sites` + `site_fkko_activities`,
 * а здесь — только плоский снимок «состояния лицензии» по ИНН.
 */
import { normalizeInn } from './innUtils.js';
import { computePpsDeadline } from './ppsDeadline.js';

/** Карта статусов реестра РПН → русские подписи. */
export const REGISTRY_STATUS_LABELS_RU = {
  active: 'Действующая',
  annulled: 'Аннулирована',
  paused: 'Приостановлена',
  pausedpart: 'Частично приостановлена',
  terminated: 'Прекращена',
};

/** Безопасное приведение к ISO-строке (или null). */
function toIso(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Безопасный trim с обнулением пустых строк. */
function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Извлечь ИНН из записи реестра. Поддерживает `subject.data.organization.inn`
 * и `subject.data.person.inn`. Возвращает строку из 10/12 цифр или null.
 *
 * @param {object | null | undefined} entry
 * @returns {string | null}
 */
export function extractInn(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const subj = entry.subject;
  if (!subj || typeof subj !== 'object') return null;
  const data = subj.data;
  if (!data || typeof data !== 'object') return null;

  const orgRaw =
    data.organization && typeof data.organization === 'object' ? data.organization.inn : null;
  const personRaw =
    data.person && typeof data.person === 'object' ? data.person.inn : null;

  return normalizeInn(orgRaw) ?? normalizeInn(personRaw);
}

/**
 * @param {object | null | undefined} entry
 * @returns {string | null}
 */
function extractUnitShortName(entry) {
  const u = entry?.unit;
  if (!u || typeof u !== 'object') return null;
  return trimOrNull(u.shortName) || trimOrNull(u.name);
}

/**
 * Компактный JSON, который сохраняется в `raw_json` для дебага и страховки
 * на будущее (не весь entry — он содержит огромные `objects` уже учтённые
 * в `license_sites` и `site_fkko_activities`).
 *
 * @param {object} entry
 */
function buildRawJson(entry) {
  const u = entry?.unit && typeof entry.unit === 'object' ? entry.unit : null;
  const order = entry?.orderData && typeof entry.orderData === 'object' ? entry.orderData : null;
  return {
    number: trimOrNull(entry?.number),
    dateIssued: toIso(entry?.dateIssued),
    dateLastModification: toIso(entry?.dateLastModification),
    status: trimOrNull(entry?.status)?.toLowerCase() ?? null,
    unit: u
      ? {
          shortName: trimOrNull(u.shortName),
          name: trimOrNull(u.name),
        }
      : null,
    orderData: order
      ? {
          number: trimOrNull(order.number),
          date: toIso(order.date),
        }
      : null,
  };
}

/**
 * Извлечь snapshot-row из одной записи реестра.
 *
 * @param {object | null | undefined} entry
 * @returns {{
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
 * } | null}
 */
export function extractSnapshot(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const innNorm = extractInn(entry);
  if (!innNorm) return null;

  const statusRaw = String(entry.status ?? '').trim().toLowerCase();
  const registryStatus = statusRaw || 'unknown';
  const registryInactive = registryStatus !== 'active';
  const registryStatusRu =
    REGISTRY_STATUS_LABELS_RU[registryStatus] ||
    (registryStatus === 'unknown' ? null : `Неизвестный статус: ${registryStatus}`);

  const dateIssued = toIso(entry.dateIssued);
  const ppsDeadlineAt = computePpsDeadline(dateIssued);

  return {
    innNorm,
    licenseNumber: trimOrNull(entry.number),
    dateIssued,
    registryStatus,
    registryStatusRu,
    registryInactive,
    unitShortName: extractUnitShortName(entry),
    registryModifiedAt: toIso(entry.dateLastModification),
    ppsDeadlineAt,
    rawJson: buildRawJson(entry),
  };
}

/**
 * Развёрнутая обёртка реестра (`tor.knd.gov.ru` отдаёт `{ content: [entry, ...] }`).
 * Возвращает все валидные снапшоты по найденным записям. Если у нескольких записей
 * один и тот же ИНН — побеждает запись с самой поздней `dateLastModification`,
 * либо первая встретившаяся при равных датах.
 *
 * @param {object | object[] | null | undefined} root
 * @returns {ReturnType<typeof extractSnapshot>[]}
 */
export function extractSnapshotsFromContent(root) {
  if (!root) return [];
  const docs = Array.isArray(root) ? root : [root];
  /** @type {Map<string, ReturnType<typeof extractSnapshot>>} */
  const byInn = new Map();
  for (const doc of docs) {
    const content = Array.isArray(doc?.content) ? doc.content : [];
    for (const entry of content) {
      const snap = extractSnapshot(entry);
      if (!snap) continue;
      const prev = byInn.get(snap.innNorm);
      if (!prev) {
        byInn.set(snap.innNorm, snap);
        continue;
      }
      const prevTs = prev.registryModifiedAt
        ? Date.parse(prev.registryModifiedAt)
        : Number.NEGATIVE_INFINITY;
      const newTs = snap.registryModifiedAt
        ? Date.parse(snap.registryModifiedAt)
        : Number.NEGATIVE_INFINITY;
      if (newTs > prevTs) byInn.set(snap.innNorm, snap);
    }
  }
  return [...byInn.values()];
}
