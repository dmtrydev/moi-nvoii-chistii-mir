import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

function normalize(v: string): string {
  return String(v ?? '').trim();
}

type LabelState = { isOpen: boolean; hasSelection: boolean };

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
    const fmt = formatOptionLabel ?? ((x: string) => x);
    const labels = s.map(fmt);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} и ещё ${labels.length - 2}`;
  }, [selected, formatOptionLabel]);

  const hasSelection = Boolean(selectedLabel);

  const resolvedButtonClass =
    typeof buttonClassName === 'function' ? buttonClassName(isOpen) : (buttonClassName ?? '');

  const resolvedLabelClass =
    typeof labelClassName === 'function'
      ? labelClassName({ isOpen, hasSelection })
      : (labelClassName ?? (selectedLabel ? 'text-ink' : 'text-ink-muted'));

  const listScrollClass = dropdownListClassName ?? 'max-h-64 overflow-y-auto py-1';

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
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={resolvedLabelClass}>{selectedLabel || placeholder}</span>
        {chevronNode}
      </button>

      {isOpen && (
        <div
          className={
            dropdownPanelClassName ??
            `liquid-dropdown absolute z-40 mt-1 w-full overflow-hidden rounded-xl ${maxHeightClassName}`
          }
        >
          <div className={listScrollClass}>
            {normalizedOptions.map((opt, index) => {
              const checked = selectedSet.has(opt);
              const isLast = index === normalizedOptions.length - 1;
              const labelText = formatOptionLabel ? formatOptionLabel(opt) : opt;
              const defaultOptCls = [
                'block w-full px-3 py-2 text-left text-sm transition-colors',
                checked ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-app-bg',
              ].join(' ');
              const btnCls =
                optionButtonClassName?.({ option: opt, checked, index, isLast }) ?? defaultOptCls;
              const defaultBox = [
                'h-5 w-5 rounded-[4px] border flex items-center justify-center transition-colors',
                checked
                  ? 'bg-gradient-to-br from-accent-from to-accent-to border-transparent text-[#1a2e12]'
                  : 'bg-white border-black/15 text-transparent',
              ].join(' ');
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
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M4.2 10.6 8.2 14.6 16.2 6.6"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
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
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M4.2 10.6 8.2 14.6 16.2 6.6"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>{labelText}</span>
                  </span>
                </button>
              );
            })}
            {normalizedOptions.length === 0 && (
              <div className={emptyOptionsClassName ?? 'px-3 py-2 text-sm text-ink-muted'}>Нет вариантов</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
