import { describe, expect, it } from 'vitest';
// @ts-expect-error: импорт чистого ESM-модуля backend для тестирования.
import { enrichLicenseWithRpnSnapshot } from '../../../server/licenseRpnEnrich.js';

const baseLicense = {
  id: 1,
  companyName: 'ООО "ТЕСТ"',
  inn: '7707083893',
  status: 'approved',
};

const NOW = '2026-05-04T00:00:00.000Z';

describe('enrichLicenseWithRpnSnapshot', () => {
  it('snapshot отсутствует → pps.state=gray + дефолтное сообщение', () => {
    const out = enrichLicenseWithRpnSnapshot(baseLicense, null);
    expect(out.id).toBe(1);
    expect(out.rpnSnapshot).toBeNull();
    expect(out.pps.state).toBe('gray');
    expect(out.pps.message).toContain('не определён');
    expect(out.pps.daysLeft).toBeNull();
    expect(out.pps.deadlineAt).toBeNull();
  });

  it('активная свежая лицензия → green с человеческим сообщением', () => {
    const snapshot = {
      innNorm: '7707083893',
      licenseNumber: 'Л020-00113-77/00099999',
      dateIssued: '2024-09-01T00:00:00.000Z',
      registryStatus: 'active',
      registryStatusRu: 'Действующая',
      registryInactive: false,
      unitShortName: 'МУ Росприроднадзора',
      registryModifiedAt: '2025-12-01T00:00:00.000Z',
      ppsDeadlineAt: '2027-09-01T00:00:00.000Z',
      syncedAt: '2026-05-03T03:00:00.000Z',
    };
    const out = enrichLicenseWithRpnSnapshot(baseLicense, snapshot, { now: NOW });
    expect(out.pps.state).toBe('green');
    expect(out.pps.message).toContain('Лицензия действует');
    expect(out.pps.message).toContain('01.09.2027');
    expect(out.pps.daysLeft).toBe(485);
    expect(out.rpnSnapshot?.licenseNumber).toBe('Л020-00113-77/00099999');
    expect(out.rpnSnapshot?.unitShortName).toBe('МУ Росприроднадзора');
    expect(out.rpnSnapshot?.syncedAt).toBe('2026-05-03T03:00:00.000Z');
  });

  it('аннулированная → gray с упоминанием статуса', () => {
    const snapshot = {
      innNorm: '7707083893',
      licenseNumber: 'Л020-OLD',
      dateIssued: '2008-01-01T00:00:00.000Z',
      registryStatus: 'annulled',
      registryStatusRu: 'Аннулирована',
      registryInactive: true,
      unitShortName: 'МУ',
      registryModifiedAt: null,
      ppsDeadlineAt: '2027-09-01T00:00:00.000Z',
      syncedAt: '2026-05-03T03:00:00.000Z',
    };
    const out = enrichLicenseWithRpnSnapshot(baseLicense, snapshot, { now: NOW });
    expect(out.pps.state).toBe('gray');
    expect(out.pps.message).toContain('Аннулирована');
    expect(out.pps.message).toContain('Не рекомендуется');
    expect(out.rpnSnapshot?.registryInactive).toBe(true);
  });

  it('активная с дедлайном через 60 дней → yellow', () => {
    const snapshot = {
      innNorm: '7707083893',
      licenseNumber: 'Л020-X',
      dateIssued: '2025-04-01T00:00:00.000Z',
      registryStatus: 'active',
      registryStatusRu: 'Действующая',
      registryInactive: false,
      unitShortName: null,
      registryModifiedAt: null,
      ppsDeadlineAt: '2026-07-03T00:00:00.000Z', // через 60 дней от NOW
      syncedAt: NOW,
    };
    const out = enrichLicenseWithRpnSnapshot(baseLicense, snapshot, { now: NOW });
    expect(out.pps.state).toBe('yellow');
    expect(out.pps.message).toMatch(/осталось \d+/);
  });

  it('активная просрочена → red с «истёк»', () => {
    const snapshot = {
      innNorm: '7707083893',
      licenseNumber: 'Л020-Y',
      dateIssued: '2020-01-01T00:00:00.000Z',
      registryStatus: 'active',
      registryStatusRu: 'Действующая',
      registryInactive: false,
      unitShortName: null,
      registryModifiedAt: null,
      ppsDeadlineAt: '2026-04-15T00:00:00.000Z', // 19 дней назад
      syncedAt: NOW,
    };
    const out = enrichLicenseWithRpnSnapshot(baseLicense, snapshot, { now: NOW });
    expect(out.pps.state).toBe('red');
    expect(out.pps.message).toContain('истёк');
  });

  it('исходные поля license не теряются и не перезаписываются', () => {
    const out = enrichLicenseWithRpnSnapshot(baseLicense, null);
    expect(out.id).toBe(baseLicense.id);
    expect(out.companyName).toBe(baseLicense.companyName);
    expect(out.inn).toBe(baseLicense.inn);
    expect(out.status).toBe(baseLicense.status);
  });
});
