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
import { formatFkkoHuman } from '@/utils/fkko';
import { LicenseResultCard } from '@/components/licenses/LicenseResultCard';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { CadastreVectorSystem } from '@/components/map/CadastreVectorSystem';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import { AutocompleteInput, type AutocompleteOption } from '@/components/ui/AutocompleteInput';
import { getFkkoGroupName } from '@/constants/fkko';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';

const INITIAL_FKKO = '';
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');
function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

const mapField = 'liquid-field';
const mapFieldSm = 'liquid-field !h-9';

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
  const region = it.region || '';
  const inn = it.inn || '';
  const addr = it.address || '';
  const fkko = Array.isArray(it.fkkoCodes) ? it.fkkoCodes : [];
  const fkkoCount = fkko.length;
  const addressesCount = addr.trim() ? 1 : 0;
  const contactsPlaceholder = 'Скоро по подписке';
  const activityTypes = Array.isArray(it.activityTypes) ? it.activityTypes : [];

  return renderToStaticMarkup(
    <div className="moinoviichistiimir-popup-card">
      <div className="moinoviichistiimir-popup-head">
        <div className="moinoviichistiimir-popup-title">{title}</div>
        <div className="moinoviichistiimir-popup-sub">
          <span className="moinoviichistiimir-popup-badge">{region || 'Регион не указан'}</span>
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
            <div className="moinoviichistiimir-popup-k">Количество адресов</div>
            <div className="moinoviichistiimir-popup-v">{addressesCount}</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function createClusterIcon(cluster: any): L.DivIcon {
  const count = typeof cluster?.getChildCount === 'function' ? cluster.getChildCount() : 0;
  return L.divIcon({
    html: `<div class="moinoviichistiimir-cluster"><span>${count}</span></div>`,
    className: 'moinoviichistiimir-cluster-wrapper',
    iconSize: L.point(44, 44, true),
  });
}

function createPointIcon(variant: 'green' | 'orange'): L.DivIcon {
  const color = variant === 'orange' ? '#f59e0b' : '#4caf50';
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
    const group = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 15,
      iconCreateFunction: createClusterIcon,
    });

    const markersById = new Map<number, L.Marker>();

    items
      .filter((it) => typeof it.lat === 'number' && typeof it.lng === 'number')
      .forEach((it) => {
        const id = typeof it.id === 'number' ? it.id : null;
        const icon = createPointIcon(markerVariant(it));
        const m = L.marker([it.lat as number, it.lng as number], { icon });
        const html = markerHtml(it);
        m.bindPopup(html, {
          className: 'moinoviichistiimir-popup',
          autoPan: true,
          closeButton: true,
          maxWidth: 320,
        });
        m.on('click', () => onSelectId(id));
        group.addLayer(m);
        if (id != null) markersById.set(id, m);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, items, selectedId]);

  return null;
}

export default function MapPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState<string[]>(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);
  const [menuVisible, setMenuVisible] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [fkkoOptions, setFkkoOptions] = useState<string[]>([]);
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
    Promise.all([
      fetch(getApiUrl('/api/filters/regions')).then((r) => (r.ok ? r.json() : { regions: [] })),
      fetch(getApiUrl('/api/filters/fkko')).then((r) => (r.ok ? r.json() : { fkko: [] })),
      fetch(getApiUrl('/api/filters/activity-types')).then((r) => (r.ok ? r.json() : { activityTypes: [] })),
    ])
      .then(([regData, fkkoData, activityData]) => {
        if (!alive) return;
        setRegions(Array.isArray(regData.regions) ? regData.regions : []);
        setFkkoOptions(Array.isArray(fkkoData.fkko) ? fkkoData.fkko : []);
        const fromApi = Array.isArray(activityData.activityTypes) ? activityData.activityTypes : [];
        const defaults = ['Сбор', 'Транспортирование', 'Обезвреживание', 'Утилизация', 'Размещение', 'Обработка', 'Захоронение'];
        setActivityTypeOptions(
          [...new Set([...defaults, ...fromApi])]
            .map((x) => String(x).trim())
            .filter((x) => x && x.toLowerCase() !== 'иное'),
        );
      })
      .catch(() => {
        if (!alive) return;
        setRegions([]);
        setFkkoOptions([]);
        setActivityTypeOptions(['Сбор', 'Транспортирование', 'Обезвреживание', 'Утилизация', 'Размещение', 'Обработка', 'Захоронение']);
      });
    return () => {
      alive = false;
    };
  }, []);

  const regionOptions = useMemo(() => {
    const merged = [...RUSSIAN_REGION_SUGGESTIONS, ...regions];
    const normalized = merged
      .map((r) => String(r).trim())
      .filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [regions]);
  const fkkoHintOptions = useMemo<AutocompleteOption[]>(() => {
    const seen = new Set<string>();
    const items: AutocompleteOption[] = [];
    fkkoOptions.forEach((codeRaw) => {
      const raw = String(codeRaw).trim();
      if (!raw || seen.has(raw)) return;
      seen.add(raw);
      const formatted = formatFkkoHuman(raw);
      const groupName = getFkkoGroupName(raw);
      items.push({
        value: formatted,
        label: `${formatted} - ${groupName}`,
        searchText: `${formatted} ${raw} ${groupName}`.toLowerCase(),
      });
    });
    return items;
  }, [fkkoOptions]);
  // activityTypeHintOptions больше не нужен: выбор вида обращения через чекбоксы

  useEffect(() => {
    const r = searchParams.get('region');
    const f = searchParams.get('fkko');
    const v = searchParams.get('vid');
    if (r != null) setFilterRegion(r);
    if (f != null) setFilterFkko(f);
    if (v != null) {
      const parsed = String(v)
        .split(/[,;]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      setFilterVid(parsed);
    }
  }, [searchParams]);

  const focusId = useMemo(() => {
    const raw = searchParams.get('focus');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  useEffect(() => {
    // 1) Если есть focus=id — подгрузим объект и откроем его
    if (!focusId) return;
    let alive = true;
    fetch(getApiUrl(`/api/licenses/${focusId}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: LicenseData) => {
        if (!alive) return;
        if (typeof data.id === 'number') setSelectedId(data.id);
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
  }, [focusId]);

  // При изменении фильтров скрываем результаты до следующего клика "Найти объект"
  useEffect(() => {
    if (!hasSearched) return;
    setHasSearched(false);
    setSearchItems([]);
    setSearchError('');
  }, [filterFkko, filterRegion, filterVid]);

  const vidQuery = useMemo(() => filterVid.map((x) => String(x).trim()).filter(Boolean).join(', '), [filterVid]);

  const runSearch = useCallback(
    async (overrides?: { region?: string; fkko?: string; vid?: string }): Promise<void> => {
      const region = (overrides?.region ?? filterRegion).trim();
      const fkko = (overrides?.fkko ?? filterFkko).trim();
      const vid = (overrides?.vid ?? vidQuery).trim();

      // region опционален: ищем по fkko + виду обращения во всех регионах
      if (!fkko || !vid) {
        if (!overrides) setFilterValidationError('Заполните обязательные фильтры: ФККО и вид обращения.');
        return;
      }
      setFilterValidationError('');

      const qs = new URLSearchParams();
      if (region) qs.set('region', region);
      qs.set('fkko', fkko);
      qs.set('vid', vid);

      setHasSearched(true);
      setIsSearching(true);
      setSearchError('');
      try {
        const r = await fetch(getApiUrl(`/api/licenses?${qs.toString()}`));
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
    if (!f || !v) return;
    const key = `${r}|${f}|${v}`;
    if (lastAutoSearchKey.current === key) return;
    lastAutoSearchKey.current = key;
    runSearch({ region: r, fkko: f, vid: v });
  }, [searchParams, runSearch]);

  const handleFindClick = useCallback(async () => {
    await runSearch();
  }, [runSearch]);

  const geocodeMissing = useCallback(async (id: number) => {
    try {
      const item = searchItems.find((x) => x.id === id) ?? (focusedItem?.id === id ? focusedItem : null);
      const addr = String(item?.address ?? '').trim();
      if (!addr) throw new Error('У объекта нет адреса');

      // Геокодируем через наш API (Яндекс с fallback)
      const g = await fetch(getApiUrl(`/api/geocode?address=${encodeURIComponent(addr)}`), {
        headers: { Accept: 'application/json' },
      });
      const gData = await (g.ok ? g.json() : g.json().catch(() => ({})));
      if (!g.ok) {
        const msg = (gData as { message?: string }).message;
        throw new Error(msg ?? `Геокодер недоступен (${g.status})`);
      }
      const lat = Number((gData as { lat?: number }).lat);
      const lng = Number((gData as { lng?: number }).lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Геокодер вернул некорректные координаты');

      // Сохраняем координаты в БД
      const r = await fetch(getApiUrl(`/api/licenses/${id}/coords`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await (r.ok ? r.json() : r.json().catch(() => ({})));
      if (!r.ok) {
        const msg = (data as { message?: string }).message;
        throw new Error(msg ?? String(r.status));
      }

      const updated = data as LicenseData;
      setSearchItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      if (focusedItem?.id === id) setFocusedItem(updated);
      setSelectedId(id);
      setFocusCenter([lat, lng]);
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
      const exists = all.some((x) => x.id === focusedItem.id);
      if (!exists) all.unshift(focusedItem);
    }
    return all;
  }, [searchItems, focusedItem]);


  return (
    <div className="flex h-screen overflow-hidden glass-bg">
      <aside
        className={`relative bg-[#0f1f18]/72 border-r border-[#72b77d]/25 shadow-2xl overflow-x-hidden overflow-y-auto brand-scroll no-scrollbar flex-shrink-0 transition-[width] duration-300 ease-out ${
          menuVisible ? 'w-full max-w-[360px] lg:max-w-[420px] px-5 py-6' : 'w-0 min-w-0 overflow-hidden border-r-0 px-0 py-0'
        }`}
      >
        <div className={`min-w-0 w-full max-w-full h-full ${!menuVisible ? 'invisible' : ''}`}>
        <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#9db6a8] hover:text-[#f5fff7] transition-colors min-w-0 shrink"
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
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0]">Управление</p>
          <h2 className="mt-1 text-lg font-semibold text-[#f5fff7]">Рабочая площадка — карта</h2>
        </div>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8faea0] mb-3">
            Фильтры
          </h3>
          <div className="space-y-3">
            {filterValidationError && (
              <div className="text-xs text-amber-100 bg-[#2d2313]/80 border border-amber-300/25 rounded-lg px-3 py-2">
                {filterValidationError}
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0] mb-1.5">ФККО *</p>
              <AutocompleteInput
                value={filterFkko}
                onChange={setFilterFkko}
                options={fkkoHintOptions}
                placeholder="7 31 100 01 40 4 или выберите из списка"
                inputClassName={mapField}
                maxItems={10}
                noResultsText="Начните вводить код ФККО"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0] mb-1.5">
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
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0] mb-1.5">Регион (необязательно)</p>
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
              className="text-xs text-[#9ab3a5] hover:text-[#f5fff7] transition-colors"
            >
              Сбросить фильтры
            </button>
            <button
              type="button"
              onClick={handleFindClick}
              className="w-full glass-btn-dark !h-10 !rounded-lg text-[11px] font-medium"
            >
              Найти объект
            </button>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8faea0] mb-3">
            Результаты
          </h3>

          {!hasSearched && (
            <div className="text-xs text-[#9ab3a5]">
              Заполните обязательные фильтры (ФККО, вид обращения). Регион — необязателен.
            </div>
          )}
          {hasSearched && isSearching && <div className="text-xs text-[#9ab3a5]">Идёт поиск…</div>}
          {hasSearched && !isSearching && searchError && (
              <div className="text-xs glass-danger">
              {searchError}
            </div>
          )}
          {hasSearched && !isSearching && !searchError && searchItems.length === 0 && (
            <div className="text-xs text-[#9ab3a5]">Ничего не найдено</div>
          )}

          {hasSearched && searchItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0]">
                Найдено: {searchItems.length}
              </div>
              <div className="space-y-3">
                {searchItems.slice(0, 20).map((it) => {
                  const id = typeof it.id === 'number' ? it.id : null;
                  const hasCoords = typeof it.lat === 'number' && typeof it.lng === 'number';
                  const r = filterRegion.trim();
                  const mapParams = new URLSearchParams({
                    fkko: filterFkko.trim(),
                    vid: vidQuery.trim(),
                  });
                  if (r) mapParams.set('region', r);
                  if (id != null) mapParams.set('focus', String(id));
                  return (
                    <div key={id ?? `${it.companyName}-${it.address}-${it.inn}`}>
                      <LicenseResultCard
                        item={it}
                        mapPath={`/map?${mapParams.toString()}`}
                        detailsPath={id != null ? `/enterprise/${id}` : '/map'}
                        compact
                      />
                      {!hasCoords && id != null && (
                        <button
                          type="button"
                          onClick={() => void geocodeMissing(id)}
                          className="mt-2 h-8 px-3 rounded-lg bg-white/8 border border-[#7ccd89]/25 text-[11px] text-[#c9ddd1] hover:bg-white/12 transition-colors"
                        >
                          Определить координаты по адресу
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {searchItems.length > 20 && (
                <div className="text-xs text-[#8faea0]">Показаны первые 20 результатов</div>
              )}
            </div>
          )}
        </section>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8faea0] mb-3">
            Легенда
          </h3>
          <div className="space-y-2 text-xs text-[#a6beaf]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
              <span>Хранение</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
              <span>Захоронение</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4caf50]" />
              <span>Утилизация / обработка</span>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8faea0] mb-3">
            Подложка карты
          </h3>
          <div className="flex rounded-lg bg-white/8 border border-[#7ccd89]/25 p-1 gap-1">
            <button
              type="button"
              onClick={() => setBaseMapStyle('osm')}
              className={`flex-1 min-h-[36px] rounded-lg px-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                baseMapStyle === 'osm'
                  ? 'glass-btn-dark !h-9 !min-h-0 !rounded-lg !px-2'
                  : 'text-[#9ab3a5] hover:text-[#f5fff7] hover:bg-white/10'
              }`}
            >
              Обычная
            </button>
            <button
              type="button"
              onClick={() => setBaseMapStyle('cadastral')}
              className={`flex-1 min-h-[36px] rounded-lg px-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                baseMapStyle === 'cadastral'
                  ? 'glass-btn-dark !h-9 !min-h-0 !rounded-lg !px-2'
                  : 'text-[#9ab3a5] hover:text-[#f5fff7] hover:bg-white/10'
              }`}
            >
              Кадастровая
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8faea0]">
            {CADASTRE_IFRAME_URL ? (
              baseMapStyle === 'cadastral' ? (
                <>
                  Встроена карта в стиле{' '}
                  <a
                    href="https://ik8map.roscadastres.com/map"
                    className="text-[#2e7d32] hover:text-[#43a047] underline underline-offset-2"
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
                  Задан <span className="text-[#d1e5d8] font-medium">VITE_CADASTRE_IFRAME_URL</span>: в режиме «Кадастровая» откроется та же
                  схема, что на ik8map.roscadastres.com (векторные тайлы, цвет #D20404).
                </>
              )
            ) : (
              <>
                Векторные границы участков (GeoJSON с бэкенда) и клик по карте — запрос сведений ПКК. При зуме ≥ 14
                подгружаются контуры; клик открывает карточку. Если API ПКК редиректится, настройте CADASTRE_PKK_API_BASE /
                CADASTRE_MAPSERVER_BASE на сервере (см. server/.env.example). Альтернатива — iframe:{' '}
                <span className="text-[#d1e5d8] font-medium">VITE_CADASTRE_IFRAME_URL</span>.
              </>
            )}
          </p>
        </section>

        <section className="mt-auto pt-2 border-t border-[#72b77d]/25">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8faea0] mb-3">
            Маршрут
          </h3>
          <div className="space-y-3 text-xs text-[#c0d6ca]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0] mb-1.5">Точка А</p>
              <input
                type="text"
                placeholder="Выберите объект"
                className={mapFieldSm}
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8faea0] mb-1.5">Точка B</p>
              <input
                type="text"
                placeholder="Выберите объект"
                className={mapFieldSm}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 glass-btn-dark !h-9 !rounded-lg text-[11px] font-medium"
              >
                Построить
              </button>
              <button
                type="button"
                className="flex-1 h-9 rounded-lg border border-[#7ccd89]/25 bg-white/10 text-[11px] text-[#d8eade] hover:bg-white/14 transition-colors"
              >
                Сбросить
              </button>
            </div>
          </div>
        </section>
        </div>
      </aside>

      <div className="flex-1 relative min-w-0">
        {cadastreUsesIframe ? (
          <iframe
            title="Публичная кадастровая карта"
            src={CADASTRE_IFRAME_URL}
            className="absolute inset-0 z-0 h-full w-full min-h-0 border-0 bg-[#0a0a0a]"
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
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {baseMapStyle === 'cadastral' && <CadastreVectorSystem enabled apiBase={getApiUrl} />}
            <ClusterMarkers items={markersItems} selectedId={selectedId} onSelectId={setSelectedId} />
          </MapContainer>
        )}
        {!menuVisible && (
          <button
            type="button"
            onClick={() => setMenuVisible(true)}
            className="absolute left-4 top-4 z-20 glass-btn-soft inline-flex items-center justify-center gap-2 h-9 min-w-[88px] px-3 py-2 text-xs font-medium pointer-events-auto whitespace-nowrap"
            title="Показать меню"
          >
            <PanelLeft className="w-4 h-4 flex-shrink-0" />
            Меню
          </button>
        )}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className={`pointer-events-auto inline-flex items-center gap-1 rounded-lg bg-[#0f1f18]/80 border border-[#7ccd89]/30 shadow-md p-1 ${!menuVisible ? 'ml-14' : ''}`}>
            <button
              type="button"
              className="h-8 min-w-[72px] rounded-md px-3 text-[11px] font-medium text-white bg-[#4caf50] transition-colors whitespace-nowrap"
            >
              2D карта
            </button>
            <button
              type="button"
              className="h-8 min-w-[72px] rounded-md px-3 text-[11px] font-medium text-[#aac1b4] hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              3D глобус
            </button>
          </div>
          <Link
            to="/upload"
            className="pointer-events-auto inline-flex items-center justify-center h-9 min-w-[120px] rounded-lg bg-[#4caf50] px-4 py-2 text-[11px] font-medium text-white hover:bg-[#43a047] transition-colors whitespace-nowrap shadow-md"
          >
            Разместить объект
          </Link>
        </div>
      </div>
    </div>
  );
}
