import { describe, expect, it } from 'vitest';
import {
  REGISTRY_STATUS_LABELS_RU,
  extractInn,
  extractSnapshot,
  extractSnapshotsFromContent,
  // @ts-expect-error: импорт чистого ESM-модуля backend для тестирования.
} from '../../../server/rpnRegistryMap.js';

import activeFixture from './fixtures/rpn-active.json';
import annulledFixture from './fixtures/rpn-annulled.json';
import personIpFixture from './fixtures/rpn-person-ip.json';
import brokenFixture from './fixtures/rpn-broken.json';

describe('extractInn', () => {
  it('берёт ИНН из organization', () => {
    expect(extractInn(activeFixture.content[0])).toBe('3616016035');
  });

  it('берёт ИНН из person, если organization пуст', () => {
    expect(extractInn(personIpFixture.content[0])).toBe('773412345678');
  });

  it('null/невалидный entry → null', () => {
    expect(extractInn(null)).toBeNull();
    expect(extractInn(undefined)).toBeNull();
    expect(extractInn({})).toBeNull();
    expect(extractInn({ subject: null })).toBeNull();
    expect(extractInn({ subject: { data: null } })).toBeNull();
  });

  it('ИНН с мусорными символами → нормализуется', () => {
    expect(
      extractInn({ subject: { data: { organization: { inn: ' 7707083893 ' } } } }),
    ).toBe('7707083893');
  });

  it('ИНН неправильной длины → null', () => {
    expect(
      extractInn({ subject: { data: { organization: { inn: '123' } } } }),
    ).toBeNull();
    expect(
      extractInn({ subject: { data: { organization: { inn: '12345678901' } } } }),
    ).toBeNull(); // 11 цифр — не 10 и не 12
  });
});

describe('extractSnapshot', () => {
  it('активная лицензия ЮЛ → корректный снапшот', () => {
    const snap = extractSnapshot(activeFixture.content[0]);
    expect(snap).not.toBeNull();
    expect(snap?.innNorm).toBe('3616016035');
    expect(snap?.licenseNumber).toBe('Л020-00113-36/00096132');
    expect(snap?.dateIssued).toBe('2019-08-09T06:00:00.000Z');
    expect(snap?.registryStatus).toBe('active');
    expect(snap?.registryStatusRu).toBe('Действующая');
    expect(snap?.registryInactive).toBe(false);
    expect(snap?.unitShortName).toBe(
      'Центрально-Черноземное межрегиональное управление Росприроднадзора',
    );
    expect(snap?.registryModifiedAt).toBe('2025-07-11T11:02:45.776Z');
    // ППС: дата выдачи 2019, до закона → дедлайн = 01.09.2027
    expect(snap?.ppsDeadlineAt).toBe('2027-09-01T00:00:00.000Z');
  });

  it('аннулированная лицензия → registryInactive=true, статус ru', () => {
    const snap = extractSnapshot(annulledFixture.content[0]);
    expect(snap?.innNorm).toBe('5024092296');
    expect(snap?.registryStatus).toBe('annulled');
    expect(snap?.registryStatusRu).toBe('Аннулирована');
    expect(snap?.registryInactive).toBe(true);
  });

  it('ИП (person) → ИНН 12 цифр', () => {
    const snap = extractSnapshot(personIpFixture.content[0]);
    expect(snap?.innNorm).toBe('773412345678');
    expect(snap?.registryStatus).toBe('paused');
    expect(snap?.registryStatusRu).toBe('Приостановлена');
    expect(snap?.registryInactive).toBe(true);
    // Дата выдачи 15.03.2025 (после закона) → дедлайн = 15.03.2028
    expect(snap?.ppsDeadlineAt).toBe('2028-03-15T00:00:00.000Z');
  });

  it('null entry → null', () => {
    expect(extractSnapshot(null)).toBeNull();
    expect(extractSnapshot(undefined)).toBeNull();
    expect(extractSnapshot('')).toBeNull();
    expect(extractSnapshot(42)).toBeNull();
  });

  it('запись без ИНН → null', () => {
    expect(extractSnapshot(brokenFixture.content[0])).toBeNull();
  });

  it('battery: запись с битой датой → snapshot есть, dateIssued/ppsDeadlineAt = null', () => {
    const snap = extractSnapshot(brokenFixture.content[4]);
    expect(snap).not.toBeNull();
    expect(snap?.innNorm).toBe('9876543210');
    expect(snap?.dateIssued).toBeNull();
    expect(snap?.ppsDeadlineAt).toBeNull();
    expect(snap?.registryStatus).toBe('unknown_status');
    expect(snap?.registryStatusRu).toContain('Неизвестный');
    expect(snap?.registryInactive).toBe(true);
  });

  it('пустой статус → unknown', () => {
    const snap = extractSnapshot(brokenFixture.content[3]);
    expect(snap).toBeNull(); // ИНН там некорректный → snapshot null
  });

  it('rawJson содержит компактный subset, без objects/wasteTypes', () => {
    const snap = extractSnapshot(activeFixture.content[0]);
    expect(snap?.rawJson).toBeDefined();
    expect((snap?.rawJson as Record<string, unknown>).number).toBe('Л020-00113-36/00096132');
    expect((snap?.rawJson as Record<string, unknown>).objects).toBeUndefined();
    expect((snap?.rawJson as Record<string, unknown>).licensingActivityRegistryWasteRPN).toBeUndefined();
  });
});

describe('extractSnapshotsFromContent', () => {
  it('одиночная обёртка { content: [...] }', () => {
    const out = extractSnapshotsFromContent(activeFixture);
    expect(out).toHaveLength(1);
    expect(out[0]?.innNorm).toBe('3616016035');
  });

  it('массив документов', () => {
    const out = extractSnapshotsFromContent([activeFixture, annulledFixture]);
    expect(out).toHaveLength(2);
    const inns = out.map((x: { innNorm: string } | null) => x?.innNorm).sort();
    expect(inns).toEqual(['3616016035', '5024092296']);
  });

  it('фильтрует битые записи и сохраняет валидные', () => {
    const out = extractSnapshotsFromContent(brokenFixture);
    expect(out).toHaveLength(1);
    expect(out[0]?.innNorm).toBe('9876543210');
  });

  it('null / пустые входы', () => {
    expect(extractSnapshotsFromContent(null)).toEqual([]);
    expect(extractSnapshotsFromContent(undefined)).toEqual([]);
    expect(extractSnapshotsFromContent({})).toEqual([]);
    expect(extractSnapshotsFromContent({ content: null })).toEqual([]);
  });

  it('два документа с одним ИНН — побеждает запись с самой свежей dateLastModification', () => {
    const older = {
      content: [
        {
          status: 'active',
          subject: { data: { organization: { inn: '7707083893' } } },
          number: 'OLD',
          dateIssued: '2020-01-01T00:00:00Z',
          dateLastModification: '2024-01-01T00:00:00Z',
        },
      ],
    };
    const newer = {
      content: [
        {
          status: 'paused',
          subject: { data: { organization: { inn: '7707083893' } } },
          number: 'NEW',
          dateIssued: '2020-01-01T00:00:00Z',
          dateLastModification: '2025-06-01T00:00:00Z',
        },
      ],
    };
    const out = extractSnapshotsFromContent([older, newer]);
    expect(out).toHaveLength(1);
    expect(out[0]?.licenseNumber).toBe('NEW');
    expect(out[0]?.registryStatus).toBe('paused');
  });
});

describe('REGISTRY_STATUS_LABELS_RU', () => {
  it('содержит все известные статусы реестра', () => {
    expect(REGISTRY_STATUS_LABELS_RU.active).toBe('Действующая');
    expect(REGISTRY_STATUS_LABELS_RU.annulled).toBe('Аннулирована');
    expect(REGISTRY_STATUS_LABELS_RU.paused).toBe('Приостановлена');
    expect(REGISTRY_STATUS_LABELS_RU.pausedpart).toBe('Частично приостановлена');
    expect(REGISTRY_STATUS_LABELS_RU.terminated).toBe('Прекращена');
  });
});
