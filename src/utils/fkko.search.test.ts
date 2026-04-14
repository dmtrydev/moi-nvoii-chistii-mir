import { describe, expect, it } from 'vitest';
import {
  buildFkkoSearchIndex,
  matchesFkkoSearch,
  normalizeFkkoSearchQuery,
} from '@/utils/fkko';

describe('FKKO search helpers', () => {
  it('normalizes query with trim, lowercase and collapsed spaces', () => {
    expect(normalizeFkkoSearchQuery('  Лампы   Ртутные  ')).toBe('лампы ртутные');
  });

  it('matches by code digits', () => {
    const index = buildFkkoSearchIndex('47110101521', '4 71 101 01 52 1 — лампы');
    expect(matchesFkkoSearch(index, '471101')).toBe(true);
  });

  it('matches by title part after dash', () => {
    const index = buildFkkoSearchIndex(
      '47110101521',
      '4 71 101 01 52 1 — лампы ртутные, люминесцентные',
    );
    expect(matchesFkkoSearch(index, 'люминесцентные')).toBe(true);
  });

  it('supports mixed query with uneven spaces and casing', () => {
    const index = buildFkkoSearchIndex(
      '36122203393',
      '3 61 222 03 39 3 — шлам шлифовальный маслосодержащий',
    );
    expect(matchesFkkoSearch(index, '  ШЛАМ   шлифовальный  ')).toBe(true);
  });

  it('returns false when neither code nor title match', () => {
    const index = buildFkkoSearchIndex('36122203393', '3 61 222 03 39 3 — шлам');
    expect(matchesFkkoSearch(index, 'батарейки')).toBe(false);
  });
});

