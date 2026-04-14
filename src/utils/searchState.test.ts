import { describe, expect, it } from 'vitest';
import type { LicenseData } from '@/types';
import {
  buildCanonicalSearchKey,
  buildSearchParamsFromFilters,
  parseFiltersFromSearchParams,
  readCachedResults,
  writeCachedResults,
} from '@/utils/searchState';

describe('searchState helpers', () => {
  it('round-trips filters through query params', () => {
    const params = buildSearchParamsFromFilters({
      region: 'Челябинская область',
      fkko: ['47110101521', '36122203393'],
      vid: ['Сбор', 'Транспортирование'],
      searched: true,
    });
    const parsed = parseFiltersFromSearchParams(params);
    expect(parsed.region).toBe('Челябинская область');
    expect(parsed.fkko).toEqual(['47110101521', '36122203393']);
    expect(parsed.vid).toEqual(['Сбор', 'Транспортирование']);
    expect(parsed.searched).toBe(true);
  });

  it('builds canonical key independent from vid order', () => {
    const a = buildCanonicalSearchKey({
      region: 'Москва',
      fkko: ['47110101521'],
      vid: ['Сбор', 'Утилизация'],
    });
    const b = buildCanonicalSearchKey({
      region: 'Москва',
      fkko: ['47110101521'],
      vid: ['Утилизация', 'Сбор'],
    });
    expect(a).toBe(b);
  });

  it('reads fresh cache and skips stale cache by ttl', () => {
    const key = buildCanonicalSearchKey({
      region: 'Пермский край',
      fkko: ['47110101521'],
      vid: ['Сбор'],
    });
    const items: LicenseData[] = [
      {
        id: 1,
        siteId: 10,
        companyName: 'ООО Тест',
        inn: '1234567890',
        address: 'Пермь',
        fkkoCodes: ['47110101521'],
        activityTypes: ['Сбор'],
      },
    ];
    writeCachedResults(key, items);
    expect(readCachedResults(key)).toEqual(items);
    expect(readCachedResults(key, -1)).toBeNull();
  });
});

