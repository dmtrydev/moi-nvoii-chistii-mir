import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { formatFkkoHuman } from '@/utils/fkko';

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

type AdminStatsSummary = {
  licensesByDay: LicensesByDay[];
  moderation: ModerationSummary;
  registryInactiveLicensesCount?: number;
};

export default function AdminDashboardPage(): JSX.Element {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<AdminStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fkkoTitlesSync, setFkkoTitlesSync] = useState<FkkoTitlesSyncStatus | null>(null);
  const [fkkoTitlesSyncError, setFkkoTitlesSyncError] = useState<string | null>(null);
  const [fkkoMissingCodes, setFkkoMissingCodes] = useState<string[]>([]);
  const [fkkoMissingDraft, setFkkoMissingDraft] = useState<Record<string, string>>({});
  const [fkkoMissingLoading, setFkkoMissingLoading] = useState(false);
  const [fkkoMissingError, setFkkoMissingError] = useState<string | null>(null);
  const [fkkoMissingSaveOk, setFkkoMissingSaveOk] = useState<string | null>(null);
  const [fkkoMissingListLoaded, setFkkoMissingListLoaded] = useState(false);
  const [registryPurgeBusy, setRegistryPurgeBusy] = useState(false);
  const [registryPurgeError, setRegistryPurgeError] = useState<string | null>(null);
  const [registryPurgeOk, setRegistryPurgeOk] = useState<string | null>(null);

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

  const loadFkkoMissingTitles = useCallback(async () => {
    setFkkoMissingError(null);
    setFkkoMissingSaveOk(null);
    setFkkoMissingLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/fkko/titles/missing'), {
        headers: adminHeaders,
        credentials: 'include',
      });
      const body = (await res.json()) as { codes?: string[]; message?: string };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      const codes = Array.isArray(body.codes) ? body.codes : [];
      setFkkoMissingListLoaded(true);
      setFkkoMissingCodes(codes);
      setFkkoMissingDraft((prev) => {
        const next = { ...prev };
        for (const c of codes) if (next[c] === undefined) next[c] = '';
        for (const k of Object.keys(next)) if (!codes.includes(k)) delete next[k];
        return next;
      });
    } catch (e) {
      setFkkoMissingListLoaded(true);
      setFkkoMissingCodes([]);
      setFkkoMissingDraft({});
      setFkkoMissingError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setFkkoMissingLoading(false);
    }
  }, [adminHeaders]);

  const saveFkkoManualTitles = useCallback(async () => {
    setFkkoMissingError(null);
    setFkkoMissingSaveOk(null);
    const titles: Record<string, string> = {};
    for (const code of fkkoMissingCodes) {
      const t = (fkkoMissingDraft[code] ?? '').trim();
      if (t) titles[code] = t;
    }
    if (Object.keys(titles).length === 0) {
      setFkkoMissingError('Введите хотя бы одно наименование');
      return;
    }
    const MANUAL_BATCH = 80;
    const pairs = Object.entries(titles);
    try {
      let totalSaved = 0;
      for (let i = 0; i < pairs.length; i += MANUAL_BATCH) {
        const chunk = Object.fromEntries(pairs.slice(i, i + MANUAL_BATCH));
        const res = await fetch(getApiUrl('/api/admin/fkko/titles/manual'), {
          method: 'POST',
          headers: { ...adminHeaders, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ titles: chunk }),
        });
        const body = (await res.json()) as { saved?: number; message?: string };
        if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
        totalSaved += body.saved ?? Object.keys(chunk).length;
      }
      setFkkoMissingSaveOk(`Сохранено наименований: ${totalSaved}`);
      await loadFkkoMissingTitles();
    } catch (e) {
      setFkkoMissingError(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  }, [adminHeaders, fkkoMissingCodes, fkkoMissingDraft, loadFkkoMissingTitles]);

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

  const refreshSummary = useCallback(async (): Promise<void> => {
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
    setData(body as AdminStatsSummary);
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await refreshSummary();
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
  }, [accessToken, refreshSummary]);

  const purgeRegistryInactiveLicenses = useCallback(async () => {
    const n = data?.registryInactiveLicensesCount ?? 0;
    if (n <= 0) return;
    setRegistryPurgeError(null);
    setRegistryPurgeOk(null);
    if (
      !window.confirm(
        `Удалить безвозвратно ${n} лицензий с пометкой «Неактивна (реестр)»? Будут удалены связанные площадки и строки ФККО. Восстановить нельзя.`,
      )
    ) {
      return;
    }
    if (!window.confirm('Подтвердите ещё раз: операция необратима.')) return;
    setRegistryPurgeBusy(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/licenses/purge-registry-inactive'), {
        method: 'POST',
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ confirm: 'PURGE_REGISTRY_INACTIVE' }),
      });
      const body = (await res.json()) as { deleted?: number; message?: string };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      setRegistryPurgeOk(`Удалено записей: ${body.deleted ?? 0}`);
      await refreshSummary();
    } catch (e) {
      setRegistryPurgeError(e instanceof Error ? e.message : 'Ошибка удаления');
    } finally {
      setRegistryPurgeBusy(false);
    }
  }, [accessToken, data?.registryInactiveLicensesCount, refreshSummary]);

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
            <h2 className="text-sm font-semibold text-[#e8f7eb] mb-2">Импорт реестра РПН: неактивные</h2>
            <p className="text-xs text-[#9bb5a8] mb-3 leading-relaxed">
              Записи с флагом «неактивна в выгрузке реестра» (в списке объектов отображаются как «Неактивна
              (реестр)»). Они не показываются на публичной карте и в поиске.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="glass-panel px-3 py-2.5 text-sm text-[#c3d7cb]">
                Всего таких лицензий в базе:{' '}
                <span className="font-semibold tabular-nums text-[#d9ffe0]">
                  {data.registryInactiveLicensesCount ?? 0}
                </span>
              </div>
              {user?.role === 'SUPERADMIN' && (data.registryInactiveLicensesCount ?? 0) > 0 && (
                <button
                  type="button"
                  disabled={registryPurgeBusy}
                  onClick={() => void purgeRegistryInactiveLicenses()}
                  className="inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold bg-red-950/50 text-red-200 border border-red-800/60 hover:bg-red-950/70 disabled:opacity-50"
                >
                  {registryPurgeBusy ? 'Удаление…' : 'Удалить все неактивные (реестр)'}
                </button>
              )}
            </div>
            {user?.role !== 'SUPERADMIN' && (data.registryInactiveLicensesCount ?? 0) > 0 && (
              <p className="text-xs text-[#9bb5a8]">
                Массовое удаление доступно только роли суперадминистратора.
              </p>
            )}
            {registryPurgeError && (
              <div className="mb-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                {registryPurgeError}
              </div>
            )}
            {registryPurgeOk && (
              <div className="mb-2 text-xs text-emerald-200 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                {registryPurgeOk}
              </div>
            )}
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
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-sm font-semibold text-[#e8f7eb] mb-2">Коды без описания в базе</h3>
              <p className="text-xs text-[#9bb5a8] mb-4 leading-relaxed">
                Список кодов из одобренных лицензий, для которых в{' '}
                <span className="text-[#c3d7cb]">fkko_official_titles</span> ещё нет текста (РПН не вернул или код
                нестандартный). Можно ввести наименование вручную — оно появится в фильтрах, на карте и в справочнике.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => void loadFkkoMissingTitles()}
                  disabled={fkkoMissingLoading}
                  className="inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold bg-white/10 text-[#e8f7eb] hover:bg-white/15 border border-white/10 disabled:opacity-50"
                >
                  {fkkoMissingLoading ? 'Загрузка…' : 'Показать список'}
                </button>
                {fkkoMissingCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void saveFkkoManualTitles()}
                    className="inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold bg-gradient-to-br from-accent-from to-accent-to text-[#1a2e12]"
                  >
                    Сохранить введённые наименования
                  </button>
                )}
              </div>
              {fkkoMissingError && (
                <div className="mb-3 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                  {fkkoMissingError}
                </div>
              )}
              {fkkoMissingSaveOk && (
                <div className="mb-3 text-xs text-emerald-200 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                  {fkkoMissingSaveOk}
                </div>
              )}
              {fkkoMissingCodes.length > 0 && (
                <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1 no-scrollbar">
                  {fkkoMissingCodes.map((code) => (
                    <div
                      key={code}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-mono text-[#d9ffe0] tabular-nums">{code}</span>
                        <span className="text-[#9bb5a8]">{formatFkkoHuman(code)}</span>
                      </div>
                      <label className="sr-only" htmlFor={`fkko-title-${code}`}>
                        Наименование для {code}
                      </label>
                      <textarea
                        id={`fkko-title-${code}`}
                        value={fkkoMissingDraft[code] ?? ''}
                        onChange={(e) =>
                          setFkkoMissingDraft((prev) => ({ ...prev, [code]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Введите официальное наименование отхода по ФККО"
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-[#e8f7eb] placeholder:text-[#6b7a72] focus:outline-none focus:ring-1 focus:ring-accent-from resize-y min-h-[2.75rem]"
                      />
                    </div>
                  ))}
                </div>
              )}
              {!fkkoMissingLoading &&
                fkkoMissingCodes.length === 0 &&
                fkkoMissingError === null &&
                !fkkoMissingListLoaded && (
                  <p className="text-xs text-[#6b7a72]">Нажмите «Показать список», чтобы загрузить коды без наименования в базе.</p>
                )}
              {!fkkoMissingLoading &&
                fkkoMissingCodes.length === 0 &&
                fkkoMissingError === null &&
                fkkoMissingListLoaded && (
                  <p className="text-xs text-[#9bb5a8]">Кодов без описания не найдено — для всех используемых в лицензиях кодов есть запись в базе.</p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

