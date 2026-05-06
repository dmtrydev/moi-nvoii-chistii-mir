import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

function normalize(v: string): string {
  return String(v ?? '').trim();
}

type LabelState = { isOpen: boolean; hasSelection: boolean };

const unifiedPanelClass =
  "absolute z-[100] top-full left-0 w-full mt-1 bg-[#fffffff2] rounded-[0px_0px_10px_10px] backdrop-blur-[40px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(40px)_brightness(100%)] overflow-hidden shadow-none pb-2.5";
const unifiedListClass = 'no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0';
const unifiedOptionClass = ({
  checked,
  isLast,
}: {
  option: string;
  checked: boolean;
  index: number;
  isLast: boolean;
}): string =>
  [
    'block w-full min-h-[60px] text-left font-nunito font-semibold text-lg border border-solid border-transparent [border-image:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)_1] transition-colors duration-150 backdrop-blur-[32px] [-webkit-backdrop-filter:blur(32px)_brightness(100%)]',
    checked ? 'bg-[#ffffffe8]' : 'hover:bg-[#ffffffd0]',
    isLast ? 'rounded-b-[10px]' : '',
  ].join(' ');

function UnifiedCheckbox({ checked }: { checked: boolean }): JSX.Element {
  if (checked) {
    return (
      <span className="relative block w-[35px] h-[35px]">
        <span className="absolute inset-0 rounded-[9px] border border-white/90 bg-[linear-gradient(128deg,rgba(219,236,168,0.96)_0%,rgba(188,220,87,0.98)_100%)] shadow-[0_3px_14px_rgba(163,200,59,0.55),inset_0_0_8px_rgba(255,255,255,0.55)]" />
        <svg className="absolute inset-0 w-full h-full p-[8px]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 12L9 17L20 6"
            stroke="#2b3335"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="relative block w-[35px] h-[35px]">
      <span className="absolute inset-0 bg-[#ffffffeb] rounded-[9px] backdrop-blur-[28px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(28px)_brightness(100%)] before:content-[''] before:absolute before:inset-0 before:p-px before:rounded-[9px] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:z-[1] before:pointer-events-none" />
    </span>
  );
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Выберите…',
  buttonClassName = '',
  maxHeightClassName = 'max-h-64',
  dropdownPanelClassName,
  dropdownListClassName,
  optionButtonClassName,
  optionLabelClassName,
  emptyOptionsClassName,
  hideChevron = false,
  renderChevron,
  checkboxClassName,
  labelClassName,
  optionIcon,
  renderCheckbox,
  triggerAlign = 'center',
  formatOptionLabel,
  /** Текст на кнопке при выборе (вместо склейки подписей опций). */
  formatSelectedLabel,
  inputValue,
  onInputValueChange,
  inputClassName,
  onInputEnter,
  filterOption,
  isLoadingOptions = false,
  loadingOptionsText = 'Загружаем варианты...',
  noOptionsText = 'Нет вариантов',
  lazyOptionsUntilInput = false,
  lazyOptionsHintText = 'Начните вводить код ФККО или наименование отхода',
  maxRenderedOptions = 120,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  buttonClassName?: string | ((isOpen: boolean) => string);
  maxHeightClassName?: string;
  /** Full class string for the open panel; default uses liquid-dropdown. */
  dropdownPanelClassName?: string;
  /** Scrollable list inside the panel (padding / max-height). */
  dropdownListClassName?: string;
  optionButtonClassName?: (args: {
    option: string;
    checked: boolean;
    index: number;
    isLast: boolean;
  }) => string;
  optionLabelClassName?: (args: { option: string; checked: boolean; index: number }) => string;
  emptyOptionsClassName?: string;
  hideChevron?: boolean;
  /** Если задан — рендерится справа в триггере вместо стандартной SVG-стрелки. */
  renderChevron?: (isOpen: boolean) => ReactNode;
  checkboxClassName?: (checked: boolean) => string;
  /** Строка или функция от состояния (открыто / есть выбор). */
  labelClassName?: string | ((state: LabelState) => string);
  /** Иконка слева от подписи опции (например «Вид обращения»). */
  optionIcon?: (option: string, index: number) => ReactNode;
  /** Кастомный чекбокс строки (макет «Вид обращения»). */
  renderCheckbox?: (checked: boolean) => ReactNode;
  /** `start` — подпись и шеврон с отступом сверху как в Figma. */
  triggerAlign?: 'center' | 'start';
  /** Подпись опции в списке и в кнопке (например ФККО: код + название группы). */
  formatOptionLabel?: (option: string) => string;
  formatSelectedLabel?: (selectedNormalized: string[]) => string;
  /** Если задано — триггер становится input (для ФККО: ввод + выбор). */
  inputValue?: string;
  onInputValueChange?: (next: string) => void;
  inputClassName?: string;
  onInputEnter?: () => void;
  filterOption?: (args: { option: string; query: string; label: string }) => boolean;
  isLoadingOptions?: boolean;
  loadingOptionsText?: string;
  noOptionsText?: string;
  /** В режиме input не рендерить весь список до ввода текста (для больших справочников). */
  lazyOptionsUntilInput?: boolean;
  /** Текст-заглушка, когда список скрыт до ввода. */
  lazyOptionsHintText?: string;
  /** Лимит одновременно отрисованных элементов списка для снижения лагов. */
  maxRenderedOptions?: number;
}): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const normalizedOptions = useMemo(() => {
    const cleaned = options.map(normalize).filter(Boolean);
    return [...new Set(cleaned)];
  }, [options]);

  const selectedSet = useMemo(() => new Set(selected.map(normalize).filter(Boolean)), [selected]);
  const selectedLabel = useMemo(() => {
    const s = selected.map(normalize).filter(Boolean);
    if (s.length === 0) return '';
    if (formatSelectedLabel) return formatSelectedLabel(s);
    const fmt = formatOptionLabel ?? ((x: string) => x);
    const labels = s.map(fmt);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} и ещё ${labels.length - 2}`;
  }, [selected, formatOptionLabel, formatSelectedLabel]);

  const hasSelection = Boolean(selectedLabel);

  const resolvedButtonClass =
    typeof buttonClassName === 'function' ? buttonClassName(isOpen) : (buttonClassName ?? '');

  const resolvedLabelClass =
    typeof labelClassName === 'function'
      ? labelClassName({ isOpen, hasSelection })
      : (labelClassName ?? (selectedLabel ? 'text-ink' : 'text-ink-muted'));

  const listScrollClass = dropdownListClassName ?? unifiedListClass;
  const normalizedInput = normalize(inputValue ?? '');
  const deferredInput = useDeferredValue(normalizedInput);
  const hasInputMode = typeof onInputValueChange === 'function';
  const optionLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of normalizedOptions) {
      map.set(opt, formatOptionLabel ? formatOptionLabel(opt) : opt);
    }
    return map;
  }, [normalizedOptions, formatOptionLabel]);
  const visibleOptions = useMemo(() => {
    if (hasInputMode && lazyOptionsUntilInput && !deferredInput) {
      return normalizedOptions.filter((opt) => selectedSet.has(opt));
    }
    if (!hasInputMode) return normalizedOptions;
    if (!deferredInput) return normalizedOptions.slice(0, maxRenderedOptions);
    const q = deferredInput.toLowerCase();
    const filtered = normalizedOptions.filter((opt) => {
      const label = optionLabelByCode.get(opt) ?? opt;
      if (filterOption) return filterOption({ option: opt, query: deferredInput, label });
      const labelLower = label.toLowerCase();
      return opt.toLowerCase().includes(q) || labelLower.includes(q);
    });
    /** Всегда показываем уже выбранные строки, даже если текущий запрос их отфильтровал бы (не нужно стирать поиск). */
    const optionSet = new Set(normalizedOptions);
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const raw of selected) {
      const opt = normalize(raw);
      if (!opt || seen.has(opt) || !optionSet.has(opt)) continue;
      merged.push(opt);
      seen.add(opt);
    }
    for (const opt of filtered) {
      if (!seen.has(opt)) {
        merged.push(opt);
        seen.add(opt);
      }
    }
    return merged.slice(0, maxRenderedOptions);
  }, [
    hasInputMode,
    lazyOptionsUntilInput,
    deferredInput,
    normalizedOptions,
    selected,
    selectedSet,
    optionLabelByCode,
    filterOption,
    maxRenderedOptions,
  ]);
  const showLazyHint = hasInputMode && lazyOptionsUntilInput && !deferredInput && visibleOptions.length === 0;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const node = rootRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const chevronNode = (() => {
    if (renderChevron) return renderChevron(isOpen);
    if (hideChevron) return null;
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden
      >
        <path
          d="M7 10l5 5 5-5"
          stroke="rgba(214,231,221,0.9)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  })();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={[
          resolvedButtonClass,
          'w-full text-left flex justify-between gap-2',
          triggerAlign === 'start' ? 'items-start' : 'items-center',
          hasInputMode ? 'hidden' : '',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={[resolvedLabelClass, 'min-w-0 flex-1 truncate'].join(' ')}>
          {selectedLabel || placeholder}
        </span>
        {chevronNode}
      </button>

      {hasInputMode && (
        <div
          className={[
            resolvedButtonClass,
            'w-full text-left flex justify-between gap-2',
            triggerAlign === 'start' ? 'items-start' : 'items-center',
          ].join(' ')}
          onClick={() => setIsOpen(true)}
        >
          <input
            value={inputValue ?? ''}
            onChange={(e) => onInputValueChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onInputEnter?.();
              }
            }}
            placeholder={selectedLabel || placeholder}
            className={inputClassName ?? 'min-w-0 flex-1 bg-transparent outline-none'}
          />
          {chevronNode}
        </div>
      )}

      {isOpen && (
        <div
          className={dropdownPanelClassName ?? `${unifiedPanelClass} ${maxHeightClassName}`}
        >
          <div className={listScrollClass}>
            {visibleOptions.map((opt, index) => {
              const checked = selectedSet.has(opt);
              const isLast = index === visibleOptions.length - 1;
              const labelText = formatOptionLabel ? formatOptionLabel(opt) : opt;
              const defaultOptCls = unifiedOptionClass({ option: opt, checked, index, isLast });
              const btnCls =
                optionButtonClassName?.({ option: opt, checked, index, isLast }) ?? defaultOptCls;
              const defaultBox = 'shrink-0';
              const boxCls = checkboxClassName?.(checked) ?? defaultBox;

              const labelCls =
                optionLabelClassName?.({ option: opt, checked, index }) ?? '';

              if (optionIcon) {
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (checked) {
                        onChange(selected.filter((x) => normalize(x) !== opt));
                      } else {
                        onChange([...selected, opt]);
                      }
                    }}
                    className={btnCls}
                    role="option"
                    aria-selected={checked}
                  >
                    <span className="inline-flex w-full min-h-[60px] items-center gap-3 pl-[15px] pr-2">
                      <span aria-hidden className={boxCls}>
                        <UnifiedCheckbox checked={checked} />
                      </span>
                      <span className={checked ? 'shrink-0 text-[#2b3335]' : 'shrink-0 text-[#828583]'}>
                        {optionIcon(opt, index)}
                      </span>
                      <span
                        className={[
                          'flex-1 font-nunito font-semibold text-lg text-left',
                          labelCls,
                          checked ? 'text-[#2b3335]' : 'text-[#828583]',
                        ].join(' ')}
                      >
                        {labelText}
                      </span>
                    </span>
                  </button>
                );
              }

              if (renderCheckbox) {
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (checked) {
                        onChange(selected.filter((x) => normalize(x) !== opt));
                      } else {
                        onChange([...selected, opt]);
                      }
                    }}
                    className={btnCls}
                    role="option"
                    aria-selected={checked}
                  >
                    <span className="inline-flex w-full min-h-[60px] items-center gap-3 px-[15px] py-3 text-left">
                      <span aria-hidden className="shrink-0">
                        {renderCheckbox(checked)}
                      </span>
                      <span
                        className={[
                          'flex-1 font-nunito font-semibold text-[#828583] text-lg leading-[normal] text-left',
                          labelCls,
                        ].join(' ')}
                      >
                        {labelText}
                      </span>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (checked) {
                      onChange(selected.filter((x) => normalize(x) !== opt));
                    } else {
                      onChange([...selected, opt]);
                    }
                  }}
                  className={btnCls}
                  role="option"
                  aria-selected={checked}
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className={boxCls}>
                        <UnifiedCheckbox checked={checked} />
                    </span>
                      <span className="font-nunito font-semibold text-lg text-[#828583]">{labelText}</span>
                  </span>
                </button>
              );
            })}
            {visibleOptions.length === 0 && (
              <div className={emptyOptionsClassName ?? 'px-[15px] py-3 text-sm font-nunito font-semibold text-[#828583]'}>
                {showLazyHint ? lazyOptionsHintText : isLoadingOptions ? loadingOptionsText : noOptionsText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
