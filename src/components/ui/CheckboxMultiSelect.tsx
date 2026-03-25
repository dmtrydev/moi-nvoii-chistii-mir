import { useMemo } from 'react';

export function CheckboxMultiSelect({
  options,
  selected,
  onChange,
  columns = 2,
  maxHeightClassName = 'max-h-48',
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  columns?: 1 | 2 | 3;
  maxHeightClassName?: string;
}): JSX.Element {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div
      className={[
        'rounded-xl border border-[#72b77d]/25 bg-white/5 p-3',
        maxHeightClassName,
        'overflow-y-auto',
      ].join(' ')}
    >
      <div
        className={[
          'grid gap-2',
          columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
        ].join(' ')}
      >
        {options.map((opt) => {
          const checked = selectedSet.has(opt);
          return (
            <label
              key={opt}
              className={[
                'flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors select-none',
                checked ? 'bg-white/5 border border-[#84da91]/20' : 'hover:bg-white/5 border border-transparent',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  if (checked) {
                    onChange(selected.filter((x) => x !== opt));
                  } else {
                    onChange([...selected, opt]);
                  }
                }}
                className="sr-only"
              />
              <span
                aria-hidden
                className={[
                  'h-5 w-5 rounded-[4px] border flex items-center justify-center transition-colors',
                  checked
                    ? 'bg-[#e7eee9] border-[#cfd9d2] text-[#1b2a22]'
                    : 'bg-white border-[#cfd9d2] text-transparent',
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
              <span className="text-sm text-[#d6e7dd]">{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

