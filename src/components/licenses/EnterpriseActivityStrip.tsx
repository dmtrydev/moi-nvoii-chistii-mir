import type { LicenseData } from '@/types';

type StripVariant = 'light' | 'dark';
type StripSize = 'sm' | 'md';

const ACTIVITY_SLOTS: {
  label: string;
  keywords: string[];
  Icon: () => JSX.Element;
}[] = [
  {
    label: 'Сбор',
    keywords: ['сбор'],
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M8 6V4h8v2M5 6h14l-1.2 12.1A2 2 0 0 1 15.8 20H8.2a2 2 0 0 1-1.99-1.9L5 6Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v5M14 11v5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Транспортирование',
    keywords: ['транспорт'],
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M14 18V6H4v12M14 10h3l3 4v4h-4M6 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM16 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Обработка',
    keywords: ['обработк'],
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M12 21v-3M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    label: 'Утилизация',
    keywords: ['утилиз'],
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M12 3v18M7 7l5-4 5 4M7 17l5 4 5-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Обезвреживание',
    keywords: ['обезвреж', 'нейтрали', 'уничтож'],
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M12 22c4.97 0 9-3.58 9-8s-4.03-8-9-8-9 3.58-9 8c0 2.03.78 3.9 2.1 5.4L12 22Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 10.5h5M12 8v5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Размещение',
    keywords: ['размещ', 'захорон', 'полигон', 'зхр', 'склад'],
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 20h16M6 20V10l6-4 6 4v10M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function activitySlotActive(activityTypes: string[] | undefined, keywords: string[]): boolean {
  const list = Array.isArray(activityTypes) ? activityTypes : [];
  if (list.length === 0) return false;
  return list.some((raw) => {
    const t = String(raw).toLowerCase();
    return keywords.some((k) => t.includes(k));
  });
}

interface EnterpriseActivityStripProps {
  activityTypes?: LicenseData['activityTypes'];
  variant?: StripVariant;
  size?: StripSize;
  className?: string;
  labelledBy?: string;
}

export function EnterpriseActivityStrip({
  activityTypes,
  variant = 'light',
  size = 'sm',
  className = '',
  labelledBy,
}: EnterpriseActivityStripProps): JSX.Element {
  const dim = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';
  const iconDim = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const isLight = variant === 'light';

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}
      role="list"
      aria-labelledby={labelledBy}
    >
      {ACTIVITY_SLOTS.map(({ label, keywords, Icon }) => {
        const active = activitySlotActive(activityTypes, keywords);
        return (
          <span
            key={label}
            role="listitem"
            title={label}
            aria-label={label}
            data-tooltip={label}
            className={[
              'enterprise-activity-tooltip-target',
              'inline-flex shrink-0 items-center justify-center rounded-full border transition-colors',
              dim,
              active
                ? isLight
                  ? 'border-[#63c671]/70 bg-[#4caf50]/18 text-[#d8ffe0] shadow-sm'
                  : 'border-[#4caf50]/45 bg-[#4caf50]/15 text-[#b8f5bb]'
                : isLight
                  ? 'border-[#79c986]/35 bg-white/5 text-[#89a798]'
                  : 'border-white/10 bg-white/[0.06] text-white/25',
            ].join(' ')}
          >
            <span className={iconDim}>
              <Icon />
            </span>
          </span>
        );
      })}
    </div>
  );
}
