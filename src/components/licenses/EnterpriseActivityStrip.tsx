import type { LicenseData } from '@/types';
import activitySborActive from '@/assets/home-landing/activity-strip/enterprise-activity-sbor-active.svg';
import activitySborInactive from '@/assets/home-landing/activity-strip/enterprise-activity-sbor-inactive.svg';
import activityTransportActive from '@/assets/home-landing/activity-strip/enterprise-activity-transport-active.svg';
import activityTransportInactive from '@/assets/home-landing/activity-strip/enterprise-activity-transport-inactive.svg';
import activityProcessingActive from '@/assets/home-landing/activity-strip/enterprise-activity-processing-active.svg';
import activityProcessingInactive from '@/assets/home-landing/activity-strip/enterprise-activity-processing-inactive.svg';
import activityUtilizationActive from '@/assets/home-landing/activity-strip/enterprise-activity-utilization-active.svg';
import activityUtilizationInactive from '@/assets/home-landing/activity-strip/enterprise-activity-utilization-inactive.svg';
import activityNeutralizationActive from '@/assets/home-landing/activity-strip/enterprise-activity-neutralization-active.svg';
import activityNeutralizationInactive from '@/assets/home-landing/activity-strip/enterprise-activity-neutralization-inactive.svg';
import activityPlacementActive from '@/assets/home-landing/activity-strip/enterprise-activity-placement-active.svg';
import activityPlacementInactive from '@/assets/home-landing/activity-strip/enterprise-activity-placement-inactive.svg';

type StripVariant = 'light' | 'dark';
type StripSize = 'sm' | 'md';

const ACTIVITY_SLOTS: {
  label: string;
  keywords: string[];
  iconActive: string;
  iconInactive: string;
}[] = [
  {
    label: 'Сбор',
    keywords: ['сбор'],
    iconActive: activitySborActive,
    iconInactive: activitySborInactive,
  },
  {
    label: 'Транспортирование',
    keywords: ['транспорт'],
    iconActive: activityTransportActive,
    iconInactive: activityTransportInactive,
  },
  {
    label: 'Обработка',
    keywords: ['обработк'],
    iconActive: activityProcessingActive,
    iconInactive: activityProcessingInactive,
  },
  {
    label: 'Утилизация',
    keywords: ['утилиз'],
    iconActive: activityUtilizationActive,
    iconInactive: activityUtilizationInactive,
  },
  {
    label: 'Обезвреживание',
    keywords: ['обезвреж', 'нейтрали', 'уничтож'],
    iconActive: activityNeutralizationActive,
    iconInactive: activityNeutralizationInactive,
  },
  {
    label: 'Размещение',
    keywords: ['размещ', 'захорон', 'полигон', 'зхр', 'склад'],
    iconActive: activityPlacementActive,
    iconInactive: activityPlacementInactive,
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
      {ACTIVITY_SLOTS.map(({ label, keywords, iconActive, iconInactive }) => {
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
              'inline-flex shrink-0 items-center justify-center rounded-full border transition-all duration-200',
              dim,
              active
                ? isLight
                  ? 'border-transparent bg-gradient-to-br from-accent-from to-accent-to text-[#1a2e12] shadow-md'
                  : 'border-[#4caf50]/45 bg-[#4caf50]/15 text-[#b8f5bb]'
                : isLight
                  ? 'border-black/[0.08] bg-app-bg text-ink-muted'
                  : 'border-white/10 bg-white/[0.06] text-white/25',
            ].join(' ')}
          >
            <span className={`${iconDim} flex items-center justify-center`}>
              <img
                src={active ? iconActive : iconInactive}
                alt=""
                className="h-full w-full object-contain pointer-events-none"
                draggable={false}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}
