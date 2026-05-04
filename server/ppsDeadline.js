/**
 * Расчёт ближайшего срока периодического подтверждения соответствия (ППС)
 * для лицензий по обращению с отходами I–IV классов опасности.
 *
 * Юридическая база:
 *   - ФЗ № 170-ФЗ от 28.04.2023 (часть, вступившая в силу 01.09.2024).
 *   - Постановление Правительства РФ № 622 от 16.05.2024.
 *   - Переходные положения: для лицензий, выданных ДО 01.09.2024,
 *     первичное ППС — через 3 года от наиболее поздней из двух дат
 *     (даты выдачи лицензии и даты последнего планового КНМ),
 *     но не ранее 01.03.2025.
 *
 * Источник «дата последнего КНМ» в выгрузке `tor.knd.gov.ru` отсутствует,
 * поэтому здесь рассчитывается ВЕРХНЯЯ оценка по дате выдачи. Это даёт
 * нижнюю границу дедлайна — в реальности он может быть позже, если
 * лицензиат уже прошёл ППС после 01.03.2025. UI должен показывать дисклеймер.
 */

/** @constant {string} ISO начала действия процедуры ППС. */
export const PPS_LAW_START_AT = '2024-09-01T00:00:00.000Z';

/**
 * @constant {string}
 * Минимальная допустимая дата дедлайна (раньше заявление физически
 * нельзя было подать — ЕПГУ открылся 01.03.2025).
 */
export const PPS_FIRST_DEADLINE_FLOOR_AT = '2025-03-01T00:00:00.000Z';

/** @constant {number} Период ППС, в годах. */
export const PPS_PERIOD_YEARS = 3;

/** @constant {number} Жёлтый порог: ≤ этого числа дней — предупреждение. */
export const PPS_YELLOW_THRESHOLD_DAYS = 90;

/** @constant {number} Красный порог: ≤ этого числа дней — критично. */
export const PPS_RED_THRESHOLD_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/** Карта статусов реестра РПН → русские подписи. */
const REGISTRY_STATUS_LABEL_RU = {
  active: 'Действующая',
  annulled: 'Аннулирована',
  paused: 'Приостановлена',
  pausedpart: 'Частично приостановлена',
  terminated: 'Прекращена',
  unknown: 'Статус не определён',
};

/**
 * Безопасный парсинг ISO-даты. Возвращает Date или null.
 * @param {unknown} v
 * @returns {Date | null}
 */
function parseIso(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Прибавить N лет к UTC-дате с корректной обработкой 29 февраля.
 *   addYearsUtc('2024-02-29', 3) -> 2027-02-28 (а не 2027-03-01).
 * @param {Date} date
 * @param {number} years
 * @returns {Date}
 */
function addYearsUtc(date, years) {
  const result = new Date(date.getTime());
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + years);
  if (result.getUTCMonth() !== month) {
    // Перелив (29 фев → 1 мар) — откатываемся на последний день месяца-цели.
    result.setUTCDate(0);
  }
  return result;
}

/**
 * Срок ближайшего ППС по дате выдачи лицензии.
 *
 * @param {string | Date | null | undefined} dateIssuedIso ISO 8601 или Date.
 * @returns {string | null} ISO 8601 в UTC, либо null если дата невалидна.
 */
export function computePpsDeadline(dateIssuedIso) {
  const issued = parseIso(dateIssuedIso);
  if (!issued) return null;

  const lawStart = parseIso(PPS_LAW_START_AT);
  const floor = parseIso(PPS_FIRST_DEADLINE_FLOOR_AT);
  if (!lawStart || !floor) return null;

  const baseline = issued.getTime() >= lawStart.getTime() ? issued : lawStart;
  let deadline = addYearsUtc(baseline, PPS_PERIOD_YEARS);
  if (deadline.getTime() < floor.getTime()) {
    deadline = floor;
  }
  return deadline.toISOString();
}

/**
 * Классификация состояния лицензии по дедлайну ППС и статусу реестра.
 *
 * @param {object} input
 * @param {string | Date | null | undefined} [input.deadlineAt]
 * @param {string | null | undefined} [input.registryStatus]
 * @param {string | Date | undefined} [input.now]
 * @returns {'green'|'yellow'|'red'|'gray'}
 */
export function classifyPpsState({ deadlineAt, registryStatus, now } = {}) {
  const status = String(registryStatus ?? '').trim().toLowerCase();
  if (status && status !== 'active') return 'gray';

  const deadline = parseIso(deadlineAt);
  if (!deadline) return 'gray';

  const nowDate = parseIso(now) ?? new Date();
  const diffDays = Math.floor((deadline.getTime() - nowDate.getTime()) / MS_PER_DAY);

  if (diffDays <= PPS_RED_THRESHOLD_DAYS) return 'red';
  if (diffDays <= PPS_YELLOW_THRESHOLD_DAYS) return 'yellow';
  return 'green';
}

/**
 * Целое число дней между deadline и now (deadline - now). Может быть отрицательным.
 * @param {string | Date | null | undefined} deadlineAt
 * @param {string | Date | undefined} now
 * @returns {number | null}
 */
export function daysUntilDeadline(deadlineAt, now) {
  const deadline = parseIso(deadlineAt);
  if (!deadline) return null;
  const nowDate = parseIso(now) ?? new Date();
  return Math.floor((deadline.getTime() - nowDate.getTime()) / MS_PER_DAY);
}

/**
 * Человекочитаемая дата в формате DD.MM.YYYY (UTC).
 * @param {string | Date | null | undefined} v
 * @returns {string}
 */
export function formatRussianDate(v) {
  const d = parseIso(v);
  if (!d) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Просклонять русский счётный термин: 1 день / 2 дня / 5 дней.
 * @param {number} n
 * @param {[string, string, string]} forms [один, два, пять]
 * @returns {string}
 */
export function pluralRu(n, forms) {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/**
 * Преобразование числа дней в «X лет Y мес» для крупных дистанций.
 * @param {number} days
 * @returns {string}
 */
export function formatHumanInterval(days) {
  if (!Number.isFinite(days)) return '';
  const total = Math.abs(Math.trunc(days));
  if (total < 60) {
    return `${total} ${pluralRu(total, ['день', 'дня', 'дней'])}`;
  }
  const years = Math.floor(total / 365);
  const months = Math.floor((total - years * 365) / 30);
  const parts = [];
  if (years > 0) parts.push(`${years} ${pluralRu(years, ['год', 'года', 'лет'])}`);
  if (months > 0) parts.push(`${months} ${pluralRu(months, ['месяц', 'месяца', 'месяцев'])}`);
  if (parts.length === 0) return `${total} ${pluralRu(total, ['день', 'дня', 'дней'])}`;
  return parts.join(' ');
}

/**
 * Готовое сообщение для UI по классификации.
 *
 * @param {'green'|'yellow'|'red'|'gray'} state
 * @param {object} ctx
 * @param {string | Date | null | undefined} [ctx.deadlineAt]
 * @param {string | null | undefined} [ctx.registryStatus]
 * @param {string | null | undefined} [ctx.registryStatusRu]
 * @param {string | Date | undefined} [ctx.now]
 * @returns {string}
 */
export function formatPpsMessage(state, ctx = {}) {
  const { deadlineAt, registryStatus, registryStatusRu, now } = ctx;

  if (state === 'gray') {
    const status = String(registryStatus ?? '').trim().toLowerCase();
    if (status && status !== 'active') {
      const label =
        registryStatusRu || REGISTRY_STATUS_LABEL_RU[status] || REGISTRY_STATUS_LABEL_RU.unknown;
      return `Лицензия в реестре РПН помечена как «${label}». Не рекомендуется к использованию для подтверждения деятельности.`;
    }
    return 'Срок периодического подтверждения соответствия не определён — данные о лицензии не получены из реестра РПН.';
  }

  const days = daysUntilDeadline(deadlineAt, now);
  const dateStr = formatRussianDate(deadlineAt);

  if (state === 'green') {
    if (days == null || !dateStr) return 'Лицензия действует.';
    const human = formatHumanInterval(days);
    return `Лицензия действует. Ближайший срок периодического подтверждения соответствия — до ${dateStr} (через ${human}).`;
  }

  if (state === 'yellow') {
    if (days == null) return 'До ближайшего срока ППС осталось менее 90 дней.';
    return `До ближайшего срока ППС осталось ${days} ${pluralRu(days, ['день', 'дня', 'дней'])}. Уточните у контрагента, проходил ли он подтверждение.`;
  }

  // red
  if (days == null) {
    return 'Срок ППС истекает. Запросите у контрагента подтверждение прохождения ППС перед заключением договора.';
  }
  if (days < 0) {
    const overdue = Math.abs(days);
    return `Срок ППС истёк ${overdue} ${pluralRu(overdue, ['день', 'дня', 'дней'])} назад. Запросите у контрагента подтверждение прохождения ППС перед заключением договора.`;
  }
  return `Срок ППС истекает через ${days} ${pluralRu(days, ['день', 'дня', 'дней'])}. Запросите у контрагента подтверждение прохождения ППС перед заключением договора.`;
}

/**
 * Полная сводка для API (state + сообщение + диагностика).
 *
 * @param {object} input
 * @param {string | Date | null | undefined} [input.deadlineAt]
 * @param {string | null | undefined} [input.registryStatus]
 * @param {string | null | undefined} [input.registryStatusRu]
 * @param {string | Date | undefined} [input.now]
 * @returns {{
 *   state: 'green'|'yellow'|'red'|'gray',
 *   message: string,
 *   daysLeft: number | null,
 *   deadlineAt: string | null,
 * }}
 */
export function summarizePps(input = {}) {
  const state = classifyPpsState(input);
  const message = formatPpsMessage(state, input);
  const days = daysUntilDeadline(input.deadlineAt, input.now);
  const deadline = parseIso(input.deadlineAt);
  return {
    state,
    message,
    daysLeft: days,
    deadlineAt: deadline ? deadline.toISOString() : null,
  };
}

export const __test__ = { addYearsUtc, parseIso };
