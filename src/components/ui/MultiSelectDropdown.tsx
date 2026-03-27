import { useEffect, useMemo, useRef, useState } from 'react';

function normalize(v: string): string {
  return String(v ?? '').trim();
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Выберите…',
  buttonClassName = '',
  maxHeightClassName = 'max-h-64',
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  buttonClassName?: string;
  maxHeightClassName?: string;
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
    if (s.length <= 2) return s.join(', ');
    return `${s.slice(0, 2).join(', ')} и ещё ${s.length - 2}`;
  }, [selected]);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={[
          buttonClassName,
          'w-full text-left flex items-center justify-between gap-2',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedLabel ? 'text-ink' : 'text-ink-muted'}>
          {selectedLabel || placeholder}
        </span>
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
      </button>

      {isOpen && (
        <div className={`liquid-dropdown absolute z-40 mt-1 w-full overflow-hidden rounded-xl ${maxHeightClassName}`}>
          <div className="max-h-64 overflow-y-auto py-1">
            {normalizedOptions.map((opt) => {
              const checked = selectedSet.has(opt);
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
                  className={[
                    'block w-full px-3 py-2 text-left text-sm transition-colors',
                    checked ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-app-bg',
                  ].join(' ')}
                  role="option"
                  aria-selected={checked}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={[
                        'h-5 w-5 rounded-[4px] border flex items-center justify-center transition-colors',
                        checked
                          ? 'bg-gradient-to-br from-accent-from to-accent-to border-transparent text-[#1a2e12]'
                          : 'bg-white border-black/15 text-transparent',
                      ].join(' ')}
                    >
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
                    <span>{opt}</span>
                  </span>
                </button>
              );
            })}
            {normalizedOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-ink-muted">Нет вариантов</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

