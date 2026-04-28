import type { LicenseData } from '@/types';
import { toPositiveInt } from '@/utils/positiveInt';

/** Точка на Leaflet-карте, унифицировано с MapPage. */
export type MapPointLicense = {
  key: string;
  lat: number;
  lng: number;
  pointId: number | null;
  companyName: string;
  address: string;
  inn: string;
  siteLabel: string;
  source: LicenseData;
};

export function mapPointsFromLicenseItems(items: LicenseData[]): MapPointLicense[] {
  const points: MapPointLicense[] = [];
  const seenPointIds = new Set<number>();

  for (const item of items) {
    const baseId = toPositiveInt(item.siteId) ?? toPositiveInt(item.id) ?? null;
    if (
      typeof item.lat === 'number' &&
      Number.isFinite(item.lat) &&
      typeof item.lng === 'number' &&
      Number.isFinite(item.lng)
    ) {
      const pointId = baseId;
      if (pointId != null) seenPointIds.add(pointId);
      points.push({
        key: `root-${baseId ?? `${item.inn}-${item.address}`}`,
        lat: item.lat,
        lng: item.lng,
        pointId,
        companyName: item.companyName || 'Организация',
        address: item.address || 'Адрес не указан',
        inn: item.inn || 'не указан',
        siteLabel: String(item.siteLabel ?? '').trim() || 'Основная площадка',
        source: item,
      });
    }
    const sites = Array.isArray(item.sites) ? item.sites : [];
    sites.forEach((site, idx) => {
      if (
        typeof site.lat !== 'number' ||
        !Number.isFinite(site.lat) ||
        typeof site.lng !== 'number' ||
        !Number.isFinite(site.lng)
      ) {
        return;
      }
      const sitePointId = toPositiveInt(site.id) ?? baseId;
      if (sitePointId != null) seenPointIds.add(sitePointId);
      points.push({
        key: `site-${site.id ?? `${baseId ?? item.inn}-${idx}`}`,
        lat: site.lat,
        lng: site.lng,
        pointId: sitePointId,
        companyName: item.companyName || 'Организация',
        address: site.address || item.address || 'Адрес не указан',
        inn: item.inn || 'не указан',
        siteLabel: String(site.siteLabel ?? '').trim() || `Площадка ${idx + 1}`,
        source: item,
      });
    });
  }

  return points;
}
