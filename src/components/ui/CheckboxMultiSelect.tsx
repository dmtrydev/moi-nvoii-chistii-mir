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
                'flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors',
                checked ? 'bg-[#4caf50]/15 border border-[#84da91]/35' : 'hover:bg-white/5 border border-transparent',
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
                className="h-4 w-4 accent-[#4caf50]"
              />
              <span className="text-sm text-[#d6e7dd]">{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

