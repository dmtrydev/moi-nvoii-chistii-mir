import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { fkkoCodesToQueryParam, normalizeFkkoCodeList } from '@/utils/fkko';
import { ACTIVITY_TYPE_FILTER_ORDER, normalizeActivityTypesForFilter } from '@/utils/activityTypesFilter';
import {
  SEARCH_RESULTS_PAGE_SIZE,
  SearchResultsPagination,
} from '@/components/search/SearchResultsPagination';
import { toPositiveInt } from '@/utils/positiveInt';
import {
  buildCanonicalSearchKey,
  buildSearchParamsFromFilters,
  clearCachedResults,
  parseFiltersFromSearchParams,
  readCachedResults,
  writeCachedResults,
} from '@/utils/searchState';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import heroBackground from '@/assets/home-landing/hero-background.png';
import homeResultsMapCtaIcon from '@/assets/home-landing/home-results-map-cta-icon.svg';
import homeResultsEnterpriseCtaIcon from '@/assets/home-landing/home-results-enterprise-cta-icon.svg';
import { useRotatingSearchMessage } from '@/hooks/useRotatingSearchMessage';
import { FilterPanelSection } from '@/components/home-landing/FilterPanelSection';
import { HeroCopySection } from '@/components/home-landing/HeroCopySection';
import { HomePreviewMap } from '@/components/home-landing/HomePreviewMap';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { mapPointsFromLicenseItems } from '@/utils/mapPointsFromLicenses';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';

/** Вводная анимация: очень плавное замедление в конце */
const HOME_INTRO_EASE = 'cubic-bezier(0.14, 0.9, 0.22, 1)';
const HOME_INTRO_WHITE_MS = 1000;
const HOME_INTRO_MOTION_MS = 2200;
const HOME_INTRO_DELAY_FILTER_MS = 160;
const HOME_INTRO_DELAY_BELOW_MS = 320;
const HOME_INTRO_SLIDE_PX = 36;

/** После «Найти»: подъём/схлопывание и появление результатов */
const SEARCH_LAYOUT_MS = 1000;
const SEARCH_RESULTS_DELAY_MS = 480;
const SEARCH_RESULTS_REVEAL_MS = 1200;
/** Одинаковый подъём фильтра и нижней колонки; зазор между карточками визуально = mt-6 (24px). Компактный mt-[52px] = 24px + lift. */
const SEARCH_LIFT_PX = 28;

const INITIAL_FKKO: string[] = [];
const INITIAL_VID: string[] = [];
const INITIAL_REGION = '';
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');
function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

export function HomeLanding(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState<string[]>(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);
  const [fkkoOptions, setFkkoOptions] = useState<string[]>([]);
  const [fkkoTitleByCode, setFkkoTitleByCode] = useState<Record<string, string>>({});
  const mergeFkkoTitles = useCallback((partial: Record<string, string>) => {
    setFkkoTitleByCode((prev) => ({ ...prev, ...partial }));
  }, []);
  const [activityTypeOptions, setActivityTypeOptions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState('');
  const [items, setItems] = useState<LicenseData[]>([]);
  /** Страница списка результатов на главной (0-based). */
  const [resultsListPage, setResultsListPage] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsReveal, setResultsReveal] = useState(false);
  /** Данные для карты внизу главной: обновляются при смене фильтров без нажатия «Найти». */
  const [mapPreviewItems, setMapPreviewItems] = useState<LicenseData[]>([]);
  const [mapPreviewLoading, setMapPreviewLoading] = useState(false);
  const mapPreviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapPreviewAbortRef = useRef<AbortController | null>(null);
  const searchPhaseLabel = useRotatingSearchMessage(isSearching);

  const homeMapPoints = useMemo(() => mapPointsFromLicenseItems(mapPreviewItems), [mapPreviewItems]);

  useEffect(() => {
    if (mapPreviewDebounceRef.current) clearTimeout(mapPreviewDebounceRef.current);
    mapPreviewDebounceRef.current = window.setTimeout(() => {
      mapPreviewAbortRef.current?.abort();
      const ac = new AbortController();
      mapPreviewAbortRef.current = ac;
      setMapPreviewLoading(true);
      const params = buildSearchParamsFromFilters({
        region: filterRegion.trim(),
        fkko: filterFkko,
        vid: filterVid,
        searched: false,
      });
      params.delete('searched');
      void fetch(getApiUrl(`/api/license-sites?${params.toString()}`), { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { items?: LicenseData[] }) => {
          const arr = Array.isArray(data.items) ? data.items : [];
          setMapPreviewItems(arr);
        })
        .catch((err: unknown) => {
          const aborted =
            (err instanceof Error && err.name === 'AbortError') ||
            (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError');
          if (aborted) return;
          setMapPreviewItems([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setMapPreviewLoading(false);
        });
    }, 420);
    return () => {
      if (mapPreviewDebounceRef.current) clearTimeout(mapPreviewDebounceRef.current);
      mapPreviewAbortRef.current?.abort();
    };
  }, [filterFkko, filterRegion, filterVid]);

  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [introStage, setIntroStage] = useState<0 | 1 | 2>(() => {
    if (typeof window === 'undefined') return 0;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 2 : 0;
  });

  const motionOn = introStage >= 2;
  const transitionMotion = `${HOME_INTRO_MOTION_MS}ms ${HOME_INTRO_EASE}`;
  const transitionWhite = `${HOME_INTRO_WHITE_MS}ms ${HOME_INTRO_EASE}`;

  useEffect(() => {
    if (introStage !== 0) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIntroStage(1));
    });
    return () => cancelAnimationFrame(id);
  }, [introStage]);

  useEffect(() => {
    if (!hasSearched) {
      setResultsReveal(false);
      return;
    }
    if (prefersReducedMotion) {
      setResultsReveal(true);
      return;
    }
    const t = window.setTimeout(() => setResultsReveal(true), SEARCH_RESULTS_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [hasSearched, prefersReducedMotion]);

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
    const defaults = [...ACTIVITY_TYPE_FILTER_ORDER];
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
        const list = fkkoParam ? fromApi : [...new Set([...defaults, ...fromApi])];
        setActivityTypeOptions(normalizeActivityTypesForFilter(list));
        if (fkkoParam) {
          setFilterVid((prev) => prev.filter((v) => fromApi.includes(v)));
        }
      })
      .catch(() => {
        if (!alive) return;
        setActivityTypeOptions(normalizeActivityTypesForFilter(defaults));
      });
    return () => {
      alive = false;
    };
  }, [filterFkko]);

  const regionOptions = useMemo(() => {
    const normalized = RUSSIAN_REGION_SUGGESTIONS.map((r) => String(r).trim()).filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'ru'));
  }, []);

  const handleResetFilters = useCallback((): void => {
    const key = buildCanonicalSearchKey({
      region: filterRegion.trim(),
      fkko: filterFkko,
      vid: filterVid,
    });
    clearCachedResults(key);
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
    setValidationError('');
    setItems([]);
    setResultsListPage(0);
    setHasSearched(false);
    setResultsReveal(false);
    setSearchError('');
    setSearchParams(new URLSearchParams());
  }, [filterRegion, filterFkko, filterVid, setSearchParams]);

  const runSearch = useCallback(
    async (
      filters?: { region: string; fkko: string[]; vid: string[]; searched: boolean },
      opts?: { cacheFirst?: boolean },
    ): Promise<void> => {
      const nextFilters = filters ?? {
        region: filterRegion.trim(),
        fkko: filterFkko,
        vid: filterVid,
        searched: true,
      };
      const vidQuery = nextFilters.vid.map((x) => String(x).trim()).filter(Boolean).join(', ');
      if (!vidQuery) {
        setValidationError('Укажите вид обращения.');
        return;
      }

      const key = buildCanonicalSearchKey(nextFilters);
      if (opts?.cacheFirst) {
        const cached = readCachedResults(key);
        if (cached) {
          setValidationError('');
          setSearchError('');
          setHasSearched(true);
          setItems(cached);
          setResultsListPage(0);
          return;
        }
      }

      setValidationError('');
      setSearchError('');
      setIsSearching(true);
      setHasSearched(true);
      try {
        const params = buildSearchParamsFromFilters(nextFilters);
        params.delete('searched');
        const resp = await fetch(getApiUrl(`/api/license-sites?${params.toString()}`));
        const data = await (resp.ok ? resp.json() : resp.json().catch(() => ({})));
        if (!resp.ok)
          throw new Error((data as { message?: string }).message ?? `Ошибка ${resp.status}`);
        const found = (data as { items?: LicenseData[] }).items;
        const nextItems = Array.isArray(found) ? found : [];
        setItems(nextItems);
        setResultsListPage(0);
        writeCachedResults(key, nextItems);
      } catch (err) {
        setItems([]);
        setResultsListPage(0);
        setSearchError(err instanceof Error ? err.message : 'Ошибка поиска');
      } finally {
        setIsSearching(false);
      }
    },
    [filterRegion, filterFkko, filterVid],
  );
  const runSearchRef = useRef(runSearch);
  useEffect(() => {
    runSearchRef.current = runSearch;
  }, [runSearch]);
  const lastHydratedSearchRef = useRef<string | null>(null);

  /** Переход на карту с теми же фильтрами; `focusSiteId` — открыть маркер и карточку этой площадки. */
  const buildMapUrl = useCallback(
    (focusSiteId?: number | null): string => {
      const params = buildSearchParamsFromFilters({
        region: filterRegion,
        fkko: filterFkko,
        vid: filterVid,
        searched: hasSearched || (typeof focusSiteId === 'number' && focusSiteId > 0),
      });
      if (typeof focusSiteId === 'number' && focusSiteId > 0) {
        params.set('focusSite', String(focusSiteId));
      }
      return `/map?${params.toString()}`;
    },
    [filterRegion, filterFkko, filterVid, hasSearched],
  );

  const resultsPageSize = SEARCH_RESULTS_PAGE_SIZE;
  const homeResultsTotal = items.length;
  const homeResultsPageCount = Math.max(1, Math.ceil(homeResultsTotal / resultsPageSize));
  const homeResultsPageClamped = Math.min(resultsListPage, homeResultsPageCount - 1);
  const pagedHomeItems = useMemo(
    () =>
      items.slice(
        homeResultsPageClamped * resultsPageSize,
        homeResultsPageClamped * resultsPageSize + resultsPageSize,
      ),
    [items, homeResultsPageClamped, resultsPageSize],
  );
  useEffect(() => {
    if (homeResultsPageClamped !== resultsListPage) setResultsListPage(homeResultsPageClamped);
  }, [homeResultsPageClamped, resultsListPage]);

  const searchParamsKey = searchParams.toString();
  useEffect(() => {
    if (lastHydratedSearchRef.current === searchParamsKey) return;
    lastHydratedSearchRef.current = searchParamsKey;
    const parsed = parseFiltersFromSearchParams(new URLSearchParams(searchParamsKey));
    setFilterRegion((prev) => (prev === parsed.region ? prev : parsed.region));
    setFilterFkko((prev) => (areStringArraysEqual(prev, parsed.fkko) ? prev : parsed.fkko));
    setFilterVid((prev) => (areStringArraysEqual(prev, parsed.vid) ? prev : parsed.vid));
    setHasSearched(parsed.searched);

    if (parsed.searched && parsed.vid.length > 0) {
      void runSearchRef.current(parsed, { cacheFirst: true });
    }
  }, [searchParamsKey]);

  const heroInnerTransition = useMemo(() => {
    if (introStage < 2) return 'none';
    if (prefersReducedMotion) return 'none';
    const e = HOME_INTRO_EASE;
    const ms = hasSearched ? SEARCH_LAYOUT_MS : HOME_INTRO_MOTION_MS;
    return `opacity ${ms}ms ${e}, transform ${ms}ms ${e}`;
  }, [introStage, hasSearched, prefersReducedMotion]);

  const filterTransition = useMemo(() => {
    if (introStage < 2 || prefersReducedMotion) return 'none';
    const e = HOME_INTRO_EASE;
    return `opacity ${HOME_INTRO_MOTION_MS}ms ${e}, transform ${(hasSearched ? SEARCH_LAYOUT_MS : HOME_INTRO_MOTION_MS)}ms ${e}`;
  }, [introStage, hasSearched, prefersReducedMotion]);

  const bottomColumnTransition = useMemo(() => {
    if (introStage < 2 || prefersReducedMotion) return 'none';
    const e = HOME_INTRO_EASE;
    return `opacity ${HOME_INTRO_MOTION_MS}ms ${e}, transform ${(hasSearched ? SEARCH_LAYOUT_MS : HOME_INTRO_MOTION_MS)}ms ${e}`;
  }, [introStage, hasSearched, prefersReducedMotion]);

  const heroGridClass = prefersReducedMotion
    ? 'grid min-h-0'
    : 'grid min-h-0 transition-[grid-template-rows] motion-reduce:transition-none';
  const heroGridStyle = prefersReducedMotion
    ? { gridTemplateRows: hasSearched ? ('0fr' as const) : ('1fr' as const) }
    : {
        gridTemplateRows: hasSearched ? ('0fr' as const) : ('1fr' as const),
        transition: `grid-template-rows ${SEARCH_LAYOUT_MS}ms ${HOME_INTRO_EASE}`,
      };

  const searchLiftPx =
    hasSearched && !prefersReducedMotion && motionOn ? SEARCH_LIFT_PX : 0;

  return (
    <section className="relative flex min-h-screen w-full max-w-full min-w-0 flex-col self-stretch">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[#f9fbfe]"
        style={{
          backgroundImage: `url(${heroBackground})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] bg-white/30 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        style={{
          opacity: motionOn ? 0 : 1,
          transition: introStage >= 2 ? `opacity ${transitionMotion}` : 'none',
        }}
      />
      <SiteFrameWithTopNav
        navSlotStyle={{
          opacity: motionOn ? 1 : 0,
          transition: introStage >= 2 ? `opacity ${transitionMotion}` : 'none',
        }}
      >
          <div className={heroGridClass} style={heroGridStyle}>
            <div className="min-h-0 overflow-hidden">
              <div
                style={{
                  opacity: motionOn ? (hasSearched ? 0 : 1) : 0,
                  transform: motionOn
                    ? hasSearched
                      ? 'translateY(-32px)'
                      : 'translateY(0)'
                    : `translateY(${HOME_INTRO_SLIDE_PX}px)`,
                  transition: heroInnerTransition,
                  pointerEvents: hasSearched ? 'none' : 'auto',
                }}
              >
                <HeroCopySection />
              </div>
            </div>
          </div>
          <div
            className="relative z-[40]"
            style={{
              opacity: motionOn ? 1 : 0,
              transform: motionOn
                ? `translateY(${searchLiftPx ? -searchLiftPx : 0}px)`
                : `translateY(${HOME_INTRO_SLIDE_PX}px)`,
              transition: filterTransition,
              transitionDelay:
                introStage >= 2 && !hasSearched ? `${HOME_INTRO_DELAY_FILTER_MS}ms` : '0ms',
            }}
          >
            <FilterPanelSection
              filterFkko={filterFkko}
              onFilterFkkoChange={setFilterFkko}
              fkkoOptions={fkkoCatalogCodes}
              filterVid={filterVid}
              onFilterVidChange={setFilterVid}
              activityTypeOptions={activityTypeOptions}
              filterRegion={filterRegion}
              onFilterRegionChange={setFilterRegion}
              regionOptions={regionOptions}
              onSearch={() => {
                const next = {
                  region: filterRegion.trim(),
                  fkko: filterFkko,
                  vid: filterVid,
                  searched: true,
                };
                setSearchParams(buildSearchParamsFromFilters(next));
                void runSearch(next, { cacheFirst: true });
              }}
              onReset={handleResetFilters}
              compactAfterSearch={hasSearched}
              compactMarginTopClass={
                hasSearched ? (searchLiftPx > 0 ? 'mt-[52px]' : 'mt-6') : undefined
              }
              fkkoTitleByCode={fkkoTitleByCode}
              resolveFkkoTitlesApi={getApiUrl}
              onFkkoTitlesMerge={mergeFkkoTitles}
            />
          </div>

          <div
            className="relative z-10 mx-auto w-full min-w-0 max-w-[1920px] px-4 pb-12 sm:pb-16"
            style={{
              opacity: motionOn ? 1 : 0,
              transform: motionOn
                ? `translateY(${searchLiftPx ? -searchLiftPx : 0}px)`
                : `translateY(${HOME_INTRO_SLIDE_PX}px)`,
              transition: bottomColumnTransition,
              transitionDelay:
                introStage >= 2 && !hasSearched ? `${HOME_INTRO_DELAY_BELOW_MS}ms` : '0ms',
            }}
          >
            {validationError && (
              <div
                role="alert"
                className="relative z-0 mt-6 rounded-[32.5px] bg-[#ffffff4c] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]"
              >
                <div className="relative z-[2] px-6 py-5 sm:px-8 lg:px-9">
                  <p className="font-nunito font-semibold text-[#5e6567] text-base leading-normal sm:text-lg">
                    {validationError}
                  </p>
                </div>
              </div>
            )}

            {hasSearched && (
              <div
                className="will-change-transform"
                style={{
                  opacity: resultsReveal ? 1 : 0,
                  transform: resultsReveal ? 'translateY(0)' : 'translateY(52px)',
                  transition: prefersReducedMotion
                    ? 'none'
                    : `opacity ${SEARCH_RESULTS_REVEAL_MS}ms ${HOME_INTRO_EASE}, transform ${SEARCH_RESULTS_REVEAL_MS}ms ${HOME_INTRO_EASE}`,
                  pointerEvents: resultsReveal ? 'auto' : 'none',
                }}
              >
              <section className="relative z-0 mt-6 rounded-[32.5px] bg-[#ffffff4c] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
                {/* Header */}
                <div className="relative z-[2] flex flex-wrap items-center justify-between gap-4 px-6 pt-7 pb-4 sm:px-8 lg:px-9">
                  <h3 className="typo-h3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]">
                    Подходящие предприятия:
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate(buildMapUrl())}
                    className="group relative inline-flex h-[52px] items-center justify-center overflow-hidden rounded-[20px] bg-[#ffffff73] px-5 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-colors duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#ffffffa6] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2"
                  >
                    <span className="relative z-[2] inline-flex items-center gap-2.5">
                      <span className="relative mt-[-1px] whitespace-nowrap font-nunito font-semibold text-[#2b3335] text-base transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 group-hover:translate-x-[calc((27px+0.625rem)/2)]">
                        Все на карте
                      </span>
                      <span className="relative flex h-[27px] w-[27px] shrink-0 items-center justify-center transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0">
                        <img
                          className="h-[21px] w-[21px] object-contain pointer-events-none"
                          alt=""
                          src={homeResultsMapCtaIcon}
                        />
                      </span>
                    </span>
                  </button>
                </div>

                {/* Content */}
                <div className="relative z-[2] px-6 pb-7 sm:px-8 lg:px-9">
                  {isSearching && (
                    <p
                      className="py-8 text-center font-nunito font-semibold text-[#5e6567] text-lg"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      {searchPhaseLabel}
                    </p>
                  )}
                  {!isSearching && searchError && (
                    <p className="py-8 text-center font-nunito font-semibold text-red-600 text-lg">
                      {searchError}
                    </p>
                  )}
                  {!isSearching && !searchError && items.length === 0 && (
                    <p className="py-8 text-center font-nunito font-semibold text-[#5e6567] text-lg">
                      По этим фильтрам ничего не найдено.
                    </p>
                  )}
                  {!isSearching && !searchError && items.length > 0 && (
                    <div className="flex max-h-[600px] flex-col gap-2.5">
                      <SearchResultsPagination
                        total={homeResultsTotal}
                        page={homeResultsPageClamped}
                        pageCount={homeResultsPageCount}
                        pageSize={resultsPageSize}
                        onPrev={() => setResultsListPage((p) => Math.max(0, p - 1))}
                        onNext={() =>
                          setResultsListPage((p) => {
                            const last = Math.max(0, Math.ceil(items.length / resultsPageSize) - 1);
                            return Math.min(last, p + 1);
                          })
                        }
                      />
                      <div className="no-scrollbar flex flex-col gap-2.5 overflow-y-auto pr-1">
                      {pagedHomeItems.map((item) => {
                        const detailsPath =
                          typeof item.id === 'number' ? `/enterprise/${item.id}` : '/map';

                        return (
                          <article
                            key={item.id ?? `${item.companyName}-${item.inn}-${item.address}`}
                            className="rounded-[32.5px] border border-solid border-white bg-[#ffffff80] p-6 shadow-[inset_0px_0px_70.1px_#ffffffb2] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-7 lg:p-8"
                          >
                            {/* Content */}
                            <div className="space-y-5">
                              <div className="space-y-2.5">
                                <h4 className="typo-h4 max-w-[900px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]">
                                  {item.companyName || 'Организация'}
                                </h4>
                                <div className="flex flex-wrap items-center gap-3.5 font-nunito font-semibold text-[#5e6567] text-base sm:text-lg">
                                  <span>
                                    <span className="font-bold">ИНН:</span>{' '}
                                    {item.inn || 'не указан'}
                                  </span>
                                  {item.address && (
                                    <>
                                      <span>|</span>
                                      <span>{item.address}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                                <EnterpriseActivityStrip
                                  activityTypes={item.activityTypes}
                                  variant="light"
                                  size="md"
                                />
                                <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto lg:min-w-0 lg:flex-1 lg:justify-end">
                                  <div className="ml-auto flex w-full max-w-[435px] flex-col items-stretch gap-3 lg:ml-0 lg:max-w-none lg:flex-row lg:items-center lg:gap-5">
                                    <Link
                                      to={buildMapUrl(toPositiveInt(item.siteId))}
                                      className="group home-find-button relative inline-flex h-[50px] w-full items-center justify-center overflow-hidden rounded-[16px] px-5 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[16px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:h-[56px] sm:rounded-[18px] sm:px-7 sm:min-w-[200px] lg:h-[60px] lg:w-auto lg:rounded-[20px] lg:px-8 lg:min-w-[200px]"
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
                                      to={detailsPath}
                                      className="group home-find-button relative inline-flex h-[50px] w-full items-center justify-center overflow-hidden rounded-[16px] px-5 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[16px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:h-[56px] sm:rounded-[18px] sm:px-7 sm:min-w-[200px] lg:h-[60px] lg:w-auto lg:rounded-[20px] lg:px-8 lg:min-w-[200px]"
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
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
              </div>
            )}
          </div>

          <RevealOnScroll
            variant="reveal-scale"
            className="relative z-10 mx-auto w-full max-w-[1920px] px-4 pb-16 sm:pb-20"
          >
            <section className="relative z-0 mt-6 overflow-hidden rounded-[32.5px] bg-[#ffffff4c] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
              <div className="relative z-[2] px-6 pt-7 pb-5 sm:px-8 lg:px-9">
                <h3 className="typo-h3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]">
                  Карта объектов
                </h3>
              </div>
              <HomePreviewMap
                className="!rounded-none !border-0 !bg-transparent !shadow-none"
                points={homeMapPoints}
                loading={mapPreviewLoading}
              />
            </section>
          </RevealOnScroll>
      </SiteFrameWithTopNav>
      {introStage < 2 && (
        <div
          aria-hidden
          className="fixed inset-0 z-[200] bg-white"
          style={{
            opacity: introStage === 0 ? 1 : 0,
            transition: `opacity ${transitionWhite}`,
            pointerEvents: introStage === 0 ? 'auto' : 'none',
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === 'opacity' && introStage === 1) setIntroStage(2);
          }}
        />
      )}
    </section>
  );
}
