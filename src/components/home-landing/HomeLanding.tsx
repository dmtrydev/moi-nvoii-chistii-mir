import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { formatFkkoHuman, fkkoCodesToQueryParam, normalizeFkkoCodeList } from '@/utils/fkko';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { RUSSIAN_REGION_SUGGESTIONS } from '@/constants/regions';
import heroBackground from '@/assets/home-landing/hero-background.png';
import homeResultsMapCtaIcon from '@/assets/home-landing/home-results-map-cta-icon.svg';
import homeResultsEnterpriseCtaIcon from '@/assets/home-landing/home-results-enterprise-cta-icon.svg';
import { FilterPanelSection } from '@/components/home-landing/FilterPanelSection';
import { FrameScreen } from '@/components/home-landing/FrameScreen';
import { HeroCopySection } from '@/components/home-landing/HeroCopySection';
import { TopNavigationSection } from '@/components/home-landing/TopNavigationSection';

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
  const [fkkoTitleByCode, setFkkoTitleByCode] = useState<Record<string, string>>({});
  const [activityTypeOptions, setActivityTypeOptions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState('');
  const [items, setItems] = useState<LicenseData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsReveal, setResultsReveal] = useState(false);

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
          setFkkoTitleByCode(t as Record<string, string>);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fkkoCatalogCodes]);

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
        setActivityTypeOptions(
          list
            .map((x: string) => String(x).trim())
            .filter((x: string) => x && x.toLowerCase() !== 'иное')
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
    setResultsReveal(false);
    setSearchError('');
  }, []);

  const vidQuery = useMemo(
    () =>
      filterVid
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join(', '),
    [filterVid]
  );

  const runSearch = useCallback(async (): Promise<void> => {
    const r = filterRegion.trim();
    const f = fkkoCodesToQueryParam(filterFkko);
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
      if (!resp.ok)
        throw new Error((data as { message?: string }).message ?? `Ошибка ${resp.status}`);
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
      fkko: fkkoCodesToQueryParam(filterFkko),
      vid: vidQuery.trim(),
    });
    const r = filterRegion.trim();
    if (r) params.set('region', r);
    return `/map?${params.toString()}`;
  }, [filterRegion, filterFkko, vidQuery]);

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
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'top center',
          backgroundSize: 'min(1920px, 100vw) auto',
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
      <div className="relative z-[10] w-full max-w-full min-w-0">
        <FrameScreen>
          <div
            className="relative z-[50]"
            style={{
              opacity: motionOn ? 1 : 0,
              transition: introStage >= 2 ? `opacity ${transitionMotion}` : 'none',
            }}
          >
            <TopNavigationSection />
          </div>
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
              onSearch={() => void runSearch()}
              onReset={handleResetFilters}
              compactAfterSearch={hasSearched}
              compactMarginTopClass={
                hasSearched ? (searchLiftPx > 0 ? 'mt-[52px]' : 'mt-6') : undefined
              }
              fkkoTitleByCode={fkkoTitleByCode}
            />
          </div>

          <div
            className="relative z-10 mx-auto w-full min-w-0 max-w-[min(1880px,100%)] px-4 sm:px-6 md:px-8 lg:px-[min(50px,3.5vw)] pb-12 sm:pb-16"
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
                  <h3 className="bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text font-display font-bold text-[28px] text-transparent leading-[35.2px] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] sm:text-[32px]">
                    Подходящие предприятия:
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate(toMapPath())}
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
                    <p className="py-8 text-center font-nunito font-semibold text-[#5e6567] text-lg">
                      Идёт поиск…
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
                    <div className="no-scrollbar flex max-h-[600px] flex-col gap-2.5 overflow-y-auto pr-1">
                      {items.map((item) => {
                        const fkkoCodes = Array.isArray(item.fkkoCodes) ? item.fkkoCodes : [];
                        const mainFkko = fkkoCodes.slice(0, 3);
                        const restCount = Math.max(0, fkkoCodes.length - mainFkko.length);
                        const fkkoTotal = fkkoCodes.length;
                        const sitesCount = Array.isArray(item.sites) ? item.sites.length : 0;
                        const hasAddress = Boolean(item.address?.trim()) || sitesCount > 0;
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
                                <h4 className="max-w-[900px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text font-display font-bold text-[24px] text-transparent leading-[1.1] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] sm:text-[28px] sm:leading-[30.8px]">
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

                              <EnterpriseActivityStrip
                                activityTypes={item.activityTypes}
                                variant="light"
                                size="md"
                              />

                              <div className="space-y-2.5">
                                <div className="flex flex-wrap items-center gap-3">
                                  {fkkoTotal > 0 && (
                                    <span className="inline-flex items-center justify-center rounded-[15px] border border-solid border-[#ffffff96] bg-[#ffffffb2] px-[15px] py-2.5 font-nunito font-bold text-[#5e6567] text-base sm:text-lg">
                                      {fkkoTotal} {fkkoTotal === 1 ? 'код ФККО' : 'кодов ФККО'}
                                    </span>
                                  )}
                                  {hasAddress && (
                                    <span className="inline-flex items-center justify-center rounded-[15px] border border-solid border-[#ffffff96] bg-[#ffffff4c] px-[15px] py-2.5 font-nunito font-bold text-[#5e6567] text-base sm:text-lg">
                                      {sitesCount > 1 ? `Адресов: ${sitesCount}` : 'Адрес указан'}
                                    </span>
                                  )}
                                </div>
                                {/* FKKO codes + CTA buttons on same row */}
                                <div className="flex flex-wrap items-center gap-2.5">
                                  {mainFkko.map((code) => (
                                    <span
                                      key={code}
                                      className="inline-flex items-center justify-center rounded-[15px] border border-solid border-[#ffffff96] bg-[#ffffff4c] px-[15px] py-2.5 font-nunito font-bold text-[#5e6567] text-sm sm:text-base"
                                    >
                                      {formatFkkoHuman(code)}
                                    </span>
                                  ))}
                                  {restCount > 0 && (
                                    <span className="inline-flex items-center justify-center rounded-[15px] border border-solid border-[#ffffff96] bg-[#ffffff1c] px-[15px] py-2.5 font-nunito font-bold text-[#5e6567] text-sm sm:text-base">
                                      +{restCount}
                                    </span>
                                  )}

                                  <div className="ml-auto flex items-center gap-5">
                                    <Link
                                      to={toMapPath()}
                                      className="group home-find-button relative inline-flex h-[60px] items-center justify-center overflow-hidden rounded-[20px] px-8 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:min-w-[200px] lg:min-w-[435px]"
                                    >
                                      <span className="relative z-[2] inline-flex items-center gap-2.5">
                                        <span className="relative mt-[-1px] whitespace-nowrap font-nunito font-bold text-[#2b3335] text-xl text-center transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:translate-x-[calc((27px+0.625rem)/2)]">
                                          На карте
                                        </span>
                                        <span className="relative flex h-[27px] w-[27px] shrink-0 items-center justify-center transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0">
                                          <img
                                            className="h-[21px] w-[21px] object-contain pointer-events-none"
                                            alt=""
                                            src={homeResultsMapCtaIcon}
                                          />
                                        </span>
                                      </span>
                                    </Link>
                                    <Link
                                      to={detailsPath}
                                      className="group home-find-button relative inline-flex h-[60px] items-center justify-center overflow-hidden rounded-[20px] px-8 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:min-w-[200px] lg:min-w-[435px]"
                                    >
                                      <span className="relative z-[2] inline-flex items-center gap-2.5">
                                        <span className="relative mt-[-1px] whitespace-nowrap font-nunito font-bold text-[#2b3335] text-xl text-center transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:translate-x-[calc((27px+0.625rem)/2)]">
                                          Карточка предприятия
                                        </span>
                                        <span className="relative flex h-[27px] w-[27px] shrink-0 items-center justify-center transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0">
                                          <img
                                            className="h-[21px] w-[21px] object-contain pointer-events-none"
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
                  )}
                </div>
              </section>
              </div>
            )}
          </div>
        </FrameScreen>
      </div>
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
