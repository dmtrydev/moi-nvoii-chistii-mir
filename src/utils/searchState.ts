import type { LicenseData } from '@/types';
import { fkkoCodesToQueryParam, parseFkkoCodesFromQuery } from '@/utils/fkko';

export interface SearchFiltersState {
  region: string;
  fkko: string[];
  vid: string[];
  groroOnly?: boolean;
  searched: boolean;
}

export interface CachedSearchPayload {
  version: number;
  ts: number;
  key: string;
  items: LicenseData[];
}

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'search:results:';
const DEFAULT_TTL_MS = 15 * 60 * 1000;

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((x) => String(x).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
}

export function parseFiltersFromSearchParams(searchParams: URLSearchParams): SearchFiltersState {
  const region = String(searchParams.get('region') ?? '').trim();
  const fkkoRaw = String(searchParams.get('fkko') ?? '').trim();
  const vidRaw = String(searchParams.get('vid') ?? '').trim();
  const searchedRaw = String(searchParams.get('searched') ?? '').trim();
  const groroOnlyRaw = String(searchParams.get('groroOnly') ?? '').trim();

  return {
    region,
    fkko: parseFkkoCodesFromQuery(fkkoRaw),
    vid: normalizeList(vidRaw ? vidRaw.split(/[,;]+/) : []),
    groroOnly: groroOnlyRaw === '1' || groroOnlyRaw.toLowerCase() === 'true',
    searched: searchedRaw === '1' || searchedRaw.toLowerCase() === 'true',
  };
}

export function buildSearchParamsFromFilters(filters: SearchFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  const region = String(filters.region ?? '').trim();
  const fkko = fkkoCodesToQueryParam(filters.fkko ?? []);
  const vid = normalizeList(filters.vid ?? []).join(', ');
  const groroOnly = Boolean(filters.groroOnly);

  if (region) params.set('region', region);
  if (fkko) params.set('fkko', fkko);
  if (vid) params.set('vid', vid);
  if (groroOnly) params.set('groroOnly', '1');
  if (filters.searched) params.set('searched', '1');
  return params;
}

export function buildCanonicalSearchKey(
  filters: Pick<SearchFiltersState, 'region' | 'fkko' | 'vid'> & { groroOnly?: boolean },
): string {
  const region = String(filters.region ?? '').trim().toLowerCase();
  const fkko = fkkoCodesToQueryParam(filters.fkko ?? []);
  const vid = normalizeList(filters.vid ?? []).map((x) => x.toLowerCase()).join(',');
  const groroOnly = filters.groroOnly ? 'groro-only' : 'all-layers';
  return `${region}|${fkko}|${vid}|${groroOnly}`;
}

function cacheStorageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

export function readCachedResults(key: string, ttlMs = DEFAULT_TTL_MS): LicenseData[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(cacheStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSearchPayload;
    if (!parsed || parsed.version !== CACHE_VERSION || parsed.key !== key) return null;
    if (!Array.isArray(parsed.items)) return null;
    if (Date.now() - Number(parsed.ts ?? 0) > ttlMs) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

export function writeCachedResults(key: string, items: LicenseData[]): void {
  if (typeof window === 'undefined') return;
  const payload: CachedSearchPayload = {
    version: CACHE_VERSION,
    ts: Date.now(),
    key,
    items: Array.isArray(items) ? items : [],
  };
  try {
    window.sessionStorage.setItem(cacheStorageKey(key), JSON.stringify(payload));
  } catch {
    // ignore quota/storage errors
  }
}

export function clearCachedResults(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(cacheStorageKey(key));
  } catch {
    // ignore
  }
}

