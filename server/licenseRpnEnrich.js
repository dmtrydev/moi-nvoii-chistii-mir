/**
 * Обогащение карточки лицензии данными из rpn_registry_snapshot:
 *   - расчёт ppsState/ppsMessage по дедлайну ППС и статусу реестра;
 *   - проброс полей RPN (номер лицензии, дата выдачи, орган, дата синка) в API.
 *
 * Чистая функция (без БД), легко тестируется.
 */
import { summarizePps } from './ppsDeadline.js';

/**
 * @typedef {object} RpnSnapshotRow
 * @property {string} innNorm
 * @property {string | null} licenseNumber
 * @property {string | null} dateIssued
 * @property {string} registryStatus
 * @property {string | null} registryStatusRu
 * @property {boolean} registryInactive
 * @property {string | null} unitShortName
 * @property {string | null} registryModifiedAt
 * @property {string | null} ppsDeadlineAt
 * @property {string | null} syncedAt
 */

/**
 * @param {object} license  — карточка лицензии в виде, как её отдают существующие SQL-запросы.
 * @param {RpnSnapshotRow | null | undefined} snapshot
 * @param {{ now?: string | Date }} [opts]
 * @returns {object} тот же license + поля rpn / pps.
 */
export function enrichLicenseWithRpnSnapshot(license, snapshot, opts = {}) {
  const now = opts.now;

  if (!snapshot) {
    return {
      ...license,
      rpnSnapshot: null,
      pps: {
        state: 'gray',
        message:
          'Срок периодического подтверждения соответствия не определён — данные о лицензии не получены из реестра РПН.',
        daysLeft: null,
        deadlineAt: null,
      },
    };
  }

  const summary = summarizePps({
    deadlineAt: snapshot.ppsDeadlineAt,
    registryStatus: snapshot.registryStatus,
    registryStatusRu: snapshot.registryStatusRu,
    now,
  });

  return {
    ...license,
    rpnSnapshot: {
      licenseNumber: snapshot.licenseNumber ?? null,
      dateIssued: snapshot.dateIssued ?? null,
      registryStatus: snapshot.registryStatus,
      registryStatusRu: snapshot.registryStatusRu ?? null,
      registryInactive: Boolean(snapshot.registryInactive),
      unitShortName: snapshot.unitShortName ?? null,
      registryModifiedAt: snapshot.registryModifiedAt ?? null,
      syncedAt: snapshot.syncedAt ?? null,
      ppsDeadlineAt: snapshot.ppsDeadlineAt ?? null,
    },
    pps: summary,
  };
}
