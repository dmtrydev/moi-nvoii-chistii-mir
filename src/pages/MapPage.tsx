import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
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
import { TopNavigationSection } from '@/components/home-landing/TopNavigationSection';
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

const filterInputBase =
  'relative z-[2] box-border w-full h-[60px] rounded-[10px] border-0 bg-transparent px-[15px] py-[18px] font-nunito font-semibold text-[#828583] text-lg placeholder:text-[#828583] focus:ring-0 focus:outline-none';
const HOME_INTRO_EASE = 'cubic-bezier(0.14, 0.9, 0.22, 1)';
const HOME_INTRO_MOTION_MS = 2200;
const HOME_INTRO_DELAY_NAV_MS = 40;
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
const filterFieldShell =
  'relative w-full h-full rounded-[10px] border border-black/[0.06] bg-white shadow-sm transition-[background-color,box-shadow,backdrop-filter,border-color] duration-200 ease-out hover:border-transparent hover:bg-[#ffffff73] hover:backdrop-blur-[10px] hover:shadow-none hover:[-webkit-backdrop-filter:blur(10px)_brightness(100%)] focus-within:border-transparent focus-within:bg-[#ffffffa6] focus-within:backdrop-blur-[10px] focus-within:shadow-none focus-within:[-webkit-backdrop-filter:blur(10px)_brightness(100%)]';
const glassDropdownPanelDown =
  'absolute z-[100] top-full left-0 w-full mt-1 bg-[#ffffff73] rounded-[0px_0px_10px_10px] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] overflow-hidden shadow-none pb-2.5';
const vidTriggerBase =
  'relative z-[2] w-full h-[60px] px-[15px] text-left flex items-center justify-between transition-[background-color,box-shadow,backdrop-filter,border-color,border-radius] duration-200 ease-out';
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
  ['font-nunito font-semibold text-lg', isOpen || hasSelection ? 'text-[#2b3335]' : 'text-[#828583]'].join(' ');
const mapSectionTitleClass =
  'typo-h3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]';

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
  const [menuVisible, setMenuVisible] = useState(true);
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


  return (
    <div className="relative h-screen w-full min-w-[1440px] overflow-auto bg-[#f9fbfe]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[#f9fbfe]"
        style={{
          backgroundImage: `url(${heroBackground})`,
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'top center',
          backgroundSize: 'min(1920px, 100vw) auto',
        }}
      />
      <div
        className="relative z-40"
        style={{
          opacity: introVisible ? 1 : 0,
          transform: introVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}, transform ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
          transitionDelay: `${HOME_INTRO_DELAY_NAV_MS}ms`,
        }}
      >
        <TopNavigationSection />
      </div>

      <div className="absolute inset-x-0 top-[95px] bottom-5 z-10">
        <div className="relative mx-auto h-full w-full max-w-[min(1880px,100%)] px-4 sm:px-6 md:px-8 lg:px-[min(50px,3.5vw)]">
      <aside
        className={`absolute left-0 top-0 z-30 overflow-x-hidden overflow-y-auto brand-scroll no-scrollbar transition-all duration-300 ${
          menuVisible
            ? 'w-[619px] h-full rounded-[32.5px] bg-[#ffffff4c] p-[35px] backdrop-blur-[10px]'
            : 'w-0 h-0 p-0 overflow-hidden'
        }`}
        style={{
          opacity: introVisible ? 1 : 0,
          transform: introVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: `opacity ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}, transform ${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`,
          transitionDelay: `${HOME_INTRO_DELAY_FILTER_MS}ms`,
        }}
      >
        <div className={`relative z-[2] ${!menuVisible ? 'invisible' : ''}`}>
        <div className="mb-5 flex h-20 items-center justify-between rounded-[32.5px] border border-white bg-[#ffffff80] px-6 shadow-[inset_0px_0px_70.1px_#ffffffb2]">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[#2b3335] text-[18px] font-semibold transition-opacity hover:opacity-80"
          >
            <img className="h-[21px] w-[21px] shrink-0 object-contain" alt="" src={backToHomeIconPlaceholder} />
            <span className="truncate">На главную</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuVisible(false)}
            className="inline-flex items-center justify-center gap-2 rounded-[20px] px-4 py-2 text-[18px] font-semibold text-[#2b3335] transition-opacity hover:opacity-80"
            title="Свернуть меню"
          >
            <img className="h-4 w-4 shrink-0 object-contain" alt="" src={collapseMenuIconPlaceholder} />
            Свернуть
          </button>
        </div>

        <section className="relative z-30 mb-5 rounded-[32.5px] border border-white bg-[#ffffff80] p-5 shadow-[inset_0px_0px_70.1px_#ffffffb2]">
          <div className="mb-4">
            <h3 className={mapSectionTitleClass}>
              управление
            </h3>
            <p className="text-lg font-semibold text-[#5e6567]">Рабочая площадка — карта</p>
          </div>
          <div className="space-y-3 relative z-20">
            {filterValidationError && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2.5 shadow-sm">
                {filterValidationError}
              </div>
            )}
            <div>
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
            <div>
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
            <div>
              <p className="text-sm font-semibold text-[#747b7d] mb-1.5">Регион (необязательно)</p>
              <div className={`group/region ${filterFieldShell}`}>
                <AutocompleteInput
                  value={filterRegion}
                  onChange={setFilterRegion}
                  options={regionOptions}
                  placeholder="Начните вводить регион"
                  inputClassName={filterInputBase}
                  maxItems={10}
                  noResultsText="Начните вводить"
                  dropdownClassName={glassDropdownPanelDown}
                  listClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
                />
                <img
                  className="pointer-events-none absolute right-[15px] top-1/2 z-[3] w-3 -translate-y-1/2 transition-transform duration-200 group-focus-within/region:rotate-180"
                  alt=""
                  src={POLY_IMG}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleFindClick}
                className="group relative home-find-button flex h-[60px] min-w-[220px] items-center justify-center overflow-hidden rounded-[20px] border-[none] px-6 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]"
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
                className={`group relative z-[2] flex h-[52px] flex-1 items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer bg-[#ffffff73] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-[background-color,box-shadow] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:shadow-[inset_0px_0px_32.4px_#ffffffd6] active:bg-[#ffffffa6] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]`}
              >
                <span className="relative z-[2] inline-flex items-center gap-2.5">
                  <span className={`relative mt-[-1px] whitespace-nowrap font-nunito font-semibold text-[#2b3335] text-base text-center tracking-[0] leading-[normal] ${filterCtaLabelShiftClass}`}>Сбросить фильтры</span>
                  <span className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}>
                    <img className="h-[21px] w-[21px] object-contain pointer-events-none" alt="" src={filterResetIcon} />
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="relative z-10 mb-5 rounded-[32.5px] border border-white bg-[#ffffff80] p-5 shadow-[inset_0px_0px_70.1px_#ffffffb2]">
          <h3 className={`${mapSectionTitleClass} mb-2`}>
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

        <section className="relative z-10 mb-5 rounded-[32.5px] border border-white bg-[#ffffff80] p-5 shadow-[inset_0px_0px_70.1px_#ffffffb2]">
          <h3 className={`${mapSectionTitleClass} mb-3`}>
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

        <section className="relative z-10 mb-5 rounded-[32.5px] border border-white bg-[#ffffff80] p-5 shadow-[inset_0px_0px_70.1px_#ffffffb2]">
          <h3 className={`${mapSectionTitleClass} mb-3`}>
            Подложка карты
          </h3>
          <div className="flex rounded-[20px] bg-[#ffffff80] p-1 gap-1">
            <button
              type="button"
              onClick={() => setBaseMapStyle('osm')}
              className={`typo-h2 flex-1 h-[52px] rounded-[16px] text-[#2b3335] transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
              className={`typo-h2 flex-1 h-[52px] rounded-[16px] text-[#2b3335] transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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

        <section className="relative z-10 rounded-[32.5px] border border-white bg-[#ffffff80] p-5 shadow-[inset_0px_0px_70.1px_#ffffffb2]">
          <h3 className={`${mapSectionTitleClass} mb-4`}>
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
          <div className="w-full h-[60px] mt-6 flex gap-3">
            <button
              type="button"
              className="group relative home-find-button flex h-[60px] min-w-[220px] items-center justify-center overflow-hidden rounded-[20px] border-[none] px-6 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]"
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
              className={`group relative z-[2] mt-1 flex-1 h-[52px] flex items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer bg-[#ffffff73] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-[background-color,box-shadow] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:shadow-[inset_0px_0px_32.4px_#ffffffd6] active:bg-[#ffffffa6] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]`}
              onClick={handleResetFilters}
            >
              <span className="relative z-[2] inline-flex items-center gap-2.5">
                <span className={`relative mt-[-1px] whitespace-nowrap font-nunito font-semibold text-[#2b3335] text-base text-center tracking-[0] leading-[normal] ${filterCtaLabelShiftClass}`}>
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
        </div>
      </aside>

      <div className={`absolute top-0 bottom-0 right-0 z-10 overflow-hidden rounded-[32.5px] ${menuVisible ? 'left-[639px]' : 'left-0'}`}>
        <div
          className="absolute inset-0"
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
          </MapContainer>
        )}
        {!menuVisible && (
          <button
            type="button"
            onClick={() => setMenuVisible(true)}
            className="absolute left-4 top-4 z-20 inline-flex items-center justify-center gap-2 h-10 min-w-[88px] px-3 py-2 text-xs font-medium pointer-events-auto whitespace-nowrap rounded-[20px] bg-white/90 shadow-eco-float"
            title="Показать меню"
          >
            <PanelLeft className="w-4 h-4 flex-shrink-0" />
            Меню
          </button>
        )}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none gap-3">
          <div className={`pointer-events-auto inline-flex items-center gap-1 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.06] shadow-eco-float p-1 ${!menuVisible ? 'ml-14' : ''}`}>
            <button
              type="button"
              className="h-9 min-w-[72px] rounded-xl px-3 text-[11px] font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to transition-colors whitespace-nowrap shadow-sm"
            >
              2D карта
            </button>
            <button
              type="button"
              className="h-9 min-w-[72px] rounded-xl px-3 text-[11px] font-medium text-ink-muted hover:text-ink hover:bg-app-bg transition-colors whitespace-nowrap"
            >
              3D глобус
            </button>
          </div>
          <Link
            to="/upload"
            className="pointer-events-auto inline-flex items-center justify-center h-10 min-w-[120px] rounded-2xl px-4 py-2 text-[11px] font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow whitespace-nowrap shadow-eco-float"
          >
            Разместить объект
          </Link>
        </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
