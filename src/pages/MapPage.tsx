import { PanelLeft } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link, useSearchParams } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { CadastreVectorSystem } from '@/components/map/CadastreVectorSystem';
import { MapEnterprisePopupCard } from '@/components/map/MapEnterprisePopupCard';
import { buildMapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';
import {
  buildFkkoSearchIndex,
  formatFkkoHuman,
  formatFkkoSelectionSummary,
  fkkoCodesToQueryParam,
  matchesFkkoSearch,
  normalizeFkkoCodeList,
  normalizeFkkoDigits,
  normalizeFkkoSearchQuery,
} from '@/utils/fkko';
import { toPositiveInt } from '@/utils/positiveInt';
import {
  buildCanonicalSearchKey,
  buildSearchParamsFromFilters,
  parseFiltersFromSearchParams,
  readCachedResults,
  writeCachedResults,
} from '@/utils/searchState';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { useRotatingSearchMessage } from '@/hooks/useRotatingSearchMessage';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';
import heroBackground from '@/assets/home-landing/hero-background.png';
import filterSearchIcon from '@/assets/home-landing/filter-search-icon.svg';
import filterResetIcon from '@/assets/home-landing/filter-reset-icon.svg';
import homeResultsMapCtaIcon from '@/assets/home-landing/home-results-map-cta-icon.svg';
import homeResultsEnterpriseCtaIcon from '@/assets/home-landing/home-results-enterprise-cta-icon.svg';
import vidChevronClosed from '@/assets/home-landing/vid-chevron-closed.svg';
import { VidMenuCheckboxChecked, VidMenuCheckboxUnchecked } from '@/components/home-landing/VidMenuCheckbox';
import routeBuildIconPlaceholder from '@/assets/map/route-build-icon-placeholder.svg';
import backToHomeIconPlaceholder from '@/assets/map/back-to-home-icon-placeholder.svg';
import collapseMenuIconPlaceholder from '@/assets/map/collapse-menu-icon-placeholder.svg';

const INITIAL_FKKO: string[] = [];
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';
function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');
function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

const HOME_INTRO_EASE = 'cubic-bezier(0.14, 0.9, 0.22, 1)';
const HOME_INTRO_MOTION_MS = 2200;
const HOME_INTRO_DELAY_FILTER_MS = 160;
const HOME_INTRO_DELAY_MAP_MS = 280;
const ROUTE_POLY_A =
  "data:image/svg+xml,%3Csvg width='12' height='10' viewBox='0 0 12 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 10L0 0H12L6 10Z' fill='%23828583'/%3E%3C/svg%3E";
const ROUTE_POLY_B =
  "data:image/svg+xml,%3Csvg width='12' height='10' viewBox='0 0 12 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 10L0 0H12L6 10Z' fill='%23828583'/%3E%3C/svg%3E";
const POLY_IMG =
  "data:image/svg+xml,%3Csvg width='12' height='10' viewBox='0 0 12 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 10L0 0H12L6 10Z' fill='%23828583'/%3E%3C/svg%3E";
const filterCtaDurationClass = 'duration-[600ms]';
const filterCtaLabelShiftClass = [
  'transition-transform',
  filterCtaDurationClass,
  'ease-[cubic-bezier(0.22,1,0.36,1)]',
  'motion-reduce:transition-none',
  'motion-reduce:group-hover:translate-x-0',
  'group-hover:translate-x-[calc((21px+0.625rem)/2)]',
].join(' ');
const glassDropdownPanelDown =
  'absolute z-[100] top-full left-0 w-full mt-1 bg-[#ffffff73] rounded-[0px_0px_10px_10px] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] overflow-hidden shadow-none pb-2.5';
const vidTriggerBase =
  'relative z-[2] flex h-[60px] w-full max-lg:min-h-[48px] max-lg:py-2 max-lg:text-[15px] items-center justify-between px-[15px] text-left transition-[background-color,box-shadow,backdrop-filter,border-color,border-radius] duration-200 ease-out';
function vidTriggerClass(isOpen: boolean): string {
  if (isOpen) {
    return [
      vidTriggerBase,
      'rounded-[10px_10px_0px_0px] border border-transparent bg-[#ffffffa6] backdrop-blur-[10px] shadow-none [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[\'\'] before:absolute before:inset-0 before:p-px before:rounded-[10px_10px_0px_0px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none',
    ].join(' ');
  }
  return [
    vidTriggerBase,
    'rounded-[10px] border border-black/[0.06] bg-white shadow-sm',
    'hover:border-transparent hover:bg-[#ffffff73] hover:backdrop-blur-[10px] hover:shadow-none hover:[-webkit-backdrop-filter:blur(10px)_brightness(100%)]',
  ].join(' ');
}
const vidLabelClass = ({ isOpen, hasSelection }: { isOpen: boolean; hasSelection: boolean }): string =>
  [
    'font-nunito font-semibold text-base max-lg:text-[15px] lg:text-lg',
    isOpen || hasSelection ? 'text-[#2b3335]' : 'text-[#828583]',
  ].join(' ');
const mapSectionTitleClass =
  'typo-h3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]';

/** Верхняя полоска сайдбара; на мобиле — компактнее, как блок фильтров на главной. */
const mapSidebarChromeBarClass =
  'flex min-h-[2.75rem] flex-wrap items-center justify-between gap-x-2 gap-y-2 rounded-xl border border-white bg-[#ffffff80] px-3 py-2 shadow-[inset_0px_0px_70.1px_#ffffffb2] sm:min-h-[3.75rem] sm:gap-x-3 sm:rounded-2xl sm:px-4 sm:py-3 lg:h-20 lg:flex-nowrap lg:gap-y-0 lg:rounded-[32.5px] lg:px-6 lg:py-0';

/** Совпадает с `lg:` в Tailwind и с десктопным меню в `TopNavigationSection`. */
const MAP_LAYOUT_LG_PX = 1024;

/** Сворачивание панели фильтров: те же ощущения, что у CTA на главной */
const MAP_SIDEBAR_WIDTH_PX = 619;
const MAP_SIDEBAR_PAD_PX = 35;
/** Зазор между колонкой и картой (619 + 20 = 639) */
const MAP_AREA_LEFT_OPEN_PX = 639;
const DEFAULT_MAP_CENTER: [number, number] = [55.751244, 37.618423];
const DEFAULT_MAP_ZOOM = 5;
const FOCUSED_MAP_ZOOM = 14;

type MapPoint = {
  key: string;
  lat: number;
  lng: number;
  pointId: number | null;
  companyName: string;
  address: string;
  inn: string;
  source: LicenseData;
};

function MapFocusController({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom?: number;
}): null {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom ?? map.getZoom(), {
      duration: 0.7,
    });
  }, [center, zoom, map]);
  return null;
}

function MapPointMarker({
  point,
  isSelected,
  onSelect,
}: {
  point: MapPoint;
  isSelected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);
  const popupModel = useMemo(
    () =>
      buildMapEnterprisePopupViewModel({
        pointAddress: point.address,
        pointInn: point.inn,
        source: point.source,
        pointLat: point.lat,
        pointLng: point.lng,
      }),
    [point],
  );

  useEffect(() => {
    if (!isSelected) return;
    const open = (): void => {
      markerRef.current?.openPopup();
    };
    map.whenReady(open);
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(open);
    });
    const tShort = window.setTimeout(open, 80);
    const tLong = window.setTimeout(open, 350);
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      window.clearTimeout(tShort);
      window.clearTimeout(tLong);
    };
  }, [isSelected, map, point.key]);

  return (
    <CircleMarker
      ref={markerRef}
      key={point.key}
      center={[point.lat, point.lng]}
      radius={isSelected ? 11 : 8}
      pathOptions={{
        color: isSelected ? '#14532d' : '#1f7a35',
        fillColor: isSelected ? '#22c55e' : '#16a34a',
        fillOpacity: 0.9,
        weight: isSelected ? 3 : 2,
      }}
      eventHandlers={{ click: onSelect }}
    >
      <Popup className="moinoviichistiimir-popup">
        <MapEnterprisePopupCard model={popupModel} />
      </Popup>
    </CircleMarker>
  );
}

function useMediaMinWidth(minWidth: number): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${minWidth}px)`).matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = (): void => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [minWidth]);
  return matches;
}

export default function MapPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState<string[]>(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);
  const [fkkoInput, setFkkoInput] = useState('');
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  /** На экранах < lg панель — оверлей; карту показываем на весь блок, меню по кнопке. */
  const [menuVisible, setMenuVisible] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${MAP_LAYOUT_LG_PX}px)`).matches : true,
  );
  const isLgUp = useMediaMinWidth(MAP_LAYOUT_LG_PX);
  const [fkkoOptions, setFkkoOptions] = useState<string[]>([]);
  const [fkkoTitleByCode, setFkkoTitleByCode] = useState<Record<string, string>>({});
  const fkkoSelectedTitleMissRef = useRef<Set<string>>(new Set());
  const [activityTypeOptions, setActivityTypeOptions] = useState<string[]>([]);
  const [filterValidationError, setFilterValidationError] = useState<string>('');
  const [searchItems, setSearchItems] = useState<LicenseData[]>([]);
  const [focusedItem, setFocusedItem] = useState<LicenseData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);
  const [baseMapStyle, setBaseMapStyle] = useState<'osm' | 'cadastral'>('osm');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focusCenter, setFocusCenter] = useState<[number, number] | null>(null);
  const [focusGeocodeBusy, setFocusGeocodeBusy] = useState(false);
  const searchPhaseLabel = useRotatingSearchMessage(hasSearched && isSearching);
  const isApplyingQueryFiltersRef = useRef(false);
  /** После применения фильтров из URL следующий проход эффекта «сброс при смене фильтров» не должен чистить результаты (иначе съедается авто-поиск). */
  const suppressFilterResetFromUrlRef = useRef(false);
  const lastAutoSearchKey = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setIntroVisible(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(getApiUrl('/api/filters/fkko'))
      .then((r) => (r.ok ? r.json() : { fkko: [] }))
      .then((fkkoData: { fkko?: unknown; titles?: unknown }) => {
        if (!alive) return;
        setFkkoOptions(Array.isArray(fkkoData.fkko) ? fkkoData.fkko : []);
        const t = fkkoData.titles;
        if (t && typeof t === 'object' && t !== null && !Array.isArray(t)) {
          setFkkoTitleByCode((prev) => ({ ...prev, ...(t as Record<string, string>) }));
        }
      })
      .catch(() => {
        if (!alive) return;
        setFkkoOptions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const fkkoCatalogCodes = useMemo(() => normalizeFkkoCodeList(fkkoOptions), [fkkoOptions]);
  const fkkoSearchIndexByCode = useMemo(() => {
    const map: Record<string, { codeDigits: string; labelNormalized: string }> = {};
    for (const code of fkkoCatalogCodes) {
      const digits = normalizeFkkoDigits(code);
      if (digits.length !== 11) continue;
      const title = fkkoTitleByCode[digits];
      const human = formatFkkoHuman(code);
      const label = title ? `${human} — ${title}` : human;
      map[digits] = buildFkkoSearchIndex(digits, label);
    }
    return map;
  }, [fkkoCatalogCodes, fkkoTitleByCode]);

  useEffect(() => {
    if (fkkoCatalogCodes.length === 0) return;
    let alive = true;
    void fetch(getApiUrl('/api/fkko/titles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: fkkoCatalogCodes }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { titles?: unknown }) => {
        if (!alive) return;
        const t = data.titles;
        if (t && typeof t === 'object' && t !== null && !Array.isArray(t)) {
          setFkkoTitleByCode((prev) => ({ ...prev, ...(t as Record<string, string>) }));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fkkoCatalogCodes]);

  useEffect(() => {
    const need = filterFkko
      .map((c) => normalizeFkkoDigits(c))
      .filter(
        (k) =>
          k.length === 11 &&
          !fkkoTitleByCode[k] &&
          !fkkoSelectedTitleMissRef.current.has(k),
      )
      .slice(0, 80);
    if (need.length === 0) return;
    let alive = true;
    void fetch(getApiUrl('/api/fkko/titles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: need }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { titles?: unknown }) => {
        if (!alive) return;
        const raw = data.titles;
        const partial =
          raw && typeof raw === 'object' && raw !== null && !Array.isArray(raw)
            ? (raw as Record<string, string>)
            : null;
        if (partial && Object.keys(partial).length > 0) {
          setFkkoTitleByCode((prev) => ({ ...prev, ...partial }));
        }
        for (const k of need) {
          if (!partial?.[k]) fkkoSelectedTitleMissRef.current.add(k);
        }
      })
      .catch(() => {
        for (const k of need) fkkoSelectedTitleMissRef.current.add(k);
      });
    return () => {
      alive = false;
    };
  }, [filterFkko, fkkoTitleByCode]);

  useEffect(() => {
    const defaults = ['Сбор', 'Транспортирование', 'Обезвреживание', 'Утилизация', 'Размещение', 'Обработка', 'Захоронение'];
    const fkkoParam = fkkoCodesToQueryParam(filterFkko);
    const url = fkkoParam
      ? getApiUrl(`/api/filters/activity-types?fkko=${encodeURIComponent(fkkoParam)}`)
      : getApiUrl('/api/filters/activity-types');
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { activityTypes: [] }))
      .then((data) => {
        if (!alive) return;
        const fromApi = Array.isArray(data.activityTypes) ? data.activityTypes : [];
        const list = fkkoParam
          ? fromApi
          : [...new Set([...defaults, ...fromApi])];
        setActivityTypeOptions(
          list.map((x: string) => String(x).trim()).filter((x: string) => x && x.toLowerCase() !== 'иное'),
        );
        if (fkkoParam) {
          setFilterVid((prev) => prev.filter((v) => fromApi.includes(v)));
        }
      })
      .catch(() => {
        if (!alive) return;
        setActivityTypeOptions(defaults);
      });
    return () => { alive = false; };
  }, [filterFkko]);

  const regionOptions = useMemo(() => {
    const normalized = RUSSIAN_REGION_SUGGESTIONS
      .map((r) => String(r).trim())
      .filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'ru'));
  }, []);
  const handleFkkoInput = useCallback((next: string): void => {
    setFkkoInput(String(next).slice(0, 120));
  }, []);
  const filterFkkoOption = useCallback(
    ({ option, query, label }: { option: string; query: string; label: string }): boolean => {
      const digits = normalizeFkkoDigits(option);
      const idx = fkkoSearchIndexByCode[digits] ?? buildFkkoSearchIndex(option, label);
      return matchesFkkoSearch(idx, normalizeFkkoSearchQuery(query));
    },
    [fkkoSearchIndexByCode],
  );
  // activityTypeHintOptions больше не нужен: выбор вида обращения через чекбоксы

  /** Стабильная строка query: иначе `useSearchParams()` может давать новый объект на каждом рендере и ломать эффекты. */
  const mapQueryKey = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    const parsed = parseFiltersFromSearchParams(new URLSearchParams(mapQueryKey));
    isApplyingQueryFiltersRef.current = true;
    suppressFilterResetFromUrlRef.current = true;
    setFilterRegion((prev) => (prev === parsed.region ? prev : parsed.region));
    setFilterFkko((prev) => (areStringArraysEqual(prev, parsed.fkko) ? prev : parsed.fkko));
    setFilterVid((prev) => (areStringArraysEqual(prev, parsed.vid) ? prev : parsed.vid));
    setHasSearched(parsed.searched);

    if (parsed.vid.length > 0 && parsed.searched) {
      const key = buildCanonicalSearchKey(parsed);
      if (lastAutoSearchKey.current !== key) {
        lastAutoSearchKey.current = key;
        void runSearchRef.current(parsed, { cacheFirst: true });
      }
    } else {
      lastAutoSearchKey.current = null;
    }

    queueMicrotask(() => {
      isApplyingQueryFiltersRef.current = false;
    });
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        suppressFilterResetFromUrlRef.current = false;
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      suppressFilterResetFromUrlRef.current = false;
    };
  }, [mapQueryKey]);

  const focusSiteId = useMemo(() => {
    const raw = searchParams.get('focusSite');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  useEffect(() => {
    // 1) Если есть focus=id — подгрузим объект и откроем его
    if (!focusSiteId) return;
    let alive = true;
    fetch(getApiUrl(`/api/license-sites/${focusSiteId}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: LicenseData) => {
        if (!alive) return;
        const sid = toPositiveInt(data.siteId);
        if (sid != null) setSelectedId(sid);
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          setFocusCenter([data.lat, data.lng]);
        }
        setFocusedItem(data);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, [focusSiteId]);

  // При изменении фильтров сбрасываем результаты (без hasSearched в deps — иначе ломается поиск)
  const filterChangeSearchResetSkip = useRef(true);
  useEffect(() => {
    if (filterChangeSearchResetSkip.current) {
      filterChangeSearchResetSkip.current = false;
      return;
    }
    if (isApplyingQueryFiltersRef.current) return;
    if (suppressFilterResetFromUrlRef.current) return;

    const fromUrl = parseFiltersFromSearchParams(searchParams);
    if (fromUrl.searched && fromUrl.vid.length > 0) {
      const urlKey = buildCanonicalSearchKey(fromUrl);
      const stateKey = buildCanonicalSearchKey({
        region: filterRegion.trim(),
        fkko: filterFkko,
        vid: filterVid,
      });
      if (urlKey === stateKey) return;
    }

    setHasSearched(false);
    setSearchItems([]);
    setSearchError('');
  }, [filterFkko, filterRegion, filterVid, searchParams]);

  const runSearch = useCallback(
    async (
      overrides?: { region?: string; fkko?: string[]; vid?: string[]; searched?: boolean },
      opts?: { cacheFirst?: boolean },
    ): Promise<void> => {
      const nextFilters = {
        region: (overrides?.region ?? filterRegion).trim(),
        fkko: overrides?.fkko ?? filterFkko,
        vid: overrides?.vid ?? filterVid,
        searched: overrides?.searched ?? true,
      };
      const vid = nextFilters.vid.map((x) => String(x).trim()).filter(Boolean).join(', ');
      const cacheKey = buildCanonicalSearchKey(nextFilters);

      if (!vid) {
        if (!overrides) setFilterValidationError('Укажите вид обращения.');
        return;
      }
      if (opts?.cacheFirst) {
        const cached = readCachedResults(cacheKey);
        if (cached) {
          setFilterValidationError('');
          setSearchError('');
          setHasSearched(true);
          setSearchItems(cached);
          return;
        }
      }
      setFilterValidationError('');

      const qs = buildSearchParamsFromFilters(nextFilters);
      qs.delete('searched');

      setHasSearched(true);
      setIsSearching(true);
      setSearchError('');
      try {
      const r = await fetch(getApiUrl(`/api/license-sites?${qs.toString()}`));
      const data = await (r.ok ? r.json() : r.json().catch(() => ({})));
      if (!r.ok) {
        const msg = (data as { message?: string }).message;
        throw new Error(msg ?? String(r.status));
      }
      const itemsArr = (data as { items?: LicenseData[] }).items;
      const nextItems = Array.isArray(itemsArr) ? itemsArr : [];
      setSearchItems(nextItems);
      writeCachedResults(cacheKey, nextItems);
    } catch (err) {
      setSearchItems([]);
      setSearchError(err instanceof Error ? err.message : 'Ошибка поиска');
    } finally {
      setIsSearching(false);
    }
  },
    [filterRegion, filterFkko, filterVid]
  );
  const runSearchRef = useRef(runSearch);
  useEffect(() => {
    runSearchRef.current = runSearch;
  }, [runSearch]);

  const handleFindClick = useCallback(async () => {
    const next = {
      region: filterRegion.trim(),
      fkko: filterFkko,
      vid: filterVid,
      searched: true,
    };
    setSearchParams(buildSearchParamsFromFilters(next));
    await runSearch(next, { cacheFirst: true });
  }, [filterRegion, filterFkko, filterVid, setSearchParams, runSearch]);

  const geocodeMissing = useCallback(async (siteId: number) => {
    try {
      const item =
        searchItems.find((x) => toPositiveInt(x.siteId) === siteId) ??
        (focusedItem && toPositiveInt(focusedItem.siteId) === siteId ? focusedItem : null);
      const addr = String(item?.address ?? '').trim();
      if (!addr) throw new Error('У объекта нет адреса');

      const r = await fetch(getApiUrl(`/api/license-sites/${siteId}/geocode`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await (r.ok ? r.json() : r.json().catch(() => ({})));
      if (!r.ok) {
        const msg = (data as { message?: string }).message;
        throw new Error(msg ?? String(r.status));
      }

      const updated = data as LicenseData;
      setSearchItems((prev) => prev.map((x) => (toPositiveInt(x.siteId) === siteId ? updated : x)));
      if (focusedItem && toPositiveInt(focusedItem.siteId) === siteId) setFocusedItem(updated);
      if (typeof updated.lat === 'number' && typeof updated.lng === 'number') {
        setFocusCenter([updated.lat, updated.lng]);
      }
      const updSid = toPositiveInt(updated.siteId);
      if (updSid != null) setSelectedId(updSid);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Ошибка геокодирования');
    }
  }, [searchItems, focusedItem]);

  const handleResetFilters = (): void => {
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
    setSearchItems([]);
    setHasSearched(false);
    setSearchError('');
    setFilterValidationError('');
    setSearchParams(new URLSearchParams());
  };

  const hasMapFocus = Boolean(focusCenter);

  /** Deep link focusSite: площадка загружена, но координаты в БД пустые — маркера нет, попап не открыть без геокода. */
  const focusMissingCoords = useMemo(() => {
    if (!focusSiteId || !focusedItem) return false;
    const sid = toPositiveInt(focusedItem.siteId);
    if (sid !== focusSiteId) return false;
    const lat = focusedItem.lat;
    const lng = focusedItem.lng;
    return (
      typeof lat !== 'number' ||
      !Number.isFinite(lat) ||
      typeof lng !== 'number' ||
      !Number.isFinite(lng)
    );
  }, [focusSiteId, focusedItem]);

  const mapPoints = useMemo(
    () => {
      const points: MapPoint[] = [];
      const seenPointIds = new Set<number>();

      for (const item of searchItems) {
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
            source: item,
          });
        });
      }

      if (
        focusedItem &&
        typeof focusedItem.lat === 'number' &&
        Number.isFinite(focusedItem.lat) &&
        typeof focusedItem.lng === 'number' &&
        Number.isFinite(focusedItem.lng)
      ) {
        const sid = toPositiveInt(focusedItem.siteId);
        if (sid != null && !seenPointIds.has(sid)) {
          points.push({
            key: `deep-link-${sid}`,
            lat: focusedItem.lat,
            lng: focusedItem.lng,
            pointId: sid,
            companyName: focusedItem.companyName || 'Организация',
            address: focusedItem.address || 'Адрес не указан',
            inn: focusedItem.inn || 'не указан',
            source: focusedItem,
          });
        }
      }

      return points;
    },
    [searchItems, focusedItem],
  );
  const tileUrl =
    baseMapStyle === 'osm'
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const tileAttribution =
    baseMapStyle === 'osm'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      : '&copy; OpenStreetMap &copy; CARTO';
  const mapPushedLeft = isLgUp && menuVisible;
  const homePath = useMemo(() => {
    const params = buildSearchParamsFromFilters({
      region: filterRegion,
      fkko: filterFkko,
      vid: filterVid,
      searched: hasSearched,
    });
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }, [filterRegion, filterFkko, filterVid, hasSearched]);

  const asideOpenLayout = useMemo((): CSSProperties => {
    if (!isLgUp) {
      if (!menuVisible) return {};
      return { padding: '12px 14px' };
    }
    if (!menuVisible) return { width: 0, maxWidth: 0, padding: 0 };
    return {
      width: MAP_SIDEBAR_WIDTH_PX,
      maxWidth: MAP_SIDEBAR_WIDTH_PX,
      padding: MAP_SIDEBAR_PAD_PX,
    };
  }, [menuVisible, isLgUp]);

  return (
    <SitePublicPageShell>
      <div className="relative flex min-h-0 flex-1 flex-col bg-transparent">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[#f9fbfe]"
          style={{
            backgroundImage: `url(${heroBackground})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1] bg-white/30 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
          style={{
            opacity: introVisible ? 0 : 1,
            transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
          }}
        />
        <SiteFrameWithTopNav
          stacking="map"
          frameLayout="header"
          navSlotStyle={{
            opacity: introVisible ? 1 : 0,
            transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
          }}
        />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:absolute lg:inset-x-0 lg:bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] lg:top-[95px] lg:z-10">
          <div className="relative mx-auto flex min-h-0 w-full max-w-[min(1880px,100%)] flex-1 flex-col gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:gap-3 sm:px-6 sm:pb-4 md:px-8 lg:block lg:h-full lg:flex-none lg:gap-0 lg:px-[min(50px,3.5vw)] lg:pb-5 lg:pt-0">
            {(menuVisible || isLgUp) && (
              <div
                className="w-full shrink-0 lg:absolute lg:left-0 lg:top-0 lg:z-30 lg:flex lg:h-full lg:min-h-0"
                style={{
                  opacity: introVisible ? 1 : 0,
                  transform: introVisible ? 'translateY(0)' : 'translateY(30px)',
                  transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}, transform ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
                  transitionDelay: `${HOME_INTRO_DELAY_FILTER_MS}ms`,
                  pointerEvents: 'none',
                }}
              >
                <aside
                  className={[
                    'relative z-[2] min-h-0 min-w-0 overflow-hidden rounded-xl shadow-none',
                    'max-lg:mx-auto max-lg:w-full max-lg:max-w-[min(619px,calc(100vw-2rem))]',
                    'max-lg:transition-none',
                    'transition-[width,padding,max-width] duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:!duration-0 motion-reduce:!transition-none lg:transition-[width,padding,max-width]',
                    'lg:h-full lg:shrink-0 lg:rounded-[32.5px]',
                    menuVisible
                      ? 'brand-scroll no-scrollbar overflow-y-auto overflow-x-hidden bg-[#ffffff4c] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]'
                      : 'pointer-events-none border-transparent bg-transparent backdrop-blur-0',
                  ].join(' ')}
                  style={{ ...asideOpenLayout, pointerEvents: menuVisible ? 'auto' : 'none' }}
                  aria-hidden={!menuVisible}
                >
                  <div className={`mb-3 max-lg:mb-2 lg:mb-5 ${mapSidebarChromeBarClass}`}>
                    <Link
                      to={homePath}
                      className="inline-flex min-w-0 max-w-[min(100%,12rem)] items-center gap-1.5 text-sm font-semibold text-[#2b3335] transition-opacity hover:opacity-80 sm:max-w-none sm:gap-2 sm:text-base lg:text-[18px]"
                    >
                      <img className="h-[18px] w-[18px] shrink-0 object-contain sm:h-[21px] sm:w-[21px]" alt="" src={backToHomeIconPlaceholder} />
                      <span className="truncate">На главную</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMenuVisible(false)}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[18px] px-3 py-1.5 text-sm font-semibold text-[#2b3335] transition-opacity hover:opacity-80 sm:gap-2 sm:rounded-[20px] sm:px-4 sm:py-2 sm:text-base lg:text-[18px]"
                      title="Свернуть меню"
                    >
                      <img className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4" alt="" src={collapseMenuIconPlaceholder} />
                      Свернуть
                    </button>
                  </div>

        <section className="relative z-30 mb-3 rounded-xl border border-white bg-[#ffffff80] p-3 shadow-[inset_0px_0px_70.1px_#ffffffb2] sm:mb-5 sm:rounded-2xl sm:p-4 md:p-5 lg:rounded-[32.5px]">
          <div className="mb-3 max-lg:mb-2 sm:mb-4">
            <h3 className={`${mapSectionTitleClass} max-lg:text-[1.05rem]`}>
              управление
            </h3>
            <p className="text-sm font-semibold text-[#5e6567] sm:text-base lg:text-lg">Рабочая площадка — карта</p>
          </div>
          <div className="relative z-20 space-y-2 sm:space-y-3">
            {filterValidationError && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2.5 shadow-sm">
                {filterValidationError}
              </div>
            )}
            <div className="relative z-[4]">
              <p className="text-sm font-semibold text-[#747b7d] mb-1.5">
                ФККО (необязательно)
              </p>
              <MultiSelectDropdown
                options={fkkoCatalogCodes}
                selected={filterFkko}
                onChange={setFilterFkko}
                placeholder="Выберите коды ФККО"
                buttonClassName={vidTriggerClass}
                labelClassName={vidLabelClass}
                inputValue={fkkoInput}
                onInputValueChange={handleFkkoInput}
                filterOption={filterFkkoOption}
                renderChevron={(open) => (
                  <img
                    className={`pointer-events-none h-2.5 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    alt=""
                    src={vidChevronClosed}
                  />
                )}
                renderCheckbox={(checked) => (checked ? <VidMenuCheckboxChecked /> : <VidMenuCheckboxUnchecked />)}
                dropdownPanelClassName={glassDropdownPanelDown}
                dropdownListClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
                maxHeightClassName="max-h-64"
                lazyOptionsUntilInput
                lazyOptionsHintText="Начните вводить код ФККО"
                maxRenderedOptions={80}
                inputClassName="relative z-[2] w-full bg-transparent border-0 font-nunito font-semibold text-[#828583] text-lg placeholder:text-[#828583] focus:ring-0 focus:outline-none"
                formatOptionLabel={(code) => {
                  const key = normalizeFkkoDigits(code);
                  const title = key.length === 11 ? fkkoTitleByCode[key] : undefined;
                  const human = formatFkkoHuman(code);
                  return title ? `${human} — ${title}` : human;
                }}
                formatSelectedLabel={formatFkkoSelectionSummary}
              />
            </div>
            <div className="relative z-[3]">
              <p className="text-sm font-semibold text-[#747b7d] mb-1.5">
                Вид обращения *
              </p>
              <MultiSelectDropdown
                options={activityTypeOptions}
                selected={filterVid}
                onChange={setFilterVid}
                placeholder="Вид обращения"
                buttonClassName={vidTriggerClass}
                labelClassName={vidLabelClass}
                renderChevron={(open) => (
                  <img
                    className={`pointer-events-none h-2.5 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    alt=""
                    src={vidChevronClosed}
                  />
                )}
                renderCheckbox={(checked) => (checked ? <VidMenuCheckboxChecked /> : <VidMenuCheckboxUnchecked />)}
                dropdownPanelClassName={glassDropdownPanelDown}
                dropdownListClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
                maxHeightClassName="max-h-64"
              />
            </div>
            <div className="relative z-[2]">
              <p className="text-sm font-semibold text-[#747b7d] mb-1.5">Регион (необязательно)</p>
              <AutocompleteInput
                value={filterRegion}
                onChange={setFilterRegion}
                options={regionOptions}
                placeholder="Начните вводить регион"
                triggerClassName={(open) =>
                  open
                    ? `${vidTriggerBase} rounded-[10px_10px_0px_0px] border border-transparent bg-[#ffffffa6] backdrop-blur-[10px] shadow-none [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[10px_10px_0px_0px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none`
                    : `${vidTriggerBase} rounded-[10px] border border-black/[0.06] bg-white shadow-sm hover:border-transparent hover:bg-[#ffffff73] hover:backdrop-blur-[10px] hover:shadow-none hover:[-webkit-backdrop-filter:blur(10px)_brightness(100%)]`
                }
                inputClassName="relative z-[2] w-full bg-transparent border-0 font-nunito font-semibold text-[#828583] text-lg placeholder:text-[#828583] focus:ring-0 focus:outline-none"
                maxItems={10}
                noResultsText="Начните вводить"
                dropdownClassName={glassDropdownPanelDown}
                listClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
                onOpenChange={setIsRegionOpen}
              >
                <img
                  className={`pointer-events-none absolute right-[15px] top-1/2 z-[3] w-3 -translate-y-1/2 transition-transform duration-200 ${isRegionOpen ? 'rotate-180' : ''}`}
                  alt=""
                  src={POLY_IMG}
                />
              </AutocompleteInput>
            </div>
            <div className="relative z-[1] flex flex-col gap-3 pt-1 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={handleFindClick}
                className="group relative home-find-button flex h-[52px] w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] px-6 sm:h-[60px] sm:min-w-[200px] lg:min-w-[220px] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]"
              >
                <span className="relative z-[2] inline-flex items-center gap-2.5">
                  <span className={`font-nunito font-semibold text-[#2b3335] text-xl ${filterCtaLabelShiftClass}`}>Найти</span>
                  <span className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}>
                    <img className="h-[21px] w-[21px] object-contain pointer-events-none" alt="" src={filterSearchIcon} />
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className={`group relative z-[2] flex h-[52px] w-full shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer bg-[#ffffff73] py-2 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-[background-color,box-shadow] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:h-[52px] sm:flex-1 sm:min-h-0 sm:min-w-0 sm:py-0 hover:shadow-[inset_0px_0px_32.4px_#ffffffd6] active:bg-[#ffffffa6] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]`}
              >
                <span className="relative z-[2] inline-flex max-w-full items-center justify-center gap-2 px-1 sm:gap-2.5">
                  <span className={`relative mt-[-1px] text-center font-nunito text-sm font-semibold leading-snug tracking-[0] text-[#2b3335] sm:text-base ${filterCtaLabelShiftClass}`}>
                    Сбросить фильтры
                  </span>
                  <span className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}>
                    <img className="h-[21px] w-[21px] object-contain pointer-events-none" alt="" src={filterResetIcon} />
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="relative z-10 mb-3 rounded-xl border border-white bg-[#ffffff80] p-3 shadow-[inset_0px_0px_70.1px_#ffffffb2] sm:mb-5 sm:rounded-2xl sm:p-4 md:p-5 lg:rounded-[32.5px]">
          <h3 className={`${mapSectionTitleClass} mb-2 max-lg:text-[1.05rem]`}>
            Результаты
          </h3>

          {!hasSearched && (
            <div className="text-sm font-semibold text-[#5e6567]">
              Укажите вид обращения. Код ФККО и регион — по желанию.
            </div>
          )}
          {hasSearched && isSearching && (
            <div
              className="text-xs text-ink-muted"
              aria-live="polite"
              aria-busy="true"
            >
              {searchPhaseLabel}
            </div>
          )}
          {hasSearched && !isSearching && searchError && (
              <div className="text-xs glass-danger">
              {searchError}
            </div>
          )}
          {hasSearched && !isSearching && !searchError && searchItems.length === 0 && (
            <div className="text-xs text-ink-muted">Ничего не найдено</div>
          )}

          {hasSearched && searchItems.length > 0 && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                Найдено: {searchItems.length}
              </div>
              <div className="space-y-3">
                {searchItems.slice(0, 20).map((it) => {
                  const id = typeof it.id === 'number' ? it.id : null;
                  const hasCoords = typeof it.lat === 'number' && typeof it.lng === 'number';
                  const mapParams = buildSearchParamsFromFilters({
                    region: filterRegion.trim(),
                    fkko: filterFkko,
                    vid: filterVid,
                    searched: true,
                  });
                  const focusSid = toPositiveInt(it.siteId);
                  if (focusSid != null) mapParams.set('focusSite', String(focusSid));
                  const sitesCount = Array.isArray(it.sites) ? it.sites.length : 0;
                  const hasAddress = Boolean(it.address?.trim()) || sitesCount > 0;
                  return (
                    <div key={id ?? `${it.companyName}-${it.address}-${it.inn}`}>
                      <article className="rounded-[32.5px] border border-solid border-white bg-[#ffffff80] p-6 shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-7 lg:p-8">
                        <div className="space-y-5">
                          <div className="space-y-2.5">
                            <h4 className="typo-h4 max-w-[900px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]">
                              {it.companyName || 'Организация'}
                            </h4>
                            <div className="flex flex-wrap items-center gap-3.5 font-nunito font-semibold text-[#5e6567] text-base sm:text-lg">
                              <span>
                                <span className="font-bold">ИНН:</span>{' '}
                                {it.inn || 'не указан'}
                              </span>
                              {it.address && (
                                <>
                                  <span>|</span>
                                  <span>{it.address}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <EnterpriseActivityStrip activityTypes={it.activityTypes} variant="light" size="md" />
                          <div className="space-y-2.5">
                            {hasAddress ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center justify-center rounded-[15px] border border-solid border-[#ffffff96] bg-[#ffffff4c] px-[15px] py-2.5 font-nunito font-bold text-[#5e6567] text-base sm:text-lg">
                                  {sitesCount > 1 ? `Адресов: ${sitesCount}` : 'Адрес указан'}
                                </span>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2.5">
                              <div className="ml-auto flex w-full max-w-[435px] flex-col items-stretch gap-3">
                                <Link
                                  to={`/map?${mapParams.toString()}`}
                                  className="group home-find-button relative inline-flex h-[50px] w-full min-w-0 items-center justify-center overflow-hidden rounded-[16px] px-5 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[16px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:h-[56px] sm:rounded-[18px] sm:px-7 sm:min-w-[200px] lg:h-[60px] lg:rounded-[20px] lg:min-w-[435px]"
                                >
                                  <span className="relative z-[2] inline-flex items-center gap-2.5">
                                    <span className="relative mt-[-1px] whitespace-nowrap font-nunito font-bold text-[#2b3335] text-base text-center transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:text-lg lg:text-xl group-hover:translate-x-[calc((27px+0.625rem)/2)]">
                                      На карте
                                    </span>
                                    <span className="relative flex h-[20px] w-[20px] shrink-0 items-center justify-center transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:h-[24px] sm:w-[24px] lg:h-[27px] lg:w-[27px] group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0">
                                      <img
                                        className="h-[16px] w-[16px] object-contain pointer-events-none sm:h-[19px] sm:w-[19px] lg:h-[21px] lg:w-[21px]"
                                        alt=""
                                        src={homeResultsMapCtaIcon}
                                      />
                                    </span>
                                  </span>
                                </Link>
                                <Link
                                  to={id != null ? `/enterprise/${id}` : '/map'}
                                  className="group home-find-button relative inline-flex h-[50px] w-full min-w-0 items-center justify-center overflow-hidden rounded-[16px] px-5 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[16px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:h-[56px] sm:rounded-[18px] sm:px-7 sm:min-w-[200px] lg:h-[60px] lg:rounded-[20px] lg:min-w-[435px]"
                                >
                                  <span className="relative z-[2] inline-flex items-center gap-2.5">
                                    <span className="relative mt-[-1px] whitespace-nowrap font-nunito font-bold text-[#2b3335] text-base text-center transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:text-lg lg:text-xl group-hover:translate-x-[calc((27px+0.625rem)/2)]">
                                      Карточка предприятия
                                    </span>
                                    <span className="relative flex h-[20px] w-[20px] shrink-0 items-center justify-center transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:h-[24px] sm:w-[24px] lg:h-[27px] lg:w-[27px] group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0">
                                      <img
                                        className="h-[16px] w-[16px] object-contain pointer-events-none sm:h-[19px] sm:w-[19px] lg:h-[21px] lg:w-[21px]"
                                        alt=""
                                        src={homeResultsEnterpriseCtaIcon}
                                      />
                                    </span>
                                  </span>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                      {!hasCoords && toPositiveInt(it.siteId) != null && (
                        <button
                          type="button"
                          onClick={() => {
                            const sid = toPositiveInt(it.siteId);
                            if (sid != null) void geocodeMissing(sid);
                          }}
                          className="mt-2 h-8 px-3 rounded-xl bg-app-bg border border-black/[0.06] text-[11px] text-ink hover:bg-white shadow-sm transition-colors"
                        >
                          Определить координаты по адресу
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {searchItems.length > 20 && (
                <div className="text-xs text-ink-muted">Показаны первые 20 результатов</div>
              )}
            </div>
          )}
        </section>

        <section className="relative z-10 mb-3 rounded-xl border border-white bg-[#ffffff80] p-3 shadow-[inset_0px_0px_70.1px_#ffffffb2] sm:mb-5 sm:rounded-2xl sm:p-4 md:p-5 lg:rounded-[32.5px]">
          <h3 className={`${mapSectionTitleClass} mb-3 max-lg:text-[1.05rem]`}>
            Легенда
          </h3>
          <div className="space-y-2 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
              <span>Хранение</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
              <span>Захоронение</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span>Утилизация / обработка</span>
            </div>
          </div>
        </section>

        <section className="relative z-10 mb-3 rounded-xl border border-white bg-[#ffffff80] p-3 shadow-[inset_0px_0px_70.1px_#ffffffb2] sm:mb-5 sm:rounded-2xl sm:p-4 md:p-5 lg:rounded-[32.5px]">
          <h3 className={`${mapSectionTitleClass} mb-3 max-lg:text-[1.05rem]`}>
            Подложка карты
          </h3>
          <div className="flex flex-col gap-1 rounded-[20px] bg-[#ffffff80] p-1 sm:flex-row">
            <button
              type="button"
              onClick={() => setBaseMapStyle('osm')}
              className={`typo-h2 flex-1 rounded-[16px] py-3 text-[#2b3335] transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-[52px] sm:py-0 ${
                baseMapStyle === 'osm'
                  ? 'shadow-[0px_13px_31.5px_#c1df6466,inset_0px_0px_20px_#ffffffbd] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)]'
                  : 'bg-transparent'
              }`}
            >
              Обычная
            </button>
            <button
              type="button"
              onClick={() => setBaseMapStyle('cadastral')}
              className={`typo-h2 flex-1 rounded-[16px] py-3 text-[#2b3335] transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-[52px] sm:py-0 ${
                baseMapStyle === 'cadastral'
                  ? 'shadow-[0px_13px_31.5px_#c1df6466,inset_0px_0px_20px_#ffffffbd] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)]'
                  : 'bg-transparent'
              }`}
            >
              Кадастровая
            </button>
          </div>
          <p className="mt-3 font-nunito text-[12.5px] font-semibold text-[#5e6567] leading-[1.35] tracking-[0]">
            Подложка работает через Leaflet: OpenStreetMap / CARTO.
          </p>
        </section>

        <section className="relative z-10 rounded-xl border border-white bg-[#ffffff80] p-3 shadow-[inset_0px_0px_70.1px_#ffffffb2] sm:rounded-2xl sm:p-4 md:p-5 lg:rounded-[32.5px]">
          <h3 className={`${mapSectionTitleClass} mb-3 max-lg:text-[1.05rem] sm:mb-4`}>
            Маршрут
          </h3>
          <div className="w-full space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#747b7d] mb-1.5">Точка А</p>
              <button
                type="button"
                className={vidTriggerClass(false)}
              >
                <span className={vidLabelClass({ isOpen: false, hasSelection: false })}>Выберите объект</span>
                <img className="h-2.5 w-3 shrink-0" alt="" src={ROUTE_POLY_A} />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#747b7d] mb-1.5">Точка В</p>
              <button
                type="button"
                className={vidTriggerClass(false)}
              >
                <span className={vidLabelClass({ isOpen: false, hasSelection: false })}>Выберите объект</span>
                <img className="h-2.5 w-3 shrink-0" alt="" src={ROUTE_POLY_B} />
              </button>
            </div>
          </div>
          <div className="mt-6 flex w-full flex-col gap-3 sm:h-[60px] sm:flex-row sm:items-stretch">
            <button
              type="button"
              className="group relative home-find-button flex h-[52px] min-h-[52px] w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] px-6 sm:h-[60px] sm:min-h-[60px] sm:min-w-[200px] lg:min-w-[220px] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]"
            >
              <span className="relative z-[2] inline-flex items-center gap-2.5">
                <span className={`font-nunito font-semibold text-[#2b3335] text-xl ${filterCtaLabelShiftClass}`}>
                  Построить
                </span>
                <span
                  className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}
                >
                  <img className="h-[21px] w-[21px] object-contain pointer-events-none" alt="Vector" src={routeBuildIconPlaceholder} />
                </span>
              </span>
            </button>
            <button
              type="button"
              className={`group relative z-[2] flex h-[52px] min-h-[52px] w-full shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer bg-[#ffffff73] py-2 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-[background-color,box-shadow] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:mt-0 sm:h-[52px] sm:flex-1 sm:min-h-0 sm:min-w-0 sm:py-0 hover:shadow-[inset_0px_0px_32.4px_#ffffffd6] active:bg-[#ffffffa6] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]`}
              onClick={handleResetFilters}
            >
              <span className="relative z-[2] inline-flex max-w-full items-center justify-center gap-2 px-1 sm:gap-2.5">
                <span className={`relative mt-[-1px] text-center font-nunito text-sm font-semibold leading-snug tracking-[0] text-[#2b3335] sm:text-base ${filterCtaLabelShiftClass}`}>
                  Сбросить
                </span>
                <span
                  className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}
                >
                  <img className="h-[21px] w-[21px] object-contain pointer-events-none" alt="Vector" src={filterResetIcon} />
                </span>
              </span>
            </button>
          </div>
        </section>
                </aside>
              </div>
            )}

            <div
              className="relative z-10 flex min-h-[min(36vh,300px)] flex-1 overflow-hidden rounded-xl lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:top-0 lg:z-10 lg:min-h-0 lg:flex-none lg:rounded-[32.5px] lg:transition-[left] lg:duration-[520ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:lg:!transition-none motion-reduce:lg:!duration-0"
              style={isLgUp ? { left: mapPushedLeft ? MAP_AREA_LEFT_OPEN_PX : 0 } : undefined}
            >
        <div
          className="absolute inset-0"
          style={{
            opacity: introVisible ? 1 : 0,
            transform: introVisible ? 'translateY(0)' : 'translateY(36px)',
            transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}, transform ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
            transitionDelay: `${HOME_INTRO_DELAY_MAP_MS}ms`,
          }}
        >
        <MapContainer
          center={focusCenter ?? DEFAULT_MAP_CENTER}
          zoom={hasMapFocus ? FOCUSED_MAP_ZOOM : DEFAULT_MAP_ZOOM}
          className="absolute inset-0 z-0 h-full w-full min-h-0"
          zoomControl
        >
          <TileLayer attribution={tileAttribution} url={tileUrl} />
          <CadastreVectorSystem enabled={baseMapStyle === 'cadastral'} apiBase={getApiUrl} />
          <MapFocusController center={focusCenter} zoom={FOCUSED_MAP_ZOOM} />
          {mapPoints.map((point) => {
            const pointId = point.pointId;
            const isSelected = selectedId != null && pointId != null && selectedId === pointId;
            return (
              <MapPointMarker
                key={point.key}
                point={point}
                isSelected={isSelected}
                onSelect={() => {
                  setFocusedItem(point.source);
                  if (pointId != null) setSelectedId(pointId);
                  setFocusCenter([point.lat, point.lng]);
                }}
              />
            );
          })}
        </MapContainer>
        {focusMissingCoords && toPositiveInt(focusedItem?.siteId) != null ? (
          <div
            role="status"
            className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-[5010] rounded-2xl border border-black/[0.06] bg-[#fffffff2] px-4 py-3 shadow-[0_12px_40px_rgba(43,51,53,0.18)] backdrop-blur-md sm:left-auto sm:right-6 sm:max-w-md sm:translate-x-0"
          >
            <p className="font-nunito text-sm font-semibold text-[#2b3335]">
              Для этой площадки не заданы координаты на карте.
              {String(focusedItem.address ?? '').trim()
                ? ' Можно определить их по адресу.'
                : ' Укажите адрес в данных лицензии или обратитесь к администратору.'}
            </p>
            {String(focusedItem.address ?? '').trim() ? (
              <button
                type="button"
                disabled={focusGeocodeBusy}
                onClick={() => {
                  const sid = toPositiveInt(focusedItem.siteId);
                  if (sid == null) return;
                  setFocusGeocodeBusy(true);
                  void geocodeMissing(sid).finally(() => setFocusGeocodeBusy(false));
                }}
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-br from-accent-from to-accent-to px-4 text-sm font-semibold text-[#1a2e12] shadow-sm transition-opacity hover:shadow-eco-card disabled:opacity-60 sm:w-auto"
              >
                {focusGeocodeBusy ? 'Определяем…' : 'Определить координаты по адресу'}
              </button>
            ) : null}
          </div>
        ) : null}
        </div>
        <button
          type="button"
          onClick={() => setMenuVisible(true)}
          aria-hidden={menuVisible}
          tabIndex={menuVisible ? -1 : 0}
          className={[
            'absolute left-3 top-3 z-[5000] inline-flex items-center gap-2 rounded-[20px] border border-white bg-[#ffffff80] px-3 py-2 text-sm font-semibold text-[#2b3335] shadow-[inset_0px_0px_40px_#ffffffb2] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)] sm:left-4 sm:top-4 sm:rounded-[25px] sm:px-4 sm:py-3 sm:text-[18px]',
            'motion-reduce:!transition-none transition-[opacity,transform,filter] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
            menuVisible
              ? 'pointer-events-none scale-[0.94] opacity-0 -translate-y-1 delay-0'
              : 'pointer-events-auto scale-100 opacity-100 translate-y-0 delay-100 hover:opacity-90',
          ].join(' ')}
          title="Показать панель фильтров"
        >
          <PanelLeft className="h-5 w-5 shrink-0" aria-hidden />
          Меню
        </button>
            </div>
          </div>
        </div>
      </div>
    </SitePublicPageShell>
  );
}
