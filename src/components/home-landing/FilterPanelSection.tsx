import { useState } from 'react';
import filterSearchIcon from '@/assets/home-landing/filter-search-icon.svg';
import filterResetIcon from '@/assets/home-landing/filter-reset-icon.svg';
import filterSectionTitleIcon from '@/assets/home-landing/filter-section-title-icon.svg';
import vidChevronClosed from '@/assets/home-landing/vid-chevron-closed.svg';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { VidMenuCheckboxChecked, VidMenuCheckboxUnchecked } from '@/components/home-landing/VidMenuCheckbox';
import { formatFkkoHuman, formatFkkoSelectionSummary, normalizeFkkoDigits } from '@/utils/fkko';
import { getFkkoGroupName } from '@/constants/fkko';

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

/** Прозрачный фон — «пластина» задаётся оболочкой (белая статика / стекло при hover и focus). */
const filterInputBase =
  'box-border w-full h-[60px] rounded-[10px] border-0 bg-transparent px-[15px] py-[18px] font-nunito font-semibold text-[#828583] text-lg placeholder:text-[#828583] focus:ring-0 focus:outline-none';

/** Статика: как белый бар с тенью; hover / focus-within: стекло как в макете Property. */
const filterFieldShell =
  'relative w-full h-full rounded-[10px] border border-black/[0.06] bg-white shadow-sm transition-[background-color,box-shadow,backdrop-filter,border-color] duration-200 ease-out hover:border-transparent hover:bg-[#ffffff73] hover:backdrop-blur-[10px] hover:shadow-none hover:[-webkit-backdrop-filter:blur(10px)_brightness(100%)] focus-within:border-transparent focus-within:bg-[#ffffffa6] focus-within:backdrop-blur-[10px] focus-within:shadow-none focus-within:[-webkit-backdrop-filter:blur(10px)_brightness(100%)]';

/** Оболочка без собственного scroll — прокрутка только у внутреннего списка (полоса скрыта, no-scrollbar), иначе двойной скролл. */
/** Выпадающие списки фильтра: вниз от поля (ФККО, вид обращения, регион). */
const glassDropdownPanelDown =
  'absolute z-[100] top-full left-0 w-full mt-1 bg-[#ffffff73] rounded-[0px_0px_10px_10px] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] overflow-hidden shadow-none pb-2.5';

const fkkoOptionCls = ({ highlighted }: { index: number; highlighted: boolean }): string =>
  [
    'block w-full min-h-[60px] px-[15px] py-3 text-left font-nunito font-semibold text-[#828583] text-lg border border-solid border-transparent [border-image:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)_1] transition-colors duration-150',
    highlighted ? 'bg-[#ffffff99]' : 'hover:bg-[#ffffff99]',
  ].join(' ');

/** Как строки ФККО/региона (fkkoOptionCls) + отметка multiselect через чекбокс. */
const vidOptionCls = ({
  checked,
  isLast,
}: {
  option: string;
  checked: boolean;
  index: number;
  isLast: boolean;
}): string =>
  [
    'block w-full min-h-[60px] text-left font-nunito font-semibold text-[#828583] text-lg border border-solid border-transparent [border-image:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)_1] transition-colors duration-150',
    checked ? 'bg-[#ffffff99]' : 'hover:bg-[#ffffff99]',
    isLast ? 'rounded-b-[10px]' : '',
  ].join(' ');

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
  const title = key && titles?.[key];
  return `${formatFkkoHuman(code)} — ${title ?? getFkkoGroupName(code)}`;
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
  regionOptions: string[];
  onSearch: () => void;
  onReset: () => void;
  /** После «Найти»: меньше верхний отступ, панель ближе к шапке (герой скрыт). */
  compactAfterSearch?: boolean;
  /** Верхний margin в компактном режиме (напр. mt-6 или компенсация под translateY). */
  compactMarginTopClass?: string;
  /** Наименование вида отходов по коду (например с rpn.gov.ru/fkko), ключ — 11 цифр. */
  fkkoTitleByCode?: Record<string, string>;
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
  regionOptions,
  onSearch,
  onReset,
  compactAfterSearch = false,
  compactMarginTopClass,
  fkkoTitleByCode,
}: FilterPanelSectionProps): JSX.Element {
  const [fkkoInput, setFkkoInput] = useState('');
  /** z-[1]: выпадающие списки выше блока «Подходящие предприятия» (ниже шапки z-[2]) */
  const sectionShellTransition =
    'transition-[margin,padding] duration-[1000ms] ease-[cubic-bezier(0.14,0.9,0.22,1)] motion-reduce:transition-none';
  const compactTopMargin =
    compactMarginTopClass ?? 'mt-6';
  const sectionShellClass = [
    sectionShellTransition,
    compactAfterSearch
      ? `relative z-[1] mx-auto ${compactTopMargin} w-full max-w-[min(1880px,100%)] overflow-visible px-4 pb-6 sm:px-6 md:px-8 lg:px-[min(50px,3.5vw)]`
      : 'relative z-[1] mx-auto mt-8 w-full max-w-[min(1880px,100%)] overflow-visible px-4 pb-8 sm:mt-10 sm:px-6 md:mt-12 md:px-8 lg:mt-[clamp(2.5rem,6vw,8rem)] lg:px-[min(50px,3.5vw)]',
  ].join(' ');
  const handleFkkoInput = (next: string): void => {
    const onlyDigits = String(next).replace(/\D/g, '').slice(0, 11);
    setFkkoInput(onlyDigits);
  };

  const submitTypedFkko = (): void => {
    const code = fkkoInput.trim();
    if (!code) return;
    if (code.length !== 11) return;
    if (filterFkko.includes(code)) {
      setFkkoInput('');
      return;
    }
    onFilterFkkoChange([...filterFkko, code]);
    setFkkoInput('');
  };

  return (
    <section className={sectionShellClass}>
      <div className="relative overflow-visible rounded-[32.5px] border-[none] bg-[#ffffff4c] p-5 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-6 md:p-7 lg:p-8 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
        {/* Заголовок + сброс */}
        <div className="relative z-[2] mb-6 flex min-w-0 flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full flex-wrap items-center gap-3 sm:gap-[15px]">
              <div className="relative h-8 w-8 shrink-0 sm:h-[35px] sm:w-[35px]">
                <img
                  className="absolute left-[16.66%] top-[12.50%] h-[87.50%] w-[83.34%]"
                  alt=""
                  src={filterSectionTitleIcon}
                />
              </div>
              <div className="relative mt-[-1px] max-w-full bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text font-display font-bold text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] text-[clamp(1.125rem,2.8vw,2rem)] leading-tight tracking-[0] sm:whitespace-nowrap">
                Фильтр объектов по экологии
              </div>
            </div>
            <p className="relative mt-2 max-w-[min(726px,100%)] font-nunito font-semibold text-[#5e6567] text-[clamp(0.9375rem,1.8vw,1.125rem)] leading-normal tracking-[0]">
              Настройте параметры и смотрите объекты, площадки и маршруты в вашем регионе
            </p>
          </div>

          <button
            type="button"
            className={`group relative z-[2] flex h-[52px] w-full shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer bg-[#ffffff73] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] transition-[background-color,box-shadow] ${filterCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:shadow-[inset_0px_0px_32.4px_#ffffffd6] active:bg-[#ffffffa6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:max-w-md sm:self-start lg:h-[52px] lg:w-[237px] lg:max-w-none`}
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
      <div className="relative z-10 min-h-[60px] w-full">
        <div className="relative h-full min-h-[60px] w-full">
          <MultiSelectDropdown
            options={fkkoOptions}
            selected={filterFkko}
            onChange={onFilterFkkoChange}
            placeholder="ФККО"
            buttonClassName={vidTriggerClass}
            labelClassName={vidLabelClass}
            formatOptionLabel={(code) => fkkoOptionLabel(code, fkkoTitleByCode)}
            formatSelectedLabel={formatFkkoSelectionSummary}
            inputValue={fkkoInput}
            onInputValueChange={handleFkkoInput}
            onInputEnter={submitTypedFkko}
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
            optionButtonClassName={vidOptionCls}
            maxHeightClassName=""
            emptyOptionsClassName="px-[15px] py-3 text-sm font-nunito font-semibold text-[#828583]"
          />
        </div>
      </div>

      {/* Вид обращения */}
      <div className="relative z-10 min-h-[60px] w-full">
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
            optionButtonClassName={vidOptionCls}
            maxHeightClassName=""
          />
        </div>
      </div>

      {/* Регион */}
      <div className="relative z-10 min-h-[60px] w-full">
        <div className={`group/region ${filterFieldShell}`}>
          <AutocompleteInput
            value={filterRegion}
            onChange={onFilterRegionChange}
            options={regionOptions}
            placeholder="Регион (необязательно)"
            inputClassName={`relative z-[2] ${filterInputBase}`}
            maxItems={10}
            noResultsText="Начните вводить"
            dropdownClassName={glassDropdownPanelDown}
            listClassName="no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0"
            optionClassName={fkkoOptionCls}
            emptyClassName="px-[15px] py-3 text-sm font-nunito font-semibold text-[#828583]"
          />
          <img
            className="pointer-events-none absolute right-[15px] top-1/2 z-[3] w-3 -translate-y-1/2 transition-transform duration-200 group-focus-within/region:rotate-180"
            alt=""
            src={POLY_IMG}
          />
        </div>
      </div>

      {/* Search — при hover иконка вправо + подпись вправо на (gap+иконка)/2, чтобы текст оказался по центру кнопки */}
      <div className="relative z-10 flex min-h-[60px] w-full">
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
        </div>
      </div>
    </section>
  );
}
