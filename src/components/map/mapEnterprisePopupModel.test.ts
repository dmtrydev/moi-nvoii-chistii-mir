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
    expect(model.subtitleAddress).toContain('Курганская область');
    expect(model.infoRows).toHaveLength(5);
    expect(model.infoRows.find((x) => x.key === 'fkkoCount')?.value).toBe('1');
    expect(model.infoRows.find((x) => x.key === 'siteLabel')?.value).toBe('Основная площадка');
    expect(model.infoRows.find((x) => x.key === 'contacts')?.value).toBe('Скоро по подписке');
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
    expect(model.subtitleAddress).toBe('Адрес не указан');
    expect(model.infoRows.find((x) => x.key === 'inn')?.value).toBe('не указан');
    expect(model.infoRows.find((x) => x.key === 'fkkoCount')?.value).toBe('0');
    expect(model.infoRows.find((x) => x.key === 'siteLabel')?.value).toBe('Основная площадка');
  });
});
