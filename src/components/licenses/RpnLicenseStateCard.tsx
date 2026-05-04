import type { PpsState, PpsSummary, RpnSnapshotPublic } from '@/types';

interface Props {
  pps?: PpsSummary;
  rpnSnapshot?: RpnSnapshotPublic | null;
}

interface StateStyle {
  container: string;
  badge: string;
  badgeText: string;
}

/**
 * Цветовая палитра карточки по состоянию ППС.
 * Тщательно подобраны нейтральные варианты Tailwind, без alarmism в зелёном/жёлтом.
 */
const STATE_STYLES: Record<PpsState, StateStyle> = {
  green: {
    container: 'border-emerald-200/80 bg-emerald-50/70',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300/70',
    badgeText: 'Лицензия действует',
  },
  yellow: {
    container: 'border-amber-200/80 bg-amber-50/70',
    badge: 'bg-amber-100 text-amber-900 border-amber-300/70',
    badgeText: 'Скоро срок ППС',
  },
  red: {
    container: 'border-rose-200/80 bg-rose-50/70',
    badge: 'bg-rose-100 text-rose-900 border-rose-300/70',
    badgeText: 'Срок ППС критичен',
  },
  gray: {
    container: 'border-slate-200/80 bg-slate-50/70',
    badge: 'bg-slate-100 text-slate-800 border-slate-300/70',
    badgeText: 'Состояние не активно',
  },
};

function formatDateRu(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getUTCFullYear()}`;
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function formatYearsAndMonths(fromIso: string | null | undefined): string {
  if (!fromIso) return '';
  const from = new Date(fromIso);
  if (!Number.isFinite(from.getTime())) return '';
  const now = new Date();
  let years = now.getUTCFullYear() - from.getUTCFullYear();
  let months = now.getUTCMonth() - from.getUTCMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return '';
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralRu(years, ['год', 'года', 'лет'])}`);
  if (months > 0) parts.push(`${months} ${pluralRu(months, ['месяц', 'месяца', 'месяцев'])}`);
  return parts.join(' ');
}

export function RpnLicenseStateCard({ pps, rpnSnapshot }: Props): JSX.Element | null {
  // Если бэк не вернул блок (старый код или ошибка) — не ломаем страницу.
  if (!pps && !rpnSnapshot) return null;

  const state: PpsState = pps?.state ?? 'gray';
  const style = STATE_STYLES[state];

  const dateIssued = formatDateRu(rpnSnapshot?.dateIssued);
  const ageHuman = formatYearsAndMonths(rpnSnapshot?.dateIssued);
  const registryModified = formatDateRu(rpnSnapshot?.registryModifiedAt);
  const synced = formatDateRu(rpnSnapshot?.syncedAt);

  return (
    <section
      className={`mt-10 rounded-2xl border ${style.container} p-6 sm:p-7 shadow-sm`}
      aria-labelledby="rpn-license-state-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="rpn-license-state-title" className="typo-h2 text-ink">
            Лицензия в реестре Росприроднадзора
          </h2>
          <p className="mt-1 text-sm text-ink-muted max-w-xl leading-snug">
            Сведения берутся из реестра РПН (источник: tor.knd.gov.ru). Срок периодического
            подтверждения соответствия рассчитан по дате выдачи лицензии.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 self-start whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${style.badge}`}
        >
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              state === 'green'
                ? 'bg-emerald-500'
                : state === 'yellow'
                  ? 'bg-amber-500'
                  : state === 'red'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
            }`}
          />
          {style.badgeText}
        </span>
      </div>

      <p className="mt-5 text-sm text-ink leading-relaxed">{pps?.message ?? ''}</p>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rpnSnapshot?.registryStatusRu ? (
          <div className="rounded-xl bg-white/70 px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Статус в реестре
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{rpnSnapshot.registryStatusRu}</dd>
          </div>
        ) : null}

        {rpnSnapshot?.licenseNumber ? (
          <div className="rounded-xl bg-white/70 px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Номер лицензии
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">
              {rpnSnapshot.licenseNumber}
            </dd>
          </div>
        ) : null}

        {dateIssued ? (
          <div className="rounded-xl bg-white/70 px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Дата выдачи
            </dt>
            <dd className="mt-1 text-sm text-ink">
              {dateIssued}
              {ageHuman ? <span className="text-ink-muted"> · действует {ageHuman}</span> : null}
            </dd>
          </div>
        ) : null}

        {pps?.deadlineAt ? (
          <div className="rounded-xl bg-white/70 px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Ближайший срок ППС
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
              {formatDateRu(pps.deadlineAt)}
              {pps.daysLeft != null ? (
                <span className="ml-2 text-ink-muted font-normal">
                  ({pps.daysLeft >= 0 ? `осталось ${pps.daysLeft}` : `просрочено на ${Math.abs(pps.daysLeft)}`}{' '}
                  {pluralRu(pps.daysLeft, ['день', 'дня', 'дней'])})
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}

        {rpnSnapshot?.unitShortName ? (
          <div className="sm:col-span-2 rounded-xl bg-white/70 px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Орган, выдавший лицензию
            </dt>
            <dd className="mt-1 text-sm text-ink leading-snug">{rpnSnapshot.unitShortName}</dd>
          </div>
        ) : null}

        {registryModified || synced ? (
          <div className="sm:col-span-2 rounded-xl bg-white/40 px-4 py-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Свежесть данных
            </dt>
            <dd className="mt-1 text-xs text-ink-muted leading-relaxed">
              {registryModified ? (
                <>
                  Запись в реестре РПН обновлялась{' '}
                  <span className="font-semibold text-ink">{registryModified}</span>.{' '}
                </>
              ) : null}
              {synced ? (
                <>
                  Синхронизация с реестром на нашем сервере:{' '}
                  <span className="font-semibold text-ink">{synced}</span>.
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-5 text-[11px] text-ink-muted leading-relaxed">
        Расчёт срока ППС основан только на дате выдачи лицензии: если контрагент уже прошёл
        периодическое подтверждение соответствия после 01.03.2025, фактический срок может быть
        позже указанного. Уточняйте у контрагента перед заключением договора.
      </p>
    </section>
  );
}

export default RpnLicenseStateCard;
