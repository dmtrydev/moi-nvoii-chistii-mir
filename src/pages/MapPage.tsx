import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PanelLeftClose, PanelLeft } from 'lucide-react';
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

const INITIAL_FKKO: string[] = [];
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');
function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

const mapField = 'liquid-field !h-11';
const mapFieldSm = 'liquid-field !h-10';

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
  const [searchError, setSearchError] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);
  const [baseMapStyle, setBaseMapStyle] = useState<'osm' | 'cadastral'>('osm');

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

  // При изменении фильтров скрываем результаты до следующего клика "Найти объект"
  useEffect(() => {
    if (!hasSearched) return;
    setHasSearched(false);
    setSearchItems([]);
    setSearchError('');
  }, [filterFkko, filterRegion, filterVid, hasSearched]);

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
    <div className="flex h-screen overflow-hidden glass-bg">
      <aside
        className={`relative z-30 overflow-x-hidden overflow-y-auto brand-scroll no-scrollbar flex-shrink-0 transition-[width] duration-300 ease-out ${
          menuVisible
            ? 'w-full max-w-[380px] lg:max-w-[460px] px-5 py-6 md:px-7 md:py-8 m-3 md:m-4 rounded-3xl bg-white shadow-eco-float border border-black/[0.04]'
            : 'w-0 min-w-0 overflow-hidden px-0 py-0 m-0 border-0'
        }`}
      >
        <div className={`min-w-0 w-full max-w-full h-full ${!menuVisible ? 'invisible' : ''}`}>
        <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors min-w-0 shrink"
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">На главную</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuVisible(false)}
            className="glass-btn-soft inline-flex items-center justify-center gap-2 flex-shrink-0 h-9 min-w-[100px] px-3 py-2 text-xs font-medium whitespace-nowrap"
            title="Свернуть меню"
          >
            <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
            Свернуть
          </button>
        </div>
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">Управление</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Рабочая площадка — карта</h2>
        </div>

        <section className="mb-6 rounded-2xl bg-app-bg p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-3">
            Фильтры
          </h3>
          <div className="space-y-3">
            {filterValidationError && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2.5 shadow-sm">
                {filterValidationError}
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">
                ФККО (необязательно)
              </p>
              <MultiSelectDropdown
                options={fkkoCatalogCodes}
                selected={filterFkko}
                onChange={setFilterFkko}
                placeholder="Выберите коды ФККО"
                buttonClassName={mapField}
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
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">
                Вид обращения *
              </p>
              <MultiSelectDropdown
                options={activityTypeOptions}
                selected={filterVid}
                onChange={setFilterVid}
                placeholder="Вид обращения"
                buttonClassName={mapField}
                maxHeightClassName="max-h-64"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">Регион (необязательно)</p>
              <AutocompleteInput
                value={filterRegion}
                onChange={setFilterRegion}
                options={regionOptions}
                placeholder="Начните вводить регион"
                inputClassName={mapField}
                maxItems={10}
                noResultsText="Начните вводить"
              />
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-ink-muted hover:text-ink transition-colors"
            >
              Сбросить фильтры
            </button>
            <button
              type="button"
              onClick={handleFindClick}
              className="w-full glass-btn-dark !h-11 !rounded-2xl text-[11px] font-medium"
            >
              Найти объект
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-app-bg p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-3">
            Результаты
          </h3>

          {!hasSearched && (
            <div className="text-xs text-ink-muted">
              Укажите вид обращения. Код ФККО и регион — по желанию.
            </div>
          )}
          {hasSearched && isSearching && <div className="text-xs text-ink-muted">Идёт поиск…</div>}
          {hasSearched && !isSearching && searchError && (
              <div className="text-xs glass-danger">
              {searchError}
            </div>
          )}
          {hasSearched && !isSearching && !searchError && searchItems.length === 0 && (
            <div className="text-xs text-ink-muted">Ничего не найдено</div>
          )}

          {hasSearched && searchItems.length > 0 && (
            <div className="space-y-2">
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

        <section className="mb-6 rounded-2xl bg-app-bg p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-3">
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

        <section className="mb-6 rounded-2xl bg-app-bg p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-3">
            Подложка карты
          </h3>
          <div className="flex rounded-2xl bg-app-bg border border-black/[0.06] p-1 gap-1">
            <button
              type="button"
              onClick={() => setBaseMapStyle('osm')}
              className={`flex-1 min-h-[36px] rounded-xl px-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                baseMapStyle === 'osm'
                  ? 'glass-btn-dark !h-9 !min-h-0 !rounded-xl !px-2'
                  : 'text-ink-muted hover:text-ink hover:bg-white'
              }`}
            >
              Обычная
            </button>
            <button
              type="button"
              onClick={() => setBaseMapStyle('cadastral')}
              className={`flex-1 min-h-[36px] rounded-xl px-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                baseMapStyle === 'cadastral'
                  ? 'glass-btn-dark !h-9 !min-h-0 !rounded-xl !px-2'
                  : 'text-ink-muted hover:text-ink hover:bg-white'
              }`}
            >
              Кадастровая
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            {CADASTRE_IFRAME_URL ? (
              baseMapStyle === 'cadastral' ? (
                <>
                  Встроена карта в стиле{' '}
                  <a
                    href="https://ik8map.roscadastres.com/map"
                    className="text-[#1f5c14] hover:text-[#2d7a1f] underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Роскадастр
                  </a>
                  : красные границы и подписи. Маркеры лицензий на iframe не рисуются — переключите на «Обычная», чтобы
                  видеть точки.
                </>
              ) : (
                <>
                  Задан <span className="text-ink font-medium">VITE_CADASTRE_IFRAME_URL</span>: в режиме «Кадастровая» откроется та же
                  схема, что на ik8map.roscadastres.com (векторные тайлы, цвет #D20404).
                </>
              )
            ) : (
              <>
                Векторные границы участков (GeoJSON с бэкенда) и клик по карте — запрос сведений ПКК. При зуме ≥ 14
                подгружаются контуры; клик открывает карточку. Если API ПКК редиректится, настройте CADASTRE_PKK_API_BASE /
                CADASTRE_MAPSERVER_BASE на сервере (см. server/.env.example). Альтернатива — iframe:{' '}
                <span className="text-ink font-medium">VITE_CADASTRE_IFRAME_URL</span>.
              </>
            )}
          </p>
        </section>

        <section className="mt-auto rounded-2xl bg-app-bg p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-3">
            Маршрут
          </h3>
          <div className="space-y-3 text-xs text-ink-muted">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">Точка А</p>
              <input
                type="text"
                placeholder="Выберите объект"
                className={mapFieldSm}
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">Точка B</p>
              <input
                type="text"
                placeholder="Выберите объект"
                className={mapFieldSm}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 glass-btn-dark !h-9 !rounded-xl text-[11px] font-medium"
              >
                Построить
              </button>
              <button
                type="button"
                className="flex-1 h-9 rounded-xl border border-black/[0.08] bg-white text-[11px] text-ink hover:shadow-eco-card transition-colors"
              >
                Сбросить
              </button>
            </div>
          </div>
        </section>
        </div>
      </aside>

      <div className="flex-1 relative min-w-0 rounded-3xl overflow-hidden m-3 md:m-4 ml-0 md:ml-0 shadow-eco-float border border-black/[0.04] bg-app-bg">
        {cadastreUsesIframe ? (
          <iframe
            title="Публичная кадастровая карта"
            src={CADASTRE_IFRAME_URL}
            className="absolute inset-0 z-0 h-full w-full min-h-0 border-0 bg-app-bg"
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
            className="absolute left-4 top-4 z-20 glass-btn-soft inline-flex items-center justify-center gap-2 h-10 min-w-[88px] px-3 py-2 text-xs font-medium pointer-events-auto whitespace-nowrap shadow-eco-float"
            title="Показать меню"
          >
            <PanelLeft className="w-4 h-4 flex-shrink-0" />
            Меню
          </button>
        )}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none gap-3">
          <div
            className={`pointer-events-auto inline-flex items-center gap-1 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.06] shadow-eco-float p-1 ${!menuVisible ? 'ml-14' : ''}`}
          >
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
  );
}
