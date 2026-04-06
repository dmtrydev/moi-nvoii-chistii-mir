import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { formatFkkoHuman } from '@/utils/fkko';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
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
          {!hasSearched && <HeroCopySection />}
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
            compactAfterSearch={hasSearched}
          />

          <div className="relative mx-auto w-full min-w-0 max-w-[min(1880px,100%)] px-4 sm:px-6 md:px-8 lg:px-[min(50px,3.5vw)] pb-12 sm:pb-16">
            {validationError && (
              <div className="mt-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                {validationError}
              </div>
            )}

            {hasSearched && (
              <section className="relative mt-6 rounded-[32.5px] bg-[#ffffff4c] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
                {/* Header */}
                <div className="relative z-[2] flex flex-wrap items-center justify-between gap-4 px-6 pt-7 pb-4 sm:px-8 lg:px-9">
                  <h3 className="bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text font-display font-bold text-[28px] text-transparent leading-[35.2px] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] sm:text-[32px]">
                    Подходящие предприятия:
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate(toMapPath())}
                    className="relative inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[20px] bg-[#ffffff73] px-5 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-colors hover:bg-[#ffffffa6] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]"
                  >
                    <span className="font-nunito font-semibold text-[#2b3335] text-base">Все на карте</span>
                    <svg className="h-[21px] w-[21px] text-[#2b3335]" viewBox="0 0 21 21" fill="none" aria-hidden>
                      <path d="M3.5 7.875L10.5 3.5L17.5 7.875V15.75L10.5 19.25L3.5 15.75V7.875Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.5 11.375V19.25" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M17.5 7.875L10.5 11.375L3.5 7.875" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="relative z-[2] px-6 pb-7 sm:px-8 lg:px-9">
                  {isSearching && <p className="py-8 text-center font-nunito font-semibold text-[#5e6567] text-lg">Идёт поиск…</p>}
                  {!isSearching && searchError && <p className="py-8 text-center font-nunito font-semibold text-red-600 text-lg">{searchError}</p>}
                  {!isSearching && !searchError && items.length === 0 && (
                    <p className="py-8 text-center font-nunito font-semibold text-[#5e6567] text-lg">По этим фильтрам ничего не найдено.</p>
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
                        const detailsPath = typeof item.id === 'number' ? `/enterprise/${item.id}` : '/map';

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
                                  <span><span className="font-bold">ИНН:</span> {item.inn || 'не указан'}</span>
                                  {item.address && (
                                    <>
                                      <span>|</span>
                                      <span>{item.address}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <EnterpriseActivityStrip activityTypes={item.activityTypes} variant="light" size="md" />

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

                                  <div className="ml-auto flex items-center gap-4">
                                    <Link
                                      to={toMapPath()}
                                      className="home-find-button relative inline-flex h-[60px] items-center justify-center gap-2.5 rounded-[20px] px-8 font-nunito font-bold text-[#2b3335] text-xl before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:min-w-[200px] lg:min-w-[435px]"
                                    >
                                      На карте
                                      <svg className="h-5 w-5 -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </Link>
                                    <Link
                                      to={detailsPath}
                                      className="home-find-button relative inline-flex h-[60px] items-center justify-center gap-2.5 rounded-[20px] px-8 font-nunito font-bold text-[#2b3335] text-xl before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:min-w-[200px] lg:min-w-[435px]"
                                    >
                                      Карточка предприятия
                                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                        <path d="M7 17L17 7M17 7H7M17 7v10" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
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
            )}
          </div>
        </FrameScreen>
      </div>
    </section>
  );
}
