import { PanelLeft } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { LicenseData } from '@/types';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  formatFkkoHuman,
  formatFkkoSelectionSummary,
  fkkoCodesToQueryParam,
  normalizeFkkoCodeList,
  normalizeFkkoDigits,
  parseFkkoCodesFromQuery,
} from '@/utils/fkko';
import { LicenseResultCard } from '@/components/licenses/LicenseResultCard';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { CadastreVectorSystem } from '@/components/map/CadastreVectorSystem';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { useRotatingSearchMessage } from '@/hooks/useRotatingSearchMessage';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';
import heroBackground from '@/assets/home-landing/hero-background.png';
import filterSearchIcon from '@/assets/home-landing/filter-search-icon.svg';
import filterResetIcon from '@/assets/home-landing/filter-reset-icon.svg';
import vidChevronClosed from '@/assets/home-landing/vid-chevron-closed.svg';
import { VidMenuCheckboxChecked, VidMenuCheckboxUnchecked } from '@/components/home-landing/VidMenuCheckbox';
import routeBuildIconPlaceholder from '@/assets/map/route-build-icon-placeholder.svg';
import backToHomeIconPlaceholder from '@/assets/map/back-to-home-icon-placeholder.svg';
import collapseMenuIconPlaceholder from '@/assets/map/collapse-menu-icon-placeholder.svg';

const INITIAL_FKKO: string[] = [];
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';

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
const MAP_SIDEBAR_MS = 520;
const MAP_SIDEBAR_WIDTH_PX = 619;
const MAP_SIDEBAR_PAD_PX = 35;
/** Зазор между колонкой и картой (619 + 20 = 639) */
const MAP_AREA_LEFT_OPEN_PX = 639;

/** Внешняя ПКК во iframe (тот же движок, что ik8map.roscadastres.com: векторные границы #D20404). См. .env.example */
const CADASTRE_IFRAME_URL = String(import.meta.env.VITE_CADASTRE_IFRAME_URL ?? '').trim();
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function FocusMap({
  center,
  zoom,
}: {
  center: LatLngExpression | null;
  zoom?: number;
}): null {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
}

/** После анимации ширины колонки пересчитываем размер тайлов Leaflet. */
function MapInvalidateAfterAside({ menuOpen, layoutKey }: { menuOpen: boolean; layoutKey: string }): null {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    const id = window.setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, MAP_SIDEBAR_MS);
    return () => window.clearTimeout(id);
  }, [menuOpen, layoutKey, map]);
  return null;
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

function markerVariant(it: LicenseData): 'green' | 'orange' {
  const fkkoCount = Array.isArray(it.fkkoCodes) ? it.fkkoCodes.length : 0;
  if (!it.inn) return 'orange';
  return fkkoCount > 0 ? 'green' : 'orange';
}

function markerHtml(it: LicenseData): string {
  const title = it.companyName || 'Организация';
  const inn = it.inn || '';
  const addr = it.address || '';
  const fkko = Array.isArray(it.fkkoCodes) ? it.fkkoCodes : [];
  const fkkoCount = fkko.length;
  const siteLabel = it.siteLabel ? String(it.siteLabel) : '';
  const siteInfo = siteLabel || 'Площадка';
  const contactsPlaceholder = 'Скоро по подписке';
  const activityTypes = Array.isArray(it.activityTypes) ? it.activityTypes : [];

  return renderToStaticMarkup(
    <div className="moinoviichistiimir-popup-card">
      <div className="moinoviichistiimir-popup-head">
        <div className="moinoviichistiimir-popup-title">{title}</div>
        <div className="moinoviichistiimir-popup-sub">
          <span className="moinoviichistiimir-popup-badge">{addr || 'Адрес не указан'}</span>
        </div>
        <div className="moinoviichistiimir-popup-activities">
          <EnterpriseActivityStrip activityTypes={activityTypes} variant="light" size="sm" />
        </div>
      </div>

      <div className="moinoviichistiimir-popup-body">
        <div className="moinoviichistiimir-popup-grid">
          <div className="moinoviichistiimir-popup-item">
            <div className="moinoviichistiimir-popup-k">ИНН</div>
            <div className="moinoviichistiimir-popup-v">{inn || '—'}</div>
          </div>
          <div className="moinoviichistiimir-popup-item">
            <div className="moinoviichistiimir-popup-k">Телефон / Email</div>
            <div className="moinoviichistiimir-popup-v">{contactsPlaceholder}</div>
          </div>
          <div className="moinoviichistiimir-popup-item moinoviichistiimir-popup-item--span2">
            <div className="moinoviichistiimir-popup-k">Адрес</div>
            <div className="moinoviichistiimir-popup-v">{addr || '—'}</div>
          </div>
          <div className="moinoviichistiimir-popup-item">
            <div className="moinoviichistiimir-popup-k">Количество ФККО</div>
            <div className="moinoviichistiimir-popup-v">{fkkoCount}</div>
          </div>
          <div className="moinoviichistiimir-popup-item">
            <div className="moinoviichistiimir-popup-k">Площадка</div>
            <div className="moinoviichistiimir-popup-v">{siteInfo}</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function createClusterIcon(cluster: unknown): L.DivIcon {
  const c = cluster as { getChildCount?: () => number } | null;
  const count = typeof c?.getChildCount === 'function' ? c.getChildCount() : 0;
  return L.divIcon({
    html: `<div class="moinoviichistiimir-cluster"><span>${count}</span></div>`,
    className: 'moinoviichistiimir-cluster-wrapper',
    iconSize: L.point(44, 44, true),
  });
}

function createPointIcon(variant: 'green' | 'orange'): L.DivIcon {
  const color = variant === 'orange' ? '#ea580c' : '#22c55e';
  return L.divIcon({
    className: 'moinoviichistiimir-point-wrapper',
    html: `
      <div class="moinoviichistiimir-marker">
        <svg class="moinoviichistiimir-marker__svg" width="34" height="46" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17 45c0 0 14-17 14-27C31 8.06 24.94 2 17 2S3 8.06 3 18c0 10 14 27 14 27z" fill="${color}" />
          <path d="M17 45c0 0 14-17 14-27C31 8.06 24.94 2 17 2S3 8.06 3 18c0 10 14 27 14 27z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
        </svg>
      </div>
    `,
    iconSize: L.point(34, 46, true),
    iconAnchor: [17, 46],
    popupAnchor: [0, -42],
  });
}

function ClusterMarkers({
  items,
  selectedId,
  onSelectId,
}: {
  items: LicenseData[];
  selectedId: number | null;
  onSelectId: (id: number | null) => void;
}): null {
  const map = useMap();

  useEffect(() => {
    const markerClusterGroupFactory = (L as unknown as { markerClusterGroup?: (opts: unknown) => L.LayerGroup }).markerClusterGroup;
    if (typeof markerClusterGroupFactory !== 'function') return;
    type ClusterGroup = L.LayerGroup & {
      addLayer: (layer: L.Layer) => void;
      zoomToShowLayer: (layer: L.Layer, callback: () => void) => void;
    };
    const group = markerClusterGroupFactory({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 15,
      iconCreateFunction: createClusterIcon,
    }) as unknown as ClusterGroup;

    const markersById = new Map<number, L.Marker>();

    items
      .filter((it) => typeof it.lat === 'number' && typeof it.lng === 'number')
      .forEach((it) => {
        const siteId = typeof it.siteId === 'number' ? it.siteId : null;
        const icon = createPointIcon(markerVariant(it));
        const m = L.marker([it.lat as number, it.lng as number], { icon });
        const html = markerHtml(it);
        m.bindPopup(html, {
          className: 'moinoviichistiimir-popup',
          autoPan: true,
          closeButton: true,
          maxWidth: 320,
        });
        m.on('click', () => onSelectId(siteId));
        group.addLayer(m);
        if (siteId != null) markersById.set(siteId, m);
      });

    map.addLayer(group);

    if (selectedId != null) {
      const m = markersById.get(selectedId);
      if (m) {
        // ensure marker is visible even if clustered
        group.zoomToShowLayer(m, () => {
          m.openPopup();
        });
      }
    }

    return () => {
      map.removeLayer(group);
    };
  }, [map, items, selectedId, onSelectId]);

  return null;
}

export default function MapPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState<string[]>(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focusCenter, setFocusCenter] = useState<LatLngExpression | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);
  const [baseMapStyle, setBaseMapStyle] = useState<'osm' | 'cadastral'>('osm');
  const searchPhaseLabel = useRotatingSearchMessage(hasSearched && isSearching);

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
  // activityTypeHintOptions больше не нужен: выбор вида обращения через чекбоксы

  useEffect(() => {
    const r = searchParams.get('region');
    const f = searchParams.get('fkko');
    const v = searchParams.get('vid');
    if (r != null) setFilterRegion(r);
    if (f != null) setFilterFkko(parseFkkoCodesFromQuery(f));
    if (v != null) {
      const parsed = String(v)
        .split(/[,;]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      setFilterVid(parsed);
    }
  }, [searchParams]);

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
        if (typeof data.siteId === 'number') setSelectedId(data.siteId);
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
    setHasSearched(false);
    setSearchItems([]);
    setSearchError('');
  }, [filterFkko, filterRegion, filterVid]);

  const vidQuery = useMemo(() => filterVid.map((x) => String(x).trim()).filter(Boolean).join(', '), [filterVid]);

  const runSearch = useCallback(
    async (overrides?: { region?: string; fkko?: string; vid?: string }): Promise<void> => {
      const region = (overrides?.region ?? filterRegion).trim();
      const fkkoStr =
        overrides?.fkko != null
          ? fkkoCodesToQueryParam(parseFkkoCodesFromQuery(overrides.fkko))
          : fkkoCodesToQueryParam(filterFkko);
      const vid = (overrides?.vid ?? vidQuery).trim();

      if (!vid) {
        if (!overrides) setFilterValidationError('Укажите вид обращения.');
        return;
      }
      setFilterValidationError('');

      const qs = new URLSearchParams();
      if (region) qs.set('region', region);
      if (fkkoStr) qs.set('fkko', fkkoStr);
      qs.set('vid', vid);

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
      setSearchItems(Array.isArray(itemsArr) ? itemsArr : []);
    } catch (err) {
      setSearchItems([]);
      setSearchError(err instanceof Error ? err.message : 'Ошибка поиска');
    } finally {
      setIsSearching(false);
    }
  },
    [filterRegion, filterFkko, vidQuery]
  );

  const lastAutoSearchKey = useRef<string | null>(null);
  useEffect(() => {
    const r = searchParams.get('region') ?? '';
    const f = searchParams.get('fkko') ?? '';
    const v = searchParams.get('vid') ?? '';
    if (!v) return;
    const key = `${r}|${f}|${v}`;
    if (lastAutoSearchKey.current === key) return;
    lastAutoSearchKey.current = key;
    runSearch({ region: r, fkko: f, vid: v });
  }, [searchParams, runSearch]);

  const handleFindClick = useCallback(async () => {
    await runSearch();
  }, [runSearch]);

  const geocodeMissing = useCallback(async (siteId: number) => {
    try {
      const item =
        searchItems.find((x) => typeof x.siteId === 'number' && x.siteId === siteId) ??
        (focusedItem && typeof focusedItem.siteId === 'number' && focusedItem.siteId === siteId ? focusedItem : null);
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
      setSearchItems((prev) => prev.map((x) => (typeof x.siteId === 'number' && x.siteId === siteId ? updated : x)));
      if (focusedItem && typeof focusedItem.siteId === 'number' && focusedItem.siteId === siteId) setFocusedItem(updated);
      setSelectedId(siteId);
      if (typeof updated.lat === 'number' && typeof updated.lng === 'number') {
        setFocusCenter([updated.lat, updated.lng]);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Ошибка геокодирования');
    }
  }, [searchItems, focusedItem]);

  const handleResetFilters = (): void => {
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
    setSearchItems([]);
    setSelectedId(null);
    setFocusCenter(null);
    setHasSearched(false);
    setSearchError('');
    setFilterValidationError('');
  };

  const defaultCenter: LatLngExpression = useMemo(() => {
    // Центр РФ примерно
    return [56.0, 60.0];
  }, []);

  const mapCenter = focusCenter ?? defaultCenter;
  const cadastreUsesIframe = baseMapStyle === 'cadastral' && CADASTRE_IFRAME_URL.length > 0;
  const markersItems = useMemo(() => {
    const all = [...searchItems];
    if (focusedItem && typeof focusedItem.id === 'number') {
      const exists = all.some((x) => typeof x.siteId === 'number' && typeof focusedItem.siteId === 'number' && x.siteId === focusedItem.siteId);
      if (!exists) all.unshift(focusedItem);
    }
    return all;
  }, [searchItems, focusedItem]);

  const mapPushedLeft = isLgUp && menuVisible;

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
                  style={asideOpenLayout}
                  aria-hidden={!menuVisible}
                >
                  <div className={`mb-3 max-lg:mb-2 lg:mb-5 ${mapSidebarChromeBarClass}`}>
                    <Link
                      to="/"
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
                  const r = filterRegion.trim();
                  const mapParams = new URLSearchParams({ vid: vidQuery.trim() });
                  const fkkoQ = fkkoCodesToQueryParam(filterFkko);
                  if (fkkoQ) mapParams.set('fkko', fkkoQ);
                  if (r) mapParams.set('region', r);
                  if (typeof it.siteId === 'number') mapParams.set('focusSite', String(it.siteId));
                  return (
                    <div key={id ?? `${it.companyName}-${it.address}-${it.inn}`}>
                      <LicenseResultCard
                        item={it}
                        mapPath={`/map?${mapParams.toString()}`}
                        detailsPath={id != null ? `/enterprise/${id}` : '/map'}
                        compact
                        fkkoTitleByCode={fkkoTitleByCode}
                      />
                      {!hasCoords && typeof it.siteId === 'number' && (
                        <button
                          type="button"
                          onClick={() => void geocodeMissing(it.siteId as number)}
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
            {CADASTRE_IFRAME_URL ? (
              baseMapStyle === 'cadastral' ? (
                <>
                  <span>
                    Встроена карта в стиле{' '}
                  </span>
                  <a
                    href="https://ik8map.roscadastres.com/map"
                    className="text-[#1f5c14] hover:text-[#2d7a1f] underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Роскадастр
                  </a>
                  <span>
                    : красные границы и подписи. Маркеры лицензий на iframe не рисуются — переключите на «Обычная», чтобы видеть точки.
                  </span>
                </>
              ) : (
                <span>
                  Задан <span className="font-bold text-[#2b3335]">VITE_CADASTRE_IFRAME_URL</span>: в режиме «Кадастровая» откроется та же
                  схема, что на ik8map.roscadastres.com (векторные тайлы, цвет #D20404).
                </span>
              )
            ) : (
              <span>
                Векторные границы участков (GeoJSON с бэкенда) и клик по карте — запрос сведений ПКК. При зуме ≥ 14
                подгружаются контуры; клик открывает карточку. Если API ПКК редиректится, настройте CADASTRE_PKK_API_BASE /
                CADASTRE_MAPSERVER_BASE на сервере (см. server/.env.example). Альтернатива — iframe:{' '}
                <span className="font-bold text-[#2b3335]">VITE_CADASTRE_IFRAME_URL</span>.
              </span>
            )}
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
              className="relative z-10 flex min-h-[min(36vh,300px)] flex-1 overflow-hidden rounded-xl lg:absolute lg:bottom-0 lg:left-0 lg:top-0 lg:z-10 lg:min-h-0 lg:flex-none lg:rounded-[32.5px] lg:transition-[left] lg:duration-[520ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:lg:!transition-none motion-reduce:lg:!duration-0"
              style={isLgUp ? { left: mapPushedLeft ? MAP_AREA_LEFT_OPEN_PX : 0 } : undefined}
            >
        <div
          className="absolute inset-0 [&_.leaflet-control-attribution]:hidden"
          style={{
            opacity: introVisible ? 1 : 0,
            transform: introVisible ? 'translateY(0)' : 'translateY(36px)',
            transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}, transform ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
            transitionDelay: `${HOME_INTRO_DELAY_MAP_MS}ms`,
          }}
        >
        {cadastreUsesIframe ? (
          <iframe
            title="Публичная кадастровая карта"
            src={CADASTRE_IFRAME_URL}
            className="absolute inset-0 z-0 h-full w-full min-h-0 border-0"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={focusCenter ? 13 : 4}
            className="w-full h-full min-h-0"
            preferCanvas
          >
            <FocusMap center={focusCenter} zoom={13} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {baseMapStyle === 'cadastral' && <CadastreVectorSystem enabled apiBase={getApiUrl} />}
            <ClusterMarkers items={markersItems} selectedId={selectedId} onSelectId={setSelectedId} />
            <MapInvalidateAfterAside menuOpen={menuVisible} layoutKey={`${isLgUp}-${menuVisible}`} />
          </MapContainer>
        )}
        {!cadastreUsesIframe && (
          <p className="sr-only">
            Карта © OpenStreetMap contributors, © CARTO
          </p>
        )}
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
