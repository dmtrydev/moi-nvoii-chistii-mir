import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface AutocompleteOption {
  value: string;
  label: string;
  searchText?: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (next: string) => void;
  options: Array<string | AutocompleteOption>;
  placeholder?: string;
  inputClassName?: string | ((isOpen: boolean) => string);
  maxItems?: number;
  noResultsText?: string;
  /** Replaces default liquid-dropdown panel classes when set. */
  dropdownClassName?: string;
  listClassName?: string;
  optionClassName?: (args: { index: number; highlighted: boolean }) => string;
  emptyClassName?: string;
  /** Called when open state changes (for external styling). */
  onOpenChange?: (isOpen: boolean) => void;
  /** Extra content rendered inside the trigger shell (e.g. chevron icon). */
  children?: ReactNode;
  /**
   * Visual shell around the input. When set, input + children are wrapped in
   * a styled div (like MultiSelectDropdown's trigger button) and the dropdown
   * panel becomes a sibling — this avoids nested backdrop-filter issues.
   */
  triggerClassName?: string | ((isOpen: boolean) => string);
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder = '',
  inputClassName = '',
  maxItems = 8,
  noResultsText = 'Ничего не найдено',
  dropdownClassName,
  listClassName,
  optionClassName,
  emptyClassName,
  onOpenChange,
  children,
  triggerClassName,
}: AutocompleteInputProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpenRaw] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = useCallback((next: boolean) => {
    setIsOpenRaw(next);
    onOpenChangeRef.current?.(next);
  }, []);

  const normalizedOptions = useMemo((): AutocompleteOption[] => {
    const raw = options.map((opt) =>
      typeof opt === 'string'
        ? { value: opt.trim(), label: opt.trim(), searchText: opt.trim().toLowerCase() }
        : {
            value: String(opt.value ?? '').trim(),
            label: String(opt.label ?? '').trim(),
            searchText: String(opt.searchText ?? `${opt.label} ${opt.value}`).toLowerCase(),
          },
    );
    const filtered = raw.filter((opt) => opt.value && opt.label);
    const byValue = new Map<string, AutocompleteOption>();
    filtered.forEach((opt) => {
      if (!byValue.has(opt.value)) byValue.set(opt.value, opt);
    });
    return [...byValue.values()];
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const matched = q
      ? normalizedOptions.filter((opt) => opt.searchText?.includes(q) || opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q))
      : normalizedOptions;
    return matched.slice(0, maxItems);
  }, [normalizedOptions, value, maxItems]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const node = rootRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [setOpen]);

  const choose = (nextValue: string): void => {
    onChange(nextValue);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const panelClass =
    dropdownClassName ??
    "absolute z-[100] top-full left-0 w-full mt-1 bg-[#ffffff73] rounded-[0px_0px_10px_10px] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] overflow-hidden shadow-none pb-2.5";
  const ulClass = listClassName ?? 'no-scrollbar max-h-[min(320px,50vh)] overflow-y-auto py-0';

  const resolvedInputClass = typeof inputClassName === 'function' ? inputClassName(isOpen) : inputClassName;
  const resolvedTriggerClass = typeof triggerClassName === 'function' ? triggerClassName(isOpen) : triggerClassName;

  const inputEl = (
    <input
      type="text"
      value={value}
      onFocus={() => setOpen(true)}
      onChange={(e) => {
        onChange(e.target.value);
        setOpen(true);
        setHighlightedIndex(0);
      }}
      onKeyDown={(e) => {
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          setOpen(true);
          return;
        }
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev + 1;
            return next >= filteredOptions.length ? 0 : next;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? Math.max(filteredOptions.length - 1, 0) : next;
          });
        } else if (e.key === 'Enter' && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          e.preventDefault();
          choose(filteredOptions[highlightedIndex].value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
        }
      }}
      placeholder={placeholder}
      className={resolvedInputClass}
    />
  );

  const dropdownEl = isOpen && (
    <div className={panelClass}>
      {filteredOptions.length > 0 ? (
        <ul className={ulClass}>
          {filteredOptions.map((option, idx) => {
            const highlighted = idx === highlightedIndex;
            const optCls =
              optionClassName?.({ index: idx, highlighted }) ??
              `block w-full min-h-[60px] px-[15px] py-3 text-left font-nunito font-semibold text-[#828583] text-lg border border-solid border-transparent [border-image:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)_1] transition-colors duration-150 ${
                highlighted ? 'bg-[#ffffff99]' : 'hover:bg-[#ffffff99]'
              }`;
            return (
              <li key={`${option.value}-${idx}`}>
                <button type="button" onClick={() => choose(option.value)} className={optCls}>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={emptyClassName ?? 'px-[15px] py-3 text-sm font-nunito font-semibold text-[#828583]'}>{noResultsText}</div>
      )}
    </div>
  );

  if (resolvedTriggerClass) {
    return (
      <div ref={rootRef} className="relative">
        <div className={resolvedTriggerClass}>
          {inputEl}
          {children}
        </div>
        {dropdownEl}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {inputEl}
      {dropdownEl}
      {children}
    </div>
  );
}
