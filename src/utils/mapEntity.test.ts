import { describe, expect, it } from 'vitest';
import type { LicenseData } from '@/types';
import {
  getMapEntityDetailsHref,
  getMapEntityKind,
  getMapEntitySelectionKey,
  isGroroEntity,
} from '@/utils/mapEntity';

function makeSource(partial?: Partial<LicenseData>): LicenseData {
  return {
    id: 42,
    companyName: 'ООО Тест',
    inn: '1234567890',
    address: 'г. Тест, ул. Тестовая, 1',
    fkkoCodes: [],
    activityTypes: [],
    ...partial,
  };
}

describe('mapEntity helpers', () => {
  it('detects groro entity kind and details href', () => {
    const groro = makeSource({ id: 99, importSource: 'groro_parser' });
    expect(getMapEntityKind(groro)).toBe('groro');
    expect(isGroroEntity(groro)).toBe(true);
    expect(getMapEntityDetailsHref(groro)).toBe('/enterprise/groro/99');
  });

  it('builds enterprise href for regular entities', () => {
    const enterprise = makeSource({ id: 10, importSource: 'rpn_registry' });
    expect(getMapEntityKind(enterprise)).toBe('enterprise');
    expect(getMapEntityDetailsHref(enterprise)).toBe('/enterprise/10');
  });

  it('builds different selection keys for same point id across entity kinds', () => {
    const enterprise = makeSource({ importSource: 'rpn_registry' });
    const groro = makeSource({ importSource: 'groro_parser' });
    const enterpriseKey = getMapEntitySelectionKey(enterprise, 777);
    const groroKey = getMapEntitySelectionKey(groro, 777);
    expect(enterpriseKey).toBe('enterprise:point:777');
    expect(groroKey).toBe('groro:point:777');
    expect(enterpriseKey).not.toBe(groroKey);
  });
});
