import { useEffect, useMemo, useRef, useState } from 'react';

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
  inputClassName?: string;
  maxItems?: number;
  noResultsText?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder = '',
  inputClassName = '',
  maxItems = 8,
  noResultsText = 'Ничего не найдено',
}: AutocompleteInputProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

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
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  const choose = (nextValue: string): void => {
    onChange(nextValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setIsOpen(true);
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
            setIsOpen(false);
            setHighlightedIndex(-1);
          }
        }}
        placeholder={placeholder}
        className={inputClassName}
      />

      {isOpen && (
        <div className="liquid-dropdown absolute z-40 mt-1 w-full overflow-hidden rounded-xl">
          {filteredOptions.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {filteredOptions.map((option, idx) => (
                <li key={`${option.value}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => choose(option.value)}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                      idx === highlightedIndex ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-app-bg'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-ink-muted">{noResultsText}</div>
          )}
        </div>
      )}
    </div>
  );
}
