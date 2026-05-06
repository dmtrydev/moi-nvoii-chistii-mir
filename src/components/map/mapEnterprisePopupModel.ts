import type { LicenseData, LicenseSiteData, PpsState, PpsSummary, RpnSnapshotPublic } from '@/types';

export type PopupInfoRow = {
  key: 'inn' | 'contacts';
  label: string;
  value: string;
};

export type PopupSiteSwitch = {
  key: string;
  label: string;
  pointId: number | null;
  lat: number;
  lng: number;
  isActive: boolean;
};

/** Компактный блок РПН / ППС: статус реестра и срок периодического подтверждения (ППС). */
export type MapEnterpriseRpnStrip = {
  state: PpsState;
  /** Статус лицензии по данным реестра РПН. */
  registryStatusText: string;
  /** Срок проверки (ППС): «до DD.MM.YYYY», «не применяется», «—» и т.п. */
  ppsCheckText: string;
};

export type MapEnterprisePopupViewModel = {
  title: string;
  subtitleAddress: string;
  /** Реестр РПН / ППС; null если бэкенд не отдал блок или данных нет. */
  rpnStrip: MapEnterpriseRpnStrip | null;
  /** Ссылка на страницу `/enterprise/:id`; текст статуса реестра ведёт туда как гиперссылка. */
  enterpriseDetailsHref: string | null;
  infoRows: PopupInfoRow[];
  siteSwitches: PopupSiteSwitch[];
};

type BuildPopupViewModelInput = {
  pointAddress: string;
  pointInn: string;
  source: LicenseData;
  pointId?: number | null;
  pointLat?: number;
  pointLng?: number;
  siteCandidates?: Array<{
    pointId: number | null;
    lat: number;
    lng: number;
    label?: string | null;
  }>;
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

function toValidCoord(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDateRu(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getUTCFullYear()}`;
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function buildRegistryStatusText(rpn: RpnSnapshotPublic | null | undefined): string {
  if (!rpn) return 'Данные реестра не загружены';
  const ru = rpn.registryStatusRu?.trim();
  if (ru) return ru;
  return 'Статус в реестре не указан';
}

function registryEffectivelyInactive(rpn: RpnSnapshotPublic | null | undefined): boolean {
  if (!rpn) return false;
  if (rpn.registryInactive) return true;
  const st = String(rpn.registryStatus ?? '').trim().toLowerCase();
  return Boolean(st && st !== 'active');
}

function buildPpsCheckText(pps: PpsSummary | undefined, rpn: RpnSnapshotPublic | null | undefined): string {
  if (!rpn) return '—';
  if (registryEffectivelyInactive(rpn)) return 'Не применяется';
  const dlRu = pps?.deadlineAt ? formatDateRu(pps.deadlineAt) : '';
  if (dlRu) {
    if (pps?.daysLeft != null) {
      const unit = pluralRu(pps.daysLeft, ['день', 'дня', 'дней']);
      if (pps.daysLeft < 0) {
        const abs = Math.abs(pps.daysLeft);
        return `До ${dlRu} (просрочено на ${abs} ${unit})`;
      }
      return `До ${dlRu} (осталось ${pps.daysLeft} ${unit})`;
    }
    return `До ${dlRu}`;
  }
  return 'Срок по данным реестра не указан';
}

export function buildMapEnterpriseRpnStrip(source: LicenseData): MapEnterpriseRpnStrip | null {
  const pps = source.pps;
  const rpn = source.rpnSnapshot ?? null;
  if (!pps && !rpn) return null;

  const state: PpsState = pps?.state ?? 'gray';

  return {
    state,
    registryStatusText: buildRegistryStatusText(rpn),
    ppsCheckText: buildPpsCheckText(pps, rpn),
  };
}

function buildSiteSwitches(
  source: LicenseData,
  matchedSite: LicenseSiteData | null,
  pointId?: number | null,
  pointLat?: number,
  pointLng?: number,
  siteCandidates?: Array<{
    pointId: number | null;
    lat: number;
    lng: number;
    label?: string | null;
  }>,
): PopupSiteSwitch[] {
  const switches: PopupSiteSwitch[] = [];
  const seen = new Set<string>();
  const matchedSiteId = typeof matchedSite?.id === 'number' ? matchedSite.id : null;
  const currentPointId = typeof pointId === 'number' ? pointId : null;
  const currentLat = toValidCoord(pointLat);
  const currentLng = toValidCoord(pointLng);

  const pushSwitch = (
    id: number | null,
    latRaw: unknown,
    lngRaw: unknown,
    labelRaw: unknown,
    fallbackLabel: string,
  ): void => {
    const lat = toValidCoord(latRaw);
    const lng = toValidCoord(lngRaw);
    if (lat == null || lng == null) return;
    const key = id != null ? `id:${id}` : `coord:${lat.toFixed(6)}:${lng.toFixed(6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const resolvedLabel = normalizeText(labelRaw) ?? fallbackLabel;
    const activeById = currentPointId != null && id != null && currentPointId === id;
    const activeByMatchedSite = matchedSiteId != null && id != null && matchedSiteId === id;
    const activeByCoord = currentLat != null && currentLng != null && sameCoord(currentLat, lat) && sameCoord(currentLng, lng);
    switches.push({
      key,
      label: resolvedLabel,
      pointId: id,
      lat,
      lng,
      isActive: activeById || activeByMatchedSite || activeByCoord,
    });
  };

  const normalizedCandidates = Array.isArray(siteCandidates) ? siteCandidates : [];
  normalizedCandidates.forEach((candidate, index) => {
    pushSwitch(
      typeof candidate.pointId === 'number' ? candidate.pointId : null,
      candidate.lat,
      candidate.lng,
      candidate.label,
      index === 0 ? 'Основная площадка' : `Площадка ${index + 1}`,
    );
  });

  if (normalizedCandidates.length === 0) {
    pushSwitch(
      typeof source.siteId === 'number' ? source.siteId : null,
      source.lat,
      source.lng,
      source.siteLabel,
      'Основная площадка',
    );
  }

  const sites = Array.isArray(source.sites) ? source.sites : [];
  sites.forEach((site, index) => {
    pushSwitch(
      typeof site.id === 'number' ? site.id : null,
      site.lat,
      site.lng,
      site.siteLabel,
      `Площадка ${index + 1}`,
    );
  });

  return switches;
}

export function buildMapEnterprisePopupViewModel(
  input: BuildPopupViewModelInput,
): MapEnterprisePopupViewModel {
  const matchedSite = findMatchedSite(input.source, input.pointAddress, input.pointLat, input.pointLng);
  const title = normalizeText(input.source.companyName) ?? 'Организация';
  const subtitleAddress = normalizeText(input.pointAddress) ?? normalizeText(input.source.address) ?? 'Адрес не указан';
  const inn = normalizeText(input.pointInn) ?? normalizeText(input.source.inn) ?? 'не указан';
  const siteSwitches = buildSiteSwitches(
    input.source,
    matchedSite,
    input.pointId,
    input.pointLat,
    input.pointLng,
    input.siteCandidates,
  );
  const fallbackSwitchLabel = resolveSiteLabel(input.source, matchedSite);
  if (siteSwitches.length === 0 && typeof input.pointLat === 'number' && typeof input.pointLng === 'number') {
    siteSwitches.push({
      key: 'current-point',
      label: fallbackSwitchLabel,
      pointId: typeof input.pointId === 'number' ? input.pointId : null,
      lat: input.pointLat,
      lng: input.pointLng,
      isActive: true,
    });
  }

  const licenseId = input.source.id;
  const enterpriseDetailsHref =
    typeof licenseId === 'number' && Number.isFinite(licenseId) && licenseId > 0
      ? `/enterprise/${licenseId}`
      : null;

  return {
    title,
    subtitleAddress,
    enterpriseDetailsHref,
    rpnStrip: buildMapEnterpriseRpnStrip(input.source),
    infoRows: [
      { key: 'inn', label: 'ИНН:', value: inn },
      { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
    ],
    siteSwitches,
  };
}
