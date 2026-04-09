import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/useAuth';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

interface LicensesByDay {
  day: string;
  count: number;
}

interface ModerationSummary {
  pending: number;
  approved: number;
  rejected: number;
}

interface FkkoTitlesSyncStatus {
  running: boolean;
  phase: string;
  total: number;
  processed: number;
  saved: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

function fkkoSyncPhaseLabel(phase: string): string {
  switch (phase) {
    case 'idle':
      return 'ожидание';
    case 'loading_codes':
      return 'загрузка списка кодов из БД';
    case 'rpn_fetch':
      return 'запросы к РПН (rpn.gov.ru)';
    case 'done':
      return 'завершено';
    case 'error':
      return 'ошибка';
    default:
      return phase;
  }
}

export default function AdminDashboardPage(): JSX.Element {
  const { accessToken } = useAuth();
  const [data, setData] = useState<{ licensesByDay: LicensesByDay[]; moderation: ModerationSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fkkoTitlesSync, setFkkoTitlesSync] = useState<FkkoTitlesSyncStatus | null>(null);
  const [fkkoTitlesSyncError, setFkkoTitlesSyncError] = useState<string | null>(null);

  const adminHeaders = useMemo(
    () => ({
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
    }),
    [accessToken],
  );

  const refreshFkkoTitlesSyncStatus = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/fkko/sync-official-titles/status'), {
        headers: adminHeaders,
        credentials: 'include',
      });
      const body = (await res.json()) as FkkoTitlesSyncStatus;
      if (res.ok) setFkkoTitlesSync(body);
    } catch {
      /* статус опционален */
    }
  }, [adminHeaders]);

  useEffect(() => {
    void refreshFkkoTitlesSyncStatus();
  }, [refreshFkkoTitlesSyncStatus]);

  useEffect(() => {
    if (!fkkoTitlesSync?.running) return;
    const id = window.setInterval(() => void refreshFkkoTitlesSyncStatus(), 2000);
    return () => clearInterval(id);
  }, [fkkoTitlesSync?.running, refreshFkkoTitlesSyncStatus]);

  const startFkkoTitlesSync = useCallback(async () => {
    setFkkoTitlesSyncError(null);
    try {
      const res = await fetch(getApiUrl('/api/admin/fkko/sync-official-titles'), {
        method: 'POST',
        headers: adminHeaders,
        credentials: 'include',
      });
      const body = (await res.json()) as { message?: string; status?: FkkoTitlesSyncStatus };
      if (body.status) setFkkoTitlesSync(body.status);
      if (res.status !== 202 && res.status !== 409) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      await refreshFkkoTitlesSyncStatus();
    } catch (e) {
      setFkkoTitlesSyncError(e instanceof Error ? e.message : 'Не удалось запустить синхронизацию');
    }
  }, [adminHeaders, refreshFkkoTitlesSyncStatus]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(getApiUrl('/api/admin/stats/summary'), {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки статистики');
        }
        if (!cancelled) setData(body as typeof data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5 flex items-start justify-between gap-4">
        <div>
          <div className="glass-kicker">Overview</div>
          <h1 className="glass-title mt-1">Админ-панель</h1>
        </div>
      </div>
      {loading && <div className="glass-panel p-4 text-ink-muted text-sm">Загрузка...</div>}
      {error && <div className="glass-panel p-4 glass-danger text-sm">{error}</div>}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-panel p-4">
            <h2 className="text-sm font-semibold text-[#e8f7eb] mb-3">Новые объекты по дням</h2>
            <ul className="space-y-1 text-sm text-[#c3d7cb]">
              {data.licensesByDay.map((d) => (
                <li key={d.day} className="flex justify-between glass-panel px-3 py-2.5">
                  <span>{new Date(d.day).toLocaleDateString()}</span>
                  <span className="font-semibold text-[#d9ffe0]">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-panel p-4">
            <h2 className="text-sm font-semibold text-[#e8f7eb] mb-3">Очередь модерации</h2>
            <dl className="space-y-1 text-sm text-[#c3d7cb]">
              <div className="flex justify-between glass-panel px-3 py-2.5">
                <dt>Ожидают</dt>
                <dd className="font-semibold text-[#d9ffe0]">{data.moderation.pending}</dd>
              </div>
              <div className="flex justify-between glass-panel px-3 py-2.5">
                <dt>Одобрено</dt>
                <dd className="font-semibold text-[#d9ffe0]">{data.moderation.approved}</dd>
              </div>
              <div className="flex justify-between glass-panel px-3 py-2.5">
                <dt>Отклонено</dt>
                <dd className="font-semibold text-[#d9ffe0]">{data.moderation.rejected}</dd>
              </div>
            </dl>
          </div>
          <div className="glass-panel p-4 md:col-span-2">
            <h2 className="text-sm font-semibold text-[#e8f7eb] mb-2">Наименования ФККО (РПН)</h2>
            <p className="text-xs text-[#9bb5a8] mb-4 leading-relaxed">
              Один раз подтянуть официальные названия для всех кодов из одобренных лицензий и сохранить в базе.
              После этого главная, карта и справочник получают подписи из БД без лишних запросов к rpn.gov.ru и без
              заглушек по первой цифре кода. Для большого числа кодов процесс идёт в фоне несколько минут.
            </p>
            {fkkoTitlesSyncError && (
              <div className="mb-3 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                {fkkoTitlesSyncError}
              </div>
            )}
            {fkkoTitlesSync && (
              <div className="text-xs text-[#c3d7cb] space-y-1 mb-4 font-mono tabular-nums">
                <div>
                  Состояние:{' '}
                  <span className="text-[#d9ffe0]">
                    {fkkoTitlesSync.running ? 'выполняется' : 'нет активной задачи'}
                  </span>
                  {fkkoTitlesSync.phase !== 'idle' && (
                    <span className="text-[#9bb5a8]"> ({fkkoSyncPhaseLabel(fkkoTitlesSync.phase)})</span>
                  )}
                </div>
                <div>
                  Кодов в БД (лицензии): <span className="text-[#d9ffe0]">{fkkoTitlesSync.total}</span>
                </div>
                <div>
                  Обработано запросов к РПН:{' '}
                  <span className="text-[#d9ffe0]">
                    {fkkoTitlesSync.processed} / {fkkoTitlesSync.total || '—'}
                  </span>
                </div>
                <div>
                  Сохранено наименований: <span className="text-[#d9ffe0]">{fkkoTitlesSync.saved}</span>
                </div>
                {fkkoTitlesSync.lastError && (
                  <div className="text-red-300 whitespace-pre-wrap">Ошибка: {fkkoTitlesSync.lastError}</div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void startFkkoTitlesSync()}
              disabled={Boolean(fkkoTitlesSync?.running)}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-from to-accent-to text-[#1a2e12] shadow-sm hover:shadow-md transition-shadow disabled:opacity-50 disabled:pointer-events-none"
            >
              {fkkoTitlesSync?.running ? 'Синхронизация выполняется…' : 'Обновить наименования ФККО из РПН'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

