import { Link } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';

interface LicenseResultCardProps {
  item: LicenseData;
  detailsPath: string;
  mapPath: string;
  compact?: boolean;
  /** Тёмная тема только для устаревших встраиваний */
  variant?: 'dark' | 'light';
}

export function LicenseResultCard({
  item,
  detailsPath,
  mapPath,
  compact = false,
  variant = 'light',
}: LicenseResultCardProps): JSX.Element {
  const sitesCount = Array.isArray(item.sites) ? item.sites.length : 0;

  const isLight = variant === 'light';

  const shell = isLight
    ? 'rounded-2xl bg-surface shadow-eco-card overflow-hidden transition-shadow hover:shadow-eco-card-hover'
    : 'rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden';

  const accentBar = 'bg-gradient-to-b from-accent-from to-accent-to';

  return (
    <article className={shell}>
      <div className="flex min-w-0">
        <div className={`w-1.5 shrink-0 ${accentBar}`} aria-hidden />
        <div className={`min-w-0 flex-1 ${compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'}`}>
          <div className={compact ? 'flex flex-col gap-2.5' : 'space-y-3'}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3
                className={
                  isLight
                    ? compact
                      ? 'font-display text-[18px] sm:text-[20px] font-bold tracking-tight text-ink leading-[1.18] line-clamp-4'
                      : 'font-display text-[15px] sm:text-lg font-bold tracking-tight text-ink leading-snug'
                    : 'font-display text-[15px] sm:text-lg font-bold tracking-tight text-white leading-snug'
                }
              >
                {item.companyName || 'Организация'}
              </h3>
              <p className={isLight ? 'text-xs text-ink-muted' : 'text-xs text-white/60'}>
                <span
                  className={
                    isLight ? 'font-mono tabular-nums text-ink' : 'font-mono tabular-nums text-white/85'
                  }
                >
                  ИНН {item.inn || 'не указан'}
                </span>
              </p>
              {item.address ? (
                <p
                  className={
                    isLight
                      ? 'text-xs text-ink-muted line-clamp-2 sm:line-clamp-none'
                      : 'text-xs text-white/70 line-clamp-2'
                  }
                >
                  {item.address}
                </p>
              ) : sitesCount > 0 ? (
                <p className={isLight ? 'text-xs text-ink-muted' : 'text-xs text-white/70'}>
                  Площадок: {sitesCount}
                </p>
              ) : null}
            </div>

          </div>

          <div
            className={
              compact
                ? 'mt-2.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4'
                : 'mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4'
            }
          >
            <div className={compact ? 'shrink-0 pt-0.5' : ''}>
              <EnterpriseActivityStrip activityTypes={item.activityTypes} variant={variant} size={compact ? 'sm' : 'md'} />
            </div>
            <div className={`flex flex-col gap-2 md:flex-row ${compact ? '' : 'lg:justify-end'}`}>
              <Link
                to={mapPath}
                className={
                  isLight
                    ? 'inline-flex w-full md:w-auto md:flex-1 items-center justify-center h-10 rounded-xl border border-black/[0.08] bg-app-bg px-4 text-xs font-semibold text-ink hover:bg-white hover:shadow-sm transition-all'
                    : 'inline-flex w-full md:w-auto md:flex-1 items-center justify-center h-9 rounded-xl border border-white/20 px-4 text-xs font-medium text-white/90 hover:bg-white/10 transition-colors'
                }
              >
                На карте
              </Link>
              <Link
                to={detailsPath}
                className="inline-flex w-full md:w-auto md:flex-1 items-center justify-center h-10 rounded-xl px-4 text-xs font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow shadow-sm"
              >
                Карточка предприятия
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
