import { Link } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { formatFkkoHuman } from '@/utils/fkko';
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
  const fkkoCodes = Array.isArray(item.fkkoCodes) ? item.fkkoCodes : [];
  const mainFkko = fkkoCodes.slice(0, compact ? 2 : 3);
  const restCount = Math.max(0, fkkoCodes.length - mainFkko.length);
  const fkkoTotal = fkkoCodes.length;
  const sitesCount = Array.isArray(item.sites) ? item.sites.length : 0;
  const hasAddress = Boolean(item.address?.trim()) || sitesCount > 0;

  const isLight = variant === 'light';

  const shell = isLight
    ? 'rounded-2xl border border-[#7ccd88]/26 bg-[#102018]/70 shadow-xl shadow-black/20 overflow-hidden backdrop-blur-xl'
    : 'rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden';

  const accentBar = 'bg-[#4caf50]';

  return (
    <article className={shell}>
      <div className="flex min-w-0">
        <div className={`w-1 shrink-0 ${accentBar}`} aria-hidden />
        <div className={`min-w-0 flex-1 ${compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'}`}>
          <div className={compact ? 'flex flex-col gap-2.5' : 'space-y-3'}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3
                className={
                  isLight
                    ? compact
                      ? 'text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#f5fff7] leading-[1.18] line-clamp-4'
                      : 'text-[15px] sm:text-lg font-semibold tracking-tight text-[#f5fff7] leading-snug'
                    : 'text-[15px] sm:text-lg font-semibold tracking-tight text-white leading-snug'
                }
              >
                {item.companyName || 'Организация'}
              </h3>
              <p className={isLight ? 'text-xs text-[#9ab3a5]' : 'text-xs text-white/60'}>
                <span
                  className={
                    isLight ? 'font-mono tabular-nums text-[#d9ebe0]' : 'font-mono tabular-nums text-white/85'
                  }
                >
                  ИНН {item.inn || 'не указан'}
                </span>
                {item.region ? (
                  <>
                    <span className="mx-1.5 text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span className={isLight ? 'text-[#b4cabe]' : 'text-white/70'}>{item.region}</span>
                  </>
                ) : null}
              </p>
              {(!compact || !item.region) && item.address ? (
                <p
                  className={
                    isLight
                      ? 'text-xs text-[#b4cabe] line-clamp-2 sm:line-clamp-none'
                      : 'text-xs text-white/70 line-clamp-2'
                  }
                >
                  {item.address}
                </p>
              ) : null}
              {(!compact || !item.region) && !item.address && sitesCount > 0 ? (
                <p className={isLight ? 'text-xs text-[#b4cabe]' : 'text-xs text-white/70'}>
                  Площадок: {sitesCount}
                </p>
              ) : null}
            </div>

            <div className={compact ? 'shrink-0 pt-0.5' : ''}>
              <EnterpriseActivityStrip activityTypes={item.activityTypes} variant={variant} size={compact ? 'sm' : 'md'} />
            </div>
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-4'}`}>
            {fkkoTotal > 0 && (
              <span
                className={
                  isLight
                    ? 'inline-flex items-center rounded-full bg-[#4caf50]/18 px-2.5 py-1 text-[11px] font-medium text-[#c4f5cc] ring-1 ring-inset ring-[#4caf50]/35'
                    : 'inline-flex items-center rounded-full bg-[#4caf50]/15 px-2.5 py-1 text-[11px] font-medium text-[#b8f5bb] ring-1 ring-inset ring-[#4caf50]/25'
                }
              >
                {fkkoTotal} {fkkoTotal === 1 ? 'код ФККО' : 'кодов ФККО'}
              </span>
            )}
            {hasAddress && (
              <span
                className={
                  isLight
                    ? 'inline-flex items-center gap-1 rounded-full bg-[#4caf50]/18 px-2.5 py-1 text-[11px] font-medium text-[#c4f5cc] ring-1 ring-inset ring-[#4caf50]/35'
                    : 'inline-flex items-center gap-1 rounded-full bg-[#4caf50]/15 px-2.5 py-1 text-[11px] font-medium text-[#b8f5bb] ring-1 ring-inset ring-[#4caf50]/25'
                }
              >
                <svg className="h-3.5 w-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {sitesCount > 1 ? `Адресов: ${sitesCount}` : 'Адрес указан'}
              </span>
            )}
          </div>

          {mainFkko.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {mainFkko.map((code) => (
                <span
                  key={code}
                  className={
                    isLight
                      ? 'rounded-lg border border-[#7ccd88]/22 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-[#d3e6da]'
                      : 'rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/85'
                  }
                >
                  {formatFkkoHuman(code)}
                </span>
              ))}
              {restCount > 0 && (
                <span
                  className={
                    isLight
                      ? 'rounded-lg border border-dashed border-[#7ccd88]/28 px-2 py-0.5 text-[11px] text-[#9bb4a6]'
                      : 'rounded-lg border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-white/55'
                  }
                >
                  +{restCount}
                </span>
              )}
            </div>
          )}

          <div className={`mt-4 flex flex-col sm:flex-row gap-2`}>
            <Link
              to={mapPath}
              className={
                isLight
                  ? 'inline-flex flex-1 items-center justify-center h-9 rounded-xl border border-[#7ccd88]/25 bg-white/5 px-4 text-xs font-medium text-[#d8eadd] hover:bg-white/10 transition-colors'
                  : 'inline-flex flex-1 items-center justify-center h-9 rounded-xl border border-white/20 px-4 text-xs font-medium text-white/90 hover:bg-white/10 transition-colors'
              }
            >
              На карте
            </Link>
            <Link
              to={detailsPath}
              className="inline-flex flex-1 items-center justify-center h-9 rounded-xl bg-[#4caf50] px-4 text-xs font-medium text-white hover:bg-[#43a047] transition-colors shadow-sm"
            >
              Карточка предприятия
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
