import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { LicenseResultCard } from '@/components/licenses/LicenseResultCard';
import { formatFkkoHuman } from '@/utils/fkko';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import type { AutocompleteOption } from '@/components/ui/AutocompleteInput';
import { getFkkoGroupName } from '@/constants/fkko';
import heroBackground from '@/assets/home-landing/hero-background.png';
import { FilterPanelSection } from '@/components/home-landing/FilterPanelSection';
import { FrameScreen } from '@/components/home-landing/FrameScreen';
import { HeroCopySection } from '@/components/home-landing/HeroCopySection';
import { TopNavigationSection } from '@/components/home-landing/TopNavigationSection';

const INITIAL_FKKO = '';
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

export function HomeLanding(): JSX.Element {
  const navigate = useNavigate();
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState<string[]>(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);
  const [fkkoOptions, setFkkoOptions] = useState<string[]>([]);
  const [activityTypeOptions, setActivityTypeOptions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState('');
  const [items, setItems] = useState<LicenseData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(getApiUrl('/api/filters/fkko'))
      .then((r) => (r.ok ? r.json() : { fkko: [] }))
      .then((fkkoData) => {
        if (!alive) return;
        setFkkoOptions(Array.isArray(fkkoData.fkko) ? fkkoData.fkko : []);
      })
      .catch(() => {
        if (!alive) return;
        setFkkoOptions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const defaults = [
      'Сбор',
      'Транспортирование',
      'Обезвреживание',
      'Утилизация',
      'Размещение',
      'Обработка',
      'Захоронение',
    ];
    const fkkoDigits = filterFkko.replace(/[^\d]+/g, '');
    const fkkoParam = /^\d{11}$/.test(fkkoDigits) ? fkkoDigits : '';
    const url = fkkoParam
      ? getApiUrl(`/api/filters/activity-types?fkko=${fkkoParam}`)
      : getApiUrl('/api/filters/activity-types');
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { activityTypes: [] }))
      .then((data) => {
        if (!alive) return;
        const fromApi = Array.isArray(data.activityTypes) ? data.activityTypes : [];
        const list = fkkoParam ? fromApi : [...new Set([...defaults, ...fromApi])];
        setActivityTypeOptions(
          list
            .map((x: string) => String(x).trim())
            .filter((x: string) => x && x.toLowerCase() !== 'иное'),
        );
        if (fkkoParam) {
          setFilterVid((prev) => prev.filter((v) => fromApi.includes(v)));
        }
      })
      .catch(() => {
        if (!alive) return;
        setActivityTypeOptions(defaults);
      });
    return () => {
      alive = false;
    };
  }, [filterFkko]);

  const fkkoHintOptions = useMemo<AutocompleteOption[]>(() => {
    const seen = new Set<string>();
    const opts: AutocompleteOption[] = [];
    fkkoOptions.forEach((codeRaw) => {
      const raw = String(codeRaw).trim();
      if (!raw || seen.has(raw)) return;
      seen.add(raw);
      const formatted = formatFkkoHuman(raw);
      const groupName = getFkkoGroupName(raw);
      opts.push({
        value: formatted,
        label: `${formatted} - ${groupName}`,
        searchText: `${formatted} ${raw} ${groupName}`.toLowerCase(),
      });
    });
    return opts;
  }, [fkkoOptions]);

  const regionOptions = useMemo(() => {
    const normalized = RUSSIAN_REGION_SUGGESTIONS.map((r) => String(r).trim()).filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'ru'));
  }, []);

  const handleResetFilters = useCallback((): void => {
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
    setValidationError('');
    setItems([]);
    setHasSearched(false);
    setSearchError('');
  }, []);

  const vidQuery = useMemo(
    () => filterVid.map((x) => String(x).trim()).filter(Boolean).join(', '),
    [filterVid],
  );

  const runSearch = useCallback(async (): Promise<void> => {
    const r = filterRegion.trim();
    const f = filterFkko.trim();
    const v = vidQuery.trim();
    if (!f || !v) {
      setValidationError('Заполните обязательные поля: ФККО и вид обращения.');
      return;
    }
    setValidationError('');
    setSearchError('');
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ fkko: f, vid: v });
      if (r) params.set('region', r);
      const resp = await fetch(getApiUrl(`/api/licenses?${params.toString()}`));
      const data = await (resp.ok ? resp.json() : resp.json().catch(() => ({})));
      if (!resp.ok) throw new Error((data as { message?: string }).message ?? `Ошибка ${resp.status}`);
      const found = (data as { items?: LicenseData[] }).items;
      setItems(Array.isArray(found) ? found : []);
    } catch (err) {
      setItems([]);
      setSearchError(err instanceof Error ? err.message : 'Ошибка поиска');
    } finally {
      setIsSearching(false);
    }
  }, [filterRegion, filterFkko, vidQuery]);

  const toMapPath = useCallback((): string => {
    const params = new URLSearchParams({
      fkko: filterFkko.trim(),
      vid: vidQuery.trim(),
    });
    const r = filterRegion.trim();
    if (r) params.set('region', r);
    return `/map?${params.toString()}`;
  }, [filterRegion, filterFkko, vidQuery]);

  return (
    <section className="relative flex min-h-screen w-full max-w-full min-w-0 flex-col self-stretch">
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
      <div className="relative z-[1] w-full max-w-full min-w-0">
        <FrameScreen>
          <TopNavigationSection />
          <HeroCopySection />
          <FilterPanelSection
            filterFkko={filterFkko}
            onFilterFkkoChange={setFilterFkko}
            fkkoHintOptions={fkkoHintOptions}
            filterVid={filterVid}
            onFilterVidChange={setFilterVid}
            activityTypeOptions={activityTypeOptions}
            filterRegion={filterRegion}
            onFilterRegionChange={setFilterRegion}
            regionOptions={regionOptions}
            onSearch={() => void runSearch()}
            onReset={handleResetFilters}
          />
        </FrameScreen>
      </div>

      <div className="relative z-[1] w-full min-w-0 max-w-[1510px] mx-auto px-4 sm:px-6 md:px-8 lg:px-[50px] pb-12 sm:pb-16">
        {validationError && (
          <div className="mt-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {validationError}
          </div>
        )}

        {hasSearched && (
          <section className="mt-6 glass-panel p-4 sm:p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display font-bold text-2xl sm:text-[32px] text-ink leading-tight">Подходящие предприятия</h3>
              <button
                type="button"
                onClick={() => navigate(toMapPath())}
                className="inline-flex items-center justify-center h-9 rounded-xl border border-black/[0.08] bg-app-bg px-4 text-xs font-semibold text-ink hover:bg-white transition-colors"
              >
                Все на карте
              </button>
            </div>
            {isSearching && <p className="text-sm text-ink-muted">Идёт поиск…</p>}
            {!isSearching && searchError && <p className="text-sm glass-danger">{searchError}</p>}
            {!isSearching && !searchError && items.length === 0 && (
              <p className="text-sm text-ink-muted">По этим фильтрам ничего не найдено.</p>
            )}
            {!isSearching && !searchError && items.length > 0 && (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <LicenseResultCard
                    key={item.id ?? `${item.companyName}-${item.inn}-${item.address}`}
                    item={item}
                    mapPath={toMapPath()}
                    detailsPath={typeof item.id === 'number' ? `/enterprise/${item.id}` : '/map'}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
