import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { LicenseResultCard } from '@/components/licenses/LicenseResultCard';
import { formatFkkoHuman } from '@/utils/fkko';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import { AutocompleteInput, type AutocompleteOption } from '@/components/ui/AutocompleteInput';
import { getFkkoGroupName } from '@/constants/fkko';
import { useAuth } from '@/contexts/useAuth';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';

const INITIAL_FKKO = '';
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

const fieldClass = 'liquid-field';

export function HeroBannerSection(): JSX.Element {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const isLoggedIn = isReady && !!user;
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
    const defaults = ['Сбор', 'Транспортирование', 'Обезвреживание', 'Утилизация', 'Размещение', 'Обработка', 'Захоронение'];
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

  const regionOptions = useMemo(() => {
    const normalized = RUSSIAN_REGION_SUGGESTIONS
      .map((r) => String(r).trim())
      .filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'ru'));
  }, []);

  const handleResetFilters = (): void => {
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
    setValidationError('');
  };

  const vidQuery = useMemo(() => filterVid.map((x) => String(x).trim()).filter(Boolean).join(', '), [filterVid]);

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
    <section className="relative w-full self-stretch glass-bg min-h-screen flex flex-col">
      <div className="relative z-[1] flex flex-1 flex-col items-stretch justify-center max-w-[1510px] w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-[50px] py-12 sm:py-14 md:py-16 lg:py-20">
        <div className="flex min-w-0 w-full max-w-4xl flex-col gap-8 lg:gap-10">
            <header className="hero-reveal space-y-4 text-left">
              <h1 className="font-semibold text-ink text-2xl sm:text-3xl md:text-[28px] lg:text-[32px] xl:text-[34px] leading-tight tracking-tight">
                Управление отходами по ФККО, контроль объектов и маршрутов на одной карте.
              </h1>
              <p className="text-base sm:text-lg text-ink-muted max-w-2xl leading-relaxed">
                Фильтруйте по ФККО, виду обращения и региону. Планируйте экологическую инфраструктуру в
                реальном времени.
              </p>
            </header>

            <div className="hero-reveal">
              <Link
                to="/directory"
                className="glass-btn-dark inline-flex items-center justify-center h-10 sm:h-11 text-sm font-medium px-5 sm:px-6"
              >
                Открыть справочник
              </Link>
            </div>

            <div className="hero-reveal">
              {isLoggedIn ? (
                <Link
                  to="/dashboard/profile"
                  className="glass-btn-soft inline-flex items-center justify-center h-10 sm:h-11 text-sm font-medium px-5 sm:px-6"
                >
                  В личный кабинет
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="glass-btn-soft inline-flex items-center justify-center h-10 sm:h-11 text-sm font-medium px-5 sm:px-6"
                >
                  Регистрация / Вход
                </Link>
              )}
            </div>

            <div className="hero-reveal flex flex-col gap-4">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold text-ink leading-tight">
                  Фильтр объектов по экологии
                </h2>
                <p className="text-sm sm:text-base text-ink-muted">
                  Настройте параметры и смотрите объекты, площадки и маршруты в вашем регионе.
                </p>
              </div>

              {validationError && (
                <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  {validationError}
                </div>
              )}

              <div className="glass-panel p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-3 lg:gap-y-3">
                  <div className="w-full min-w-0 flex-1 lg:min-w-[180px]">
                    <AutocompleteInput
                      value={filterFkko}
                      onChange={setFilterFkko}
                      options={fkkoHintOptions}
                      placeholder="ФККО"
                      inputClassName={fieldClass}
                      maxItems={10}
                      noResultsText="Начните вводить код ФККО"
                    />
                  </div>
                  <div className="w-full min-w-0 flex-1 lg:min-w-[220px]">
                    <MultiSelectDropdown
                      options={activityTypeOptions}
                      selected={filterVid}
                      onChange={setFilterVid}
                      placeholder="Вид обращения"
                      buttonClassName={fieldClass}
                      maxHeightClassName="max-h-64"
                    />
                  </div>
                  <div className="w-full min-w-0 flex-1 lg:min-w-[200px]">
                    <AutocompleteInput
                      value={filterRegion}
                      onChange={setFilterRegion}
                      options={regionOptions}
                      placeholder="Регион (необязательно)"
                      inputClassName={fieldClass}
                      maxItems={10}
                      noResultsText="Начните вводить"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={() => void runSearch()}
                    className="glass-btn-dark inline-flex items-center justify-center px-5 sm:px-6 h-10 sm:h-11 text-sm font-medium"
                  >
                    Найти
                  </button>
                  <Link
                    to="/upload"
                    className="glass-btn-soft inline-flex items-center justify-center px-5 sm:px-6 h-10 sm:h-11 text-sm font-medium"
                  >
                    Разместить объект
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      setItems([]);
                      setHasSearched(false);
                      setSearchError('');
                    }}
                    className="text-sm font-medium text-ink-muted hover:text-ink transition-colors"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              </div>
            </div>

            {hasSearched && (
              <section className="hero-reveal glass-panel p-4 sm:p-5 md:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-ink">Подходящие предприятия</h3>
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
      </div>
    </section>
  );
}
