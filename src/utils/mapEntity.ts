import type { LicenseData } from '@/types';

export type MapEntityKind = 'enterprise' | 'groro';

export function getMapEntityKind(source: LicenseData): MapEntityKind {
  return source.importSource === 'groro_parser' ? 'groro' : 'enterprise';
}

export function isGroroEntity(source: LicenseData): boolean {
  return getMapEntityKind(source) === 'groro';
}

export function getMapEntityDetailsHref(source: LicenseData): string | null {
  const id = source.id;
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return null;
  return isGroroEntity(source) ? `/enterprise/groro/${id}` : `/enterprise/${id}`;
}

export function getMapEntitySelectionKey(source: LicenseData, pointId: number | null): string {
  const kind = getMapEntityKind(source);
  if (pointId != null) return `${kind}:point:${pointId}`;
  const sourceId = typeof source.id === 'number' && Number.isFinite(source.id) ? source.id : null;
  if (sourceId != null) return `${kind}:entity:${sourceId}`;
  return `${kind}:fallback:${String(source.companyName ?? '').trim().toLowerCase()}:${String(source.inn ?? '').trim()}`;
}
