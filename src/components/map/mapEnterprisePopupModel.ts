import type { LicenseData, LicenseSiteData } from '@/types';

export type PopupInfoRow = {
  key: 'inn' | 'contacts' | 'address' | 'siteLabel';
  label: string;
  value: string;
};

export type MapEnterprisePopupViewModel = {
  title: string;
  subtitleAddress: string;
  infoRows: PopupInfoRow[];
};

type BuildPopupViewModelInput = {
  pointAddress: string;
  pointInn: string;
  source: LicenseData;
  pointLat?: number;
  pointLng?: number;
};

function normalizeText(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

function sameCoord(a?: number | null, b?: number | null): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) < 0.000001;
}

function findMatchedSite(
  source: LicenseData,
  pointAddress: string,
  pointLat?: number,
  pointLng?: number,
): LicenseSiteData | null {
  const sites = Array.isArray(source.sites) ? source.sites : [];
  if (sites.length === 0) return null;

  const byCoords = sites.find((site) => sameCoord(site.lat, pointLat) && sameCoord(site.lng, pointLng));
  if (byCoords) return byCoords;

  const normalizedAddress = normalizeText(pointAddress)?.toLowerCase();
  if (!normalizedAddress) return null;
  return sites.find((site) => normalizeText(site.address)?.toLowerCase() === normalizedAddress) ?? null;
}

function resolveSiteLabel(source: LicenseData, matchedSite: LicenseSiteData | null): string {
  const fromSite = normalizeText(matchedSite?.siteLabel);
  if (fromSite) return fromSite;
  const fromSource = normalizeText(source.siteLabel);
  if (fromSource) return fromSource;
  return 'Основная площадка';
}

export function buildMapEnterprisePopupViewModel(
  input: BuildPopupViewModelInput,
): MapEnterprisePopupViewModel {
  const matchedSite = findMatchedSite(input.source, input.pointAddress, input.pointLat, input.pointLng);
  const title = normalizeText(input.source.companyName) ?? 'Организация';
  const subtitleAddress = normalizeText(input.pointAddress) ?? normalizeText(input.source.address) ?? 'Адрес не указан';
  const inn = normalizeText(input.pointInn) ?? normalizeText(input.source.inn) ?? 'не указан';
  const siteLabel = resolveSiteLabel(input.source, matchedSite);

  return {
    title,
    subtitleAddress,
    infoRows: [
      { key: 'inn', label: 'ИНН:', value: inn },
      { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
      { key: 'address', label: 'Адрес:', value: subtitleAddress },
      { key: 'siteLabel', label: 'Площадка:', value: siteLabel },
    ],
  };
}
