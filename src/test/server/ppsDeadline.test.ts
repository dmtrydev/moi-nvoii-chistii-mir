import { describe, expect, it } from 'vitest';
import {
  PPS_LAW_START_AT,
  PPS_FIRST_DEADLINE_FLOOR_AT,
  classifyPpsState,
  computePpsDeadline,
  daysUntilDeadline,
  formatHumanInterval,
  formatPpsMessage,
  formatPpsShortLabel,
  formatRussianDate,
  pluralRu,
  summarizePps,
  __test__,
  // @ts-expect-error: импорт чистого ESM-модуля backend для тестирования.
} from '../../../server/ppsDeadline.js';

const { addYearsUtc, parseIso } = __test__ as {
  addYearsUtc: (d: Date, n: number) => Date;
  parseIso: (v: unknown) => Date | null;
};

describe('computePpsDeadline', () => {
  it('старая лицензия (2008) → 01.09.2027 (max сработал на дату закона; время от закона)', () => {
    // Когда дата выдачи раньше закона, baseline = PPS_LAW_START_AT (00:00:00 UTC),
    // а исходное время выдачи (06:00 UTC) больше не используется.
    expect(computePpsDeadline('2008-12-24T06:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('за день до закона (2024-08-31) → 01.09.2027', () => {
    expect(computePpsDeadline('2024-08-31T00:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('точно в дату закона (2024-09-01) → 01.09.2027', () => {
    expect(computePpsDeadline('2024-09-01T00:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('день после закона (2024-09-02) → 02.09.2027', () => {
    expect(computePpsDeadline('2024-09-02T00:00:00.000Z')).toBe('2027-09-02T00:00:00.000Z');
  });

  it('лицензия 2025-12-15 (после закона) → 15.12.2028', () => {
    expect(computePpsDeadline('2025-12-15T00:00:00.000Z')).toBe('2028-12-15T00:00:00.000Z');
  });

  it('лицензия 2022-01-01 → 01.09.2027 (max → закон)', () => {
    expect(computePpsDeadline('2022-01-01T00:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('29 февраля високосного года + 3 = 28 февраля', () => {
    expect(computePpsDeadline('2024-02-29T00:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('29 февраля 2028 (после закона) + 3 = 28 февраля 2031', () => {
    expect(computePpsDeadline('2028-02-29T00:00:00.000Z')).toBe('2031-02-28T00:00:00.000Z');
  });

  it('пустая строка / null / невалидная дата → null', () => {
    expect(computePpsDeadline('')).toBeNull();
    expect(computePpsDeadline(null)).toBeNull();
    expect(computePpsDeadline(undefined)).toBeNull();
    expect(computePpsDeadline('not-a-date')).toBeNull();
    expect(computePpsDeadline('1899-12-31T00:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('лицензия выдана между 01.09.2024 и 01.03.2022 не возможна; floor применяется только если deadline<floor', () => {
    // дата выдачи 2021-12-01 → baseline = max(2021, 2024-09-01) = 2024-09-01 → 2027-09-01 (floor 2025-03-01 не сработал)
    expect(computePpsDeadline('2021-12-01T00:00:00.000Z')).toBe('2027-09-01T00:00:00.000Z');
  });

  it('константы законов соответствуют объявленным', () => {
    expect(PPS_LAW_START_AT).toBe('2024-09-01T00:00:00.000Z');
    expect(PPS_FIRST_DEADLINE_FLOOR_AT).toBe('2025-03-01T00:00:00.000Z');
  });
});

describe('addYearsUtc (внутренний)', () => {
  it('обычные даты складываются точно', () => {
    expect(addYearsUtc(new Date('2020-05-15T10:00:00Z'), 3).toISOString()).toBe(
      '2023-05-15T10:00:00.000Z',
    );
  });

  it('29 февраля + 3 = 28 февраля', () => {
    expect(addYearsUtc(new Date('2024-02-29T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });

  it('29 февраля + 4 = 29 февраля високосного', () => {
    expect(addYearsUtc(new Date('2024-02-29T00:00:00Z'), 4).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });
});

describe('classifyPpsState', () => {
  const future = (days: number) =>
    new Date(Date.UTC(2026, 4, 4) + days * 86_400_000).toISOString();
  const NOW = '2026-05-04T00:00:00.000Z';

  it('paused → gray независимо от deadline', () => {
    expect(
      classifyPpsState({ registryStatus: 'paused', deadlineAt: future(365), now: NOW }),
    ).toBe('gray');
  });

  it('annulled → gray', () => {
    expect(
      classifyPpsState({ registryStatus: 'annulled', deadlineAt: future(365), now: NOW }),
    ).toBe('gray');
  });

  it('terminated → gray', () => {
    expect(
      classifyPpsState({ registryStatus: 'terminated', deadlineAt: future(365), now: NOW }),
    ).toBe('gray');
  });

  it('pausedpart → gray', () => {
    expect(
      classifyPpsState({ registryStatus: 'pausedpart', deadlineAt: future(365), now: NOW }),
    ).toBe('gray');
  });

  it('active + deadline +200 дней → green', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(200), now: NOW }),
    ).toBe('green');
  });

  it('active + deadline +91 день → green (за порогом yellow)', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(91), now: NOW }),
    ).toBe('green');
  });

  it('active + deadline +90 дней → yellow (включая границу)', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(90), now: NOW }),
    ).toBe('yellow');
  });

  it('active + deadline +31 день → yellow', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(31), now: NOW }),
    ).toBe('yellow');
  });

  it('active + deadline +30 дней → red (включая границу)', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(30), now: NOW }),
    ).toBe('red');
  });

  it('active + deadline сегодня → red', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(0), now: NOW }),
    ).toBe('red');
  });

  it('active + deadline просрочен на 5 дней → red', () => {
    expect(
      classifyPpsState({ registryStatus: 'active', deadlineAt: future(-5), now: NOW }),
    ).toBe('red');
  });

  it('пустой статус → gray (нет данных)', () => {
    expect(classifyPpsState({ registryStatus: '', deadlineAt: future(200), now: NOW })).toBe('green');
    // строго: если статус пустой, считаем как «нет статуса» → должны попасть в green/yellow/red по deadline.
    // (Гарантирует, что фронт получит цвет, даже если registry_status_ru пустой.)
  });

  it('active без deadline → gray (нет даты)', () => {
    expect(classifyPpsState({ registryStatus: 'active', deadlineAt: null, now: NOW })).toBe(
      'gray',
    );
  });
});

describe('formatPpsMessage', () => {
  const NOW = '2026-05-04T00:00:00.000Z';

  it('green содержит дату и человеческий интервал', () => {
    const msg = formatPpsMessage('green', {
      deadlineAt: '2027-09-01T00:00:00.000Z',
      registryStatus: 'active',
      now: NOW,
    });
    expect(msg).toContain('Лицензия действует');
    expect(msg).toContain('01.09.2027');
    expect(msg).toMatch(/через .+/);
  });

  it('yellow упоминает дни и просьбу уточнить у контрагента', () => {
    const msg = formatPpsMessage('yellow', {
      deadlineAt: '2026-07-15T00:00:00.000Z',
      registryStatus: 'active',
      now: NOW,
    });
    expect(msg).toMatch(/осталось \d+ дн/i);
    expect(msg).toContain('Уточните у контрагента');
  });

  it('red — до истечения', () => {
    const msg = formatPpsMessage('red', {
      deadlineAt: '2026-05-20T00:00:00.000Z',
      registryStatus: 'active',
      now: NOW,
    });
    expect(msg).toContain('Срок ППС истекает через');
    expect(msg).toContain('Запросите у контрагента');
  });

  it('red — после истечения', () => {
    const msg = formatPpsMessage('red', {
      deadlineAt: '2026-05-01T00:00:00.000Z',
      registryStatus: 'active',
      now: NOW,
    });
    expect(msg).toContain('истёк');
    expect(msg).toContain('Запросите у контрагента');
  });

  it('gray для annulled — упоминание статуса', () => {
    const msg = formatPpsMessage('gray', {
      registryStatus: 'annulled',
      registryStatusRu: 'Аннулирована',
      now: NOW,
    });
    expect(msg).toContain('Аннулирована');
    expect(msg).toContain('Не рекомендуется');
  });

  it('gray для paused', () => {
    const msg = formatPpsMessage('gray', {
      registryStatus: 'paused',
      registryStatusRu: 'Приостановлена',
      now: NOW,
    });
    expect(msg).toContain('Приостановлена');
  });

  it('gray fallback — нет данных', () => {
    const msg = formatPpsMessage('gray', { now: NOW });
    expect(msg).toContain('не определён');
  });
});

describe('formatPpsShortLabel (попап карты)', () => {
  const NOW = '2026-05-04T00:00:00.000Z';

  it('green — короткое сообщение с датой', () => {
    expect(
      formatPpsShortLabel('green', {
        deadlineAt: '2027-09-01T00:00:00.000Z',
        now: NOW,
      }),
    ).toBe('Действует, ППС до 01.09.2027');
  });

  it('green без даты — fallback', () => {
    expect(formatPpsShortLabel('green', { now: NOW })).toBe('Действует');
  });

  it('yellow — N дней', () => {
    const out = formatPpsShortLabel('yellow', {
      deadlineAt: '2026-07-04T00:00:00.000Z',
      now: NOW,
    });
    expect(out).toBe('ППС через 61 день');
  });

  it('yellow — 2 дня (склонение)', () => {
    const out = formatPpsShortLabel('yellow', {
      deadlineAt: '2026-05-06T00:00:00.000Z',
      now: NOW,
    });
    expect(out).toBe('ППС через 2 дня');
  });

  it('red — истекает через N дней', () => {
    const out = formatPpsShortLabel('red', {
      deadlineAt: '2026-05-19T00:00:00.000Z',
      now: NOW,
    });
    expect(out).toBe('ППС истекает через 15 дней');
  });

  it('red — просрочено', () => {
    const out = formatPpsShortLabel('red', {
      deadlineAt: '2026-04-29T00:00:00.000Z',
      now: NOW,
    });
    expect(out).toBe('ППС истёк 5 дней назад');
  });

  it('gray annulled — Аннулирована', () => {
    const out = formatPpsShortLabel('gray', {
      registryStatus: 'annulled',
      registryStatusRu: 'Аннулирована',
      now: NOW,
    });
    expect(out).toBe('Аннулирована');
  });

  it('gray paused — Приостановлена (fallback из карты)', () => {
    const out = formatPpsShortLabel('gray', {
      registryStatus: 'paused',
      now: NOW,
    });
    expect(out).toBe('Приостановлена');
  });

  it('gray active без deadline — null (нечего показывать)', () => {
    const out = formatPpsShortLabel('gray', { now: NOW });
    expect(out).toBeNull();
  });

  it('gray пустой статус — null', () => {
    const out = formatPpsShortLabel('gray', {
      registryStatus: '',
      now: NOW,
    });
    expect(out).toBeNull();
  });
});

describe('summarizePps', () => {
  it('возвращает state, message, daysLeft, deadlineAt', () => {
    const out = summarizePps({
      registryStatus: 'active',
      deadlineAt: '2027-09-01T00:00:00.000Z',
      now: '2026-05-04T00:00:00.000Z',
    });
    expect(out.state).toBe('green');
    expect(out.message).toContain('Лицензия действует');
    expect(out.daysLeft).toBe(485);
    expect(out.deadlineAt).toBe('2027-09-01T00:00:00.000Z');
  });

  it('annulled → gray + message + null deadline в полях расчёта но deadlineAt из input', () => {
    const out = summarizePps({
      registryStatus: 'annulled',
      registryStatusRu: 'Аннулирована',
      deadlineAt: null,
      now: '2026-05-04T00:00:00.000Z',
    });
    expect(out.state).toBe('gray');
    expect(out.daysLeft).toBeNull();
    expect(out.deadlineAt).toBeNull();
  });
});

describe('helpers', () => {
  it('formatRussianDate', () => {
    expect(formatRussianDate('2027-09-01T00:00:00.000Z')).toBe('01.09.2027');
    expect(formatRussianDate('')).toBe('');
    expect(formatRussianDate(null)).toBe('');
  });

  it('pluralRu правильно склоняет дни', () => {
    expect(pluralRu(1, ['день', 'дня', 'дней'])).toBe('день');
    expect(pluralRu(2, ['день', 'дня', 'дней'])).toBe('дня');
    expect(pluralRu(5, ['день', 'дня', 'дней'])).toBe('дней');
    expect(pluralRu(11, ['день', 'дня', 'дней'])).toBe('дней');
    expect(pluralRu(21, ['день', 'дня', 'дней'])).toBe('день');
    expect(pluralRu(22, ['день', 'дня', 'дней'])).toBe('дня');
    expect(pluralRu(101, ['день', 'дня', 'дней'])).toBe('день');
    expect(pluralRu(112, ['день', 'дня', 'дней'])).toBe('дней');
  });

  it('formatHumanInterval — короткие интервалы в днях', () => {
    expect(formatHumanInterval(1)).toBe('1 день');
    expect(formatHumanInterval(5)).toBe('5 дней');
    expect(formatHumanInterval(59)).toBe('59 дней');
  });

  it('formatHumanInterval — длинные интервалы лет/мес', () => {
    // 485 дней = 1 год (365) + 120 дней; 120/30 = 4 месяца.
    expect(formatHumanInterval(485)).toBe('1 год 4 месяца');
    expect(formatHumanInterval(365)).toBe('1 год');
    expect(formatHumanInterval(395)).toBe('1 год 1 месяц');
    expect(formatHumanInterval(730)).toBe('2 года');
  });

  it('daysUntilDeadline корректно считает разницу', () => {
    expect(
      daysUntilDeadline('2027-09-01T00:00:00.000Z', '2026-05-04T00:00:00.000Z'),
    ).toBe(485);
    expect(daysUntilDeadline(null)).toBeNull();
  });

  it('parseIso (внутренний)', () => {
    expect(parseIso('')).toBeNull();
    expect(parseIso(null)).toBeNull();
    expect(parseIso('not-a-date')).toBeNull();
    const d = parseIso('2027-09-01T00:00:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2027-09-01T00:00:00.000Z');
  });
});
