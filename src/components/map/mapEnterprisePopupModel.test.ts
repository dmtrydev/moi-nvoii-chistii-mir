import { describe, expect, it } from 'vitest';
import type { LicenseData } from '@/types';
import { buildMapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';

function baseSource(): LicenseData {
  return {
    id: 1,
    siteId: 101,
    companyName: 'ООО Эко Тест',
    inn: '4501217153',
    address: 'Курганская область, г. Курган, ул. Омская, 48 а',
    fkkoCodes: ['47110101521', '36122203393'],
    activityTypes: ['Сбор'],
    sites: [
      {
        id: 101,
        siteLabel: 'Основная площадка',
        address: 'Курганская область, г. Курган, ул. Омская, 48 а',
        lat: 55.1,
        lng: 65.3,
        fkkoCodes: ['47110101521'],
        activityTypes: ['Сбор'],
      },
    ],
  };
}

describe('buildMapEnterprisePopupViewModel', () => {
  it('builds rows from source and matched site', () => {
    const model = buildMapEnterprisePopupViewModel({
      pointAddress: 'Курганская область, г. Курган, ул. Омская, 48 а',
      pointInn: '4501217153',
      source: baseSource(),
      pointLat: 55.1,
      pointLng: 65.3,
    });

    expect(model.title).toBe('ООО Эко Тест');
    expect(model.enterpriseDetailsHref).toBe('/enterprise/1');
    expect(model.subtitleAddress).toContain('Курганская область');
    expect(model.infoRows).toHaveLength(2);
    expect(model.infoRows.find((x) => x.key === 'inn')?.value).toBe('4501217153');
    expect(model.infoRows.find((x) => x.key === 'contacts')?.value).toBe('Скоро по подписке');
    expect(model.siteSwitches).toHaveLength(1);
    expect(model.siteSwitches[0]?.label).toBe('Основная площадка');
    expect(model.siteSwitches[0]?.isActive).toBe(true);
    expect(model.rpnStrip).toBeNull();
  });

  it('enterpriseDetailsHref is null when license id is missing', () => {
    const source = baseSource();
    delete source.id;

    const model = buildMapEnterprisePopupViewModel({
      pointAddress: 'Курганская область, г. Курган',
      pointInn: '4501217153',
      source,
      pointLat: 55.1,
      pointLng: 65.3,
    });

    expect(model.enterpriseDetailsHref).toBeNull();
  });

  it('uses safe fallbacks for empty values', () => {
    const source = baseSource();
    source.companyName = '';
    source.inn = '';
    source.address = '';
    source.fkkoCodes = [];
    source.siteLabel = null;
    source.sites = [];

    const model = buildMapEnterprisePopupViewModel({
      pointAddress: '',
      pointInn: '',
      source,
    });

    expect(model.title).toBe('Организация');
    expect(model.enterpriseDetailsHref).toBe('/enterprise/1');
    expect(model.subtitleAddress).toBe('Адрес не указан');
    expect(model.infoRows.find((x) => x.key === 'inn')?.value).toBe('не указан');
    expect(model.siteSwitches).toHaveLength(0);
    expect(model.rpnStrip).toBeNull();
  });

  it('builds site switches from explicit map candidates', () => {
    const source = baseSource();
    source.sites = [];

    const model = buildMapEnterprisePopupViewModel({
      pointAddress: 'Курганская область, г. Курган, ул. Омская, 48 а',
      pointInn: '4501217153',
      source,
      pointId: 202,
      pointLat: 55.2,
      pointLng: 65.4,
      siteCandidates: [
        { pointId: 101, lat: 55.1, lng: 65.3, label: 'Основная площадка' },
        { pointId: 202, lat: 55.2, lng: 65.4, label: 'Площадка 2' },
        { pointId: 303, lat: 55.3, lng: 65.5, label: 'Площадка 3' },
      ],
    });

    expect(model.siteSwitches).toHaveLength(3);
    expect(model.siteSwitches.map((x) => x.label)).toEqual([
      'Основная площадка',
      'Площадка 2',
      'Площадка 3',
    ]);
    expect(model.siteSwitches.find((x) => x.pointId === 202)?.isActive).toBe(true);
    expect(model.siteSwitches.find((x) => x.pointId === 101)?.isActive).toBe(false);
    expect(model.rpnStrip).toBeNull();
  });

  it('adds rpnStrip with registry line and PPS deadline when API returned snapshot', () => {
    const source = baseSource();
    source.pps = {
      state: 'green',
      message: 'Лицензия действует. Ближайшее периодическое подтверждение соответствия до 01.09.2027.',
      daysLeft: 485,
      deadlineAt: '2027-09-01T00:00:00.000Z',
    };
    source.rpnSnapshot = {
      licenseNumber: 'Л020-01',
      dateIssued: '2020-01-15T00:00:00.000Z',
      registryStatus: 'active',
      registryStatusRu: 'Действующая',
      registryInactive: false,
      unitShortName: null,
      registryModifiedAt: null,
      syncedAt: '2026-05-01T00:00:00.000Z',
      ppsDeadlineAt: '2027-09-01T00:00:00.000Z',
    };

    const model = buildMapEnterprisePopupViewModel({
      pointAddress: 'Курганская область, г. Курган, ул. Омская, 48 а',
      pointInn: '4501217153',
      source,
      pointLat: 55.1,
      pointLng: 65.3,
    });

    expect(model.rpnStrip).not.toBeNull();
    expect(model.rpnStrip?.state).toBe('green');
    expect(model.rpnStrip?.registryStatusText).toBe('Действующая');
    expect(model.rpnStrip?.ppsCheckText).toBe('До 01.09.2027 (осталось 485 дней)');
  });

  it('rpnStrip shows registry status when pps is gray', () => {
    const source = baseSource();
    source.pps = {
      state: 'gray',
      message: 'Аннулирована.',
      daysLeft: null,
      deadlineAt: null,
    };
    source.rpnSnapshot = {
      licenseNumber: 'Л020-01',
      dateIssued: null,
      registryStatus: 'annulled',
      registryStatusRu: 'Аннулирована',
      registryInactive: true,
      unitShortName: null,
      registryModifiedAt: null,
      syncedAt: null,
      ppsDeadlineAt: null,
    };

    const model = buildMapEnterprisePopupViewModel({
      pointAddress: 'Курганская область, г. Курган, ул. Омская, 48 а',
      pointInn: '4501217153',
      source,
      pointLat: 55.1,
      pointLng: 65.3,
    });

    expect(model.rpnStrip?.state).toBe('gray');
    expect(model.rpnStrip?.registryStatusText).toBe('Аннулирована');
    expect(model.rpnStrip?.ppsCheckText).toBe('Не применяется');
  });
});
