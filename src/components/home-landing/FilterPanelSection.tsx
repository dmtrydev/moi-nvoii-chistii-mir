import { useEffect, useMemo, useRef, useState } from 'react';
import filterSearchIcon from '@/assets/home-landing/filter-search-icon.svg';
import filterResetIcon from '@/assets/home-landing/filter-reset-icon.svg';
import filterSectionTitleIcon from '@/assets/home-landing/filter-section-title-icon.svg';
import vidChevronClosed from '@/assets/home-landing/vid-chevron-closed.svg';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import {
  VidMenuCheckboxChecked,
  VidMenuCheckboxCheckedSm,
  VidMenuCheckboxUnchecked,
  VidMenuCheckboxUncheckedSm,
} from '@/components/home-landing/VidMenuCheckbox';
import {
  buildFkkoSearchIndex,
  formatFkkoHuman,
  formatFkkoSelectionSummary,
  matchesFkkoSearch,
  normalizeFkkoDigits,
  normalizeFkkoSearchQuery,
} from '@/utils/fkko';

const POLY_IMG =
  "data:image/svg+xml,%3Csvg width='12' height='10' viewBox='0 0 12 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 10L0 0H12L6 10Z' fill='%23828583'/%3E%3C/svg%3E";

/** Hover-анимации «Найти» / «Сбросить» — одна длительность, плавнее чем 300ms */
const filterCtaDurationClass = 'duration-[600ms]';

/** Сдвиг подписи вправо при hover: (gap-2.5 + 21px) / 2 — центр текста совпадает с центром кнопки, когда иконка уезжает */
const filterCtaLabelShiftClass = [
  'transition-transform',
  filterCtaDurationClass,
  'ease-[cubic-bezier(0.22,1,0.36,1)]',
  'motion-reduce:transition-none',
  'motion-reduce:group-hover:translate-x-0',
  'group-hover:translate-x-[calc((21px+0.625rem)/2)]',
].join(' ');

/** Общие стили кнопки «Сбросить фильтры» (видимость и ширина задаются отдельно). */
const filterResetButtonBase = [
  'group relative z-[2] flex h-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer bg-[#ffffff73] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]',
  `transition-[background-color,box-shadow] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:shadow-[inset_0px_0px_32.4px_#ffffffd6] active:bg-[#ffffffa6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2`,
  "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]",
].join(' ');

/** Выпадающие списки фильтра: вниз от поля (ФККО, вид обращения, регион). */
const glassDropdownPanelDown =
  'absolute z-[100] top-full left-0 w-full mt-1 bg-[#fffffff2] rounded-[0px_0px_10px_10px] backdrop-blur-[40px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(40px)_brightness(100%)] overflow-hidden shadow-none pb-2.5';

const vidTriggerBase =
  'relative z-[2] w-full h-[60px] px-[15px] text-left flex items-center justify-between transition-[background-color,box-shadow,backdrop-filter,border-color,border-radius] duration-200 ease-out';

function vidTriggerClass(isOpen: boolean): string {
  if (isOpen) {
    return [
      vidTriggerBase,
      /* Список снизу — скругления сверху у триггера, стык с панелью */
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
    'font-nunito font-semibold text-lg',
    isOpen || hasSelection ? 'text-[#2b3335]' : 'text-[#828583]',
  ].join(' ');

function fkkoOptionLabel(code: string, titles?: Record<string, string>): string {
  const key = normalizeFkkoDigits(code);
  const title = key.length === 11 ? titles?.[key] : undefined;
  const human = formatFkkoHuman(code);
  return title ? `${human} — ${title}` : human;
}

export interface FilterPanelSectionProps {
  /** Выбранные коды ФККО (11 цифр каждый). */
  filterFkko: string[];
  onFilterFkkoChange: (v: string[]) => void;
  /** Каталог кодов для списка (11 цифр). */
  fkkoOptions: string[];
  filterVid: string[];
  onFilterVidChange: (v: string[]) => void;
  activityTypeOptions: string[];
  filterRegion: string;
  onFilterRegionChange: (v: string) => void;
  groroOnly: boolean;
  onGroroOnlyChange: (v: boolean) => void;
  regionOptions: string[];
  onSearch: () => void;
  onReset: () => void;
  /** После «Найти»: меньше верхний отступ, панель ближе к шапке (герой скрыт). */
  compactAfterSearch?: boolean;
  /** Верхний margin в компактном режиме (напр. mt-6 или компенсация под translateY). */
  compactMarginTopClass?: string;
  /** Наименование вида отходов по коду (например с rpn.gov.ru/fkko), ключ — 11 цифр. */
  fkkoTitleByCode?: Record<string, string>;
  /** База URL API (как getApiUrl на главной) — для догрузки названий по вводу в поле ФККО. */
  resolveFkkoTitlesApi?: (path: string) => string;
  /** Добавить полученные с API названия к общему словарю. */
  onFkkoTitlesMerge?: (partial: Record<string, string>) => void;
}

export function FilterPanelSection({
  filterFkko,
  onFilterFkkoChange,
  fkkoOptions,
  filterVid,
  onFilterVidChange,
  activityTypeOptions,
  filterRegion,
  onFilterRegionChange,
  groroOnly,
  onGroroOnlyChange,
  regionOptions,
  onSearch,
  onReset,
  compactAfterSearch = false,
  compactMarginTopClass,
  fkkoTitleByCode,
  resolveFkkoTitlesApi,
  onFkkoTitlesMerge,
}: FilterPanelSectionProps): JSX.Element {
  const [fkkoInput, setFkkoInput] = useState('');
  const [isFkkoTitlesLoading, setIsFkkoTitlesLoading] = useState(false);
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  /** Коды, для которых API уже ответил без названия — не долбим РПН в цикле. */
  const fkkoTitleMissRef = useRef<Set<string>>(new Set());
  /** Коды, которые уже запрашиваются прямо сейчас (защита от дублей). */
  const fkkoTitlePendingRef = useRef<Set<string>>(new Set());

  const fkkoSearchIndexByCode = useMemo(() => {
    const map: Record<string, { codeDigits: string; labelNormalized: string }> = {};
    for (const code of fkkoOptions) {
      const digits = normalizeFkkoDigits(code);
      if (digits.length !== 11) continue;
      map[digits] = buildFkkoSearchIndex(digits, fkkoOptionLabel(code, fkkoTitleByCode));
    }
    return map;
  }, [fkkoOptions, fkkoTitleByCode]);

  useEffect(() => {
    if (!resolveFkkoTitlesApi || !onFkkoTitlesMerge) return;

    const titlesMap = fkkoTitleByCode ?? {};

    const query = normalizeFkkoSearchQuery(fkkoInput);
    const selectedNeed = filterFkko
      .map((c) => normalizeFkkoDigits(c))
      .filter(
        (k) =>
          k.length === 11 &&
          !titlesMap[k] &&
          !fkkoTitleMissRef.current.has(k) &&
          !fkkoTitlePendingRef.current.has(k),
      );

    let fromFilter: string[] = [];
    if (query.length >= 3) {
      fromFilter = fkkoOptions
        .map((opt) => normalizeFkkoDigits(opt))
        .filter((k) => {
          if (k.length !== 11) return false;
          const idx = fkkoSearchIndexByCode[k];
          if (!idx) return false;
          return matchesFkkoSearch(idx, query);
        })
        .slice(0, 180)
        .filter(
          (k) =>
            k.length === 11 &&
            !titlesMap[k] &&
            !fkkoTitleMissRef.current.has(k) &&
            !fkkoTitlePendingRef.current.has(k),
        );
    }

    const need = [...new Set([...selectedNeed, ...fromFilter])].slice(0, 100);
    if (need.length === 0) return;

    const t = window.setTimeout(() => {
      setIsFkkoTitlesLoading(true);
      for (const k of need) fkkoTitlePendingRef.current.add(k);
      void fetch(resolveFkkoTitlesApi('/api/fkko/titles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: need }),
      })
        .then((r) => (r.ok ? r.json() : {}))
        .then((data: { titles?: unknown }) => {
          const raw = data.titles;
          if (!raw || typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            for (const k of need) fkkoTitleMissRef.current.add(k);
            return;
          }
          const partial = raw as Record<string, string>;
          if (Object.keys(partial).length > 0) {
            onFkkoTitlesMerge(partial);
          }
          for (const k of need) {
            if (!partial[k]) fkkoTitleMissRef.current.add(k);
          }
        })
        .catch(() => {
          for (const k of need) fkkoTitleMissRef.current.add(k);
        })
        .finally(() => {
          for (const k of need) fkkoTitlePendingRef.current.delete(k);
          setIsFkkoTitlesLoading(false);
        });
    }, 280);

    return () => clearTimeout(t);
  }, [
    fkkoInput,
    fkkoOptions,
    filterFkko,
    fkkoTitleByCode,
    fkkoSearchIndexByCode,
    resolveFkkoTitlesApi,
    onFkkoTitlesMerge,
  ]);
  /** z-[1]: выпадающие списки выше блока «Подходящие предприятия» (ниже шапки z-[2]) */
  const sectionShellTransition =
    'transition-[margin,padding] duration-[1000ms] ease-[cubic-bezier(0.14,0.9,0.22,1)] motion-reduce:transition-none';
  const compactTopMargin =
    compactMarginTopClass ?? 'mt-6';
  const sectionShellClass = [
    sectionShellTransition,
    compactAfterSearch
      ? `relative z-[1] mx-auto ${compactTopMargin} w-full max-w-[1920px] overflow-visible px-4 pb-6`
      : 'relative z-[1] mx-auto mt-8 w-full max-w-[1920px] overflow-visible px-4 pb-8 sm:mt-10 md:mt-12 lg:mt-[clamp(2.5rem,6vw,8rem)]',
  ].join(' ');
  const handleFkkoInput = (next: string): void => {
    setFkkoInput(String(next).slice(0, 120));
  };

  /** После отметки в списке убираем текст поиска — в поле остаётся счётчик выбранных (formatFkkoSelectionSummary). */
  const handleFkkoSelectionChange = (next: string[]): void => {
    setFkkoInput('');
    onFilterFkkoChange(next);
  };

  const filterFkkoOption = ({
    option,
    query,
    label,
  }: {
    option: string;
    query: string;
    label: string;
  }): boolean => {
    const digits = normalizeFkkoDigits(option);
    const idx = fkkoSearchIndexByCode[digits] ?? buildFkkoSearchIndex(option, label);
    return matchesFkkoSearch(idx, query);
  };

  return (
    <section className={sectionShellClass}>
      <div className="relative overflow-visible rounded-[32.5px] border-[none] bg-[#ffffff4c] p-5 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-6 md:p-7 lg:p-8 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
        {/* Заголовок + сброс */}
        <div className="relative z-[2] mb-6 flex min-w-0 flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex max-w-full items-start gap-3 sm:items-center sm:gap-[15px]">
              <div className="relative mt-0.5 h-8 w-8 shrink-0 sm:mt-0 sm:h-[35px] sm:w-[35px]">
                <img
                  className="absolute left-[16.66%] top-[12.50%] h-[87.50%] w-[83.34%]"
                  alt=""
                  src={filterSectionTitleIcon}
                />
              </div>
              <h2 className="typo-h4 relative mt-[-1px] min-w-0 flex-1 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-left text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] tracking-[0] leading-tight sm:whitespace-nowrap">
                Экологический фильтр объектов
              </h2>
            </div>
            <p className="relative mt-2 max-w-[min(726px,100%)] font-nunito font-semibold text-[#5e6567] text-[clamp(0.9375rem,1.8vw,1.125rem)] leading-normal tracking-[0]">
              Задайте параметры и находите объекты, площадки и маршруты в вашем регионе
            </p>
          </div>

          <button
            type="button"
            className={`hidden lg:flex ${filterResetButtonBase} lg:h-[52px] lg:w-[237px]`}
            onClick={onReset}
          >
            <span className="relative z-[2] inline-flex items-center gap-2.5">
              <span
                className={`relative mt-[-1px] whitespace-nowrap font-nunito font-semibold text-[#2b3335] text-base text-center tracking-[0] leading-[normal] ${filterCtaLabelShiftClass}`}
              >
                Сбросить фильтры
              </span>
              <span
                className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}
              >
                <img
                  className="h-[21px] w-[21px] object-contain pointer-events-none"
                  alt=""
                  src={filterResetIcon}
                />
              </span>
            </span>
          </button>
        </div>

        <div className="relative z-[2] grid grid-cols-1 gap-4 overflow-visible md:grid-cols-2 xl:grid-cols-4">
      {/* FKKO */}
      <div className="relative z-[11] min-h-[60px] w-full">
        <div className="relative h-full min-h-[60px] w-full">
          <MultiSelectDropdown
            options={fkkoOptions}
            selected={filterFkko}
            onChange={handleFkkoSelectionChange}
            placeholder="Выберите коды ФККО"
            buttonClassName={vidTriggerClass}
            labelClassName={vidLabelClass}
            formatOptionLabel={(code) => fkkoOptionLabel(code, fkkoTitleByCode)}
            formatSelectedLabel={formatFkkoSelectionSummary}
            inputValue={fkkoInput}
            onInputValueChange={handleFkkoInput}
            filterOption={filterFkkoOption}
            isLoadingOptions={isFkkoTitlesLoading}
            loadingOptionsText="Загружаем названия..."
            noOptionsText="Совпадений не найдено"
            lazyOptionsUntilInput
            lazyOptionsHintText="Начните вводить код ФККО или наименование отхода"
            maxRenderedOptions={80}
            inputClassName="min-w-0 flex-1 bg-transparent font-nunito font-semibold text-lg text-[#2b3335] placeholder:text-[#828583] outline-none"
            renderChevron={(open) => (
              <img
                className={`pointer-events-none h-2.5 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                alt=""
                src={vidChevronClosed}
              />
            )}
            renderCheckbox={(checked) =>
              checked ? <VidMenuCheckboxChecked /> : <VidMenuCheckboxUnchecked />
            }
            dropdownPanelClassName={glassDropdownPanelDown}
            dropdownListClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
            maxHeightClassName="max-h-64"
          />
        </div>
      </div>

      {/* Вид обращения */}
      <div className="relative z-[9] min-h-[60px] w-full">
        <div className="relative h-full min-h-[60px] w-full">
          <MultiSelectDropdown
            options={activityTypeOptions}
            selected={filterVid}
            onChange={onFilterVidChange}
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
            renderCheckbox={(checked) =>
              checked ? <VidMenuCheckboxChecked /> : <VidMenuCheckboxUnchecked />
            }
            dropdownPanelClassName={glassDropdownPanelDown}
            dropdownListClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
            maxHeightClassName="max-h-64"
          />
        </div>
      </div>

      {/* Регион */}
      <div className="relative z-[8] min-h-[60px] w-full">
        <AutocompleteInput
          value={filterRegion}
          onChange={onFilterRegionChange}
          options={regionOptions}
          placeholder="Регион (необязательно)"
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

      {/* Search */}
      <div className="relative z-[7] flex min-h-[60px] w-full">
        <button
          type="button"
          className="group relative home-find-button flex h-[60px] w-full min-w-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2"
          onClick={() => onSearch()}
        >
          <span className="relative z-[2] inline-flex items-center gap-2.5">
            <span
              className={`relative mt-[-1px] whitespace-nowrap font-nunito font-semibold text-[#2b3335] text-xl text-center tracking-[0] leading-[normal] ${filterCtaLabelShiftClass}`}
            >
              Найти
            </span>
            <span
              className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}
            >
              <img
                className="h-[21px] w-[21px] object-contain pointer-events-none"
                alt=""
                src={filterSearchIcon}
              />
            </span>
          </span>
        </button>
      </div>

      <div className="relative z-[7] col-span-1 min-h-[60px] w-full md:col-span-2 xl:col-span-4">
        <label className="relative z-[2] inline-flex min-h-[52px] w-full items-center gap-3 rounded-[20px] bg-[#ffffff73] px-4 py-2 font-nunito text-base font-semibold text-[#2b3335] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
          <input
            type="checkbox"
            className="sr-only"
            checked={groroOnly}
            onChange={(e) => onGroroOnlyChange(e.target.checked)}
          />
          <span className="relative z-[2] inline-flex shrink-0">
            {groroOnly ? <VidMenuCheckboxCheckedSm /> : <VidMenuCheckboxUncheckedSm />}
          </span>
          <span className="relative z-[2]">Только объекты размещения из ГРОРО</span>
        </label>
      </div>

      {/* Сброс под «Найти» — мобильные и планшеты; на lg+ кнопка в шапке секции */}
      <div className="relative z-[6] col-span-1 min-h-0 w-full md:col-span-2 xl:col-span-4 lg:hidden">
        <button type="button" className={`${filterResetButtonBase} w-full`} onClick={onReset}>
          <span className="relative z-[2] inline-flex items-center gap-2.5">
            <span
              className={`relative mt-[-1px] whitespace-nowrap font-nunito font-semibold text-[#2b3335] text-base text-center tracking-[0] leading-[normal] ${filterCtaLabelShiftClass}`}
            >
              Сбросить фильтры
            </span>
            <span
              className={`relative flex h-[21px] w-[21px] shrink-0 items-center justify-center transition-[transform,opacity] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-8 group-hover:opacity-0`}
            >
              <img
                className="h-[21px] w-[21px] object-contain pointer-events-none"
                alt=""
                src={filterResetIcon}
              />
            </span>
          </span>
        </button>
      </div>
        </div>
      </div>
    </section>
  );
}
