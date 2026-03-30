import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { formatFkkoHuman } from '@/utils/fkko';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

interface LicenseItem {
  id: number;
  companyName: string;
  region: string | null;
  inn: string | null;
  address: string | null;
  fkkoCodes?: string[] | null;
  activityTypes?: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  reward: number;
  rejectionNote: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface DuplicateLicenseRow {
  id: number;
  companyName: string;
  inn: string | null;
  status: string;
  reward: number;
  ownerUserId: number | null;
  createdAt: string;
}

interface DuplicateGroup {
  normalizedInn: string;
  keepLicenseId: number;
  licenses: DuplicateLicenseRow[];
}

interface LicenseStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  rejectedByAi: number;
}

const PAGE_SIZE = 25;
const PENDING_QUEUE_LIMIT = 200;

export default function AdminLicensesPage(): JSX.Element {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<LicenseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<LicenseStats | null>(null);
  const [pendingItems, setPendingItems] = useState<LicenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupScanLoading, setDupScanLoading] = useState(false);
  const [dupResolveLoading, setDupResolveLoading] = useState(false);

  const [batchAiRunning, setBatchAiRunning] = useState(false);
  const [batchAiStatus, setBatchAiStatus] = useState('');

  async function fetchStats(): Promise<void> {
    const res = await fetch(getApiUrl('/api/admin/licenses/stats'), {
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { message?: string }).message ?? 'Ошибка статистики');
    }
    const d = body as LicenseStats;
    setStats({
      total: Number(d.total) || 0,
      pending: Number(d.pending) || 0,
      approved: Number(d.approved) || 0,
      rejected: Number(d.rejected) || 0,
      rejectedByAi: Number(d.rejectedByAi) || 0,
    });
  }

  async function fetchPendingQueue(): Promise<void> {
    const res = await fetch(
      getApiUrl(`/api/admin/licenses?status=pending&limit=${PENDING_QUEUE_LIMIT}&offset=0`),
      {
        headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
        credentials: 'include',
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки очереди');
    }
    const data = body as { items?: LicenseItem[] };
    setPendingItems(Array.isArray(data.items) ? data.items : []);
  }

  async function fetchTablePage(forPage: number): Promise<void> {
    const offset = (forPage - 1) * PAGE_SIZE;
    const res = await fetch(
      getApiUrl(`/api/admin/licenses?limit=${PAGE_SIZE}&offset=${offset}`),
      {
        headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
        credentials: 'include',
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки объектов');
    }
    const data = body as { items?: LicenseItem[]; total?: number };
    const list = Array.isArray(data.items) ? data.items : [];
    const t = Number(data.total) ?? 0;
    setItems(list);
    setTotal(t);
    const maxPage = Math.max(1, Math.ceil(t / PAGE_SIZE) || 1);
    if (forPage > maxPage) {
      setPage(maxPage);
    }
  }

  useLayoutEffect(() => {
    setPage(1);
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchStats(), fetchPendingQueue(), fetchTablePage(page)]);
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
  }, [accessToken, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);

  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchStats(), fetchPendingQueue(), fetchTablePage(page)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: number): Promise<void> {
    try {
      const res = await fetch(getApiUrl(`/api/admin/licenses/${id}/approve`), {
        method: 'POST',
        headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Ошибка одобрения');
      }
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка одобрения');
    }
  }

  async function handleManualApproveRejected(id: number): Promise<void> {
    if (
      !window.confirm(
        'Заявка была отклонена (в том числе автоматически по ИИ). Одобрить вручную и опубликовать объект?',
      )
    ) {
      return;
    }
    await handleApprove(id);
  }

  async function handleReject(id: number): Promise<void> {
    try {
      const note = window.prompt('Введите причину отклонения (будет отображаться заявителю):') ?? '';
      const res = await fetch(getApiUrl(`/api/admin/licenses/${id}/reject`), {
        method: 'POST',
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Ошибка отклонения');
      }
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка отклонения');
    }
  }

  async function handleCheckDuplicateInns(): Promise<void> {
    setDupScanLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/licenses/duplicate-groups'), {
        headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка проверки дублей');
      }
      const groups = Array.isArray((body as { groups?: DuplicateGroup[] }).groups)
        ? (body as { groups: DuplicateGroup[] }).groups
        : [];
      setDupGroups(groups);
      setDupModalOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка проверки дублей');
    } finally {
      setDupScanLoading(false);
    }
  }

  async function handleResolveDuplicates(deductEcoCoins: boolean): Promise<void> {
    const msg = deductEcoCoins
      ? 'Удалить все дубли по ИНН (оставить запись с минимальным ID) и списать экокоины за одобренные лишние копии?'
      : 'Удалить все дубли по ИНН (оставить запись с минимальным ID) без списания экокоинов?';
    if (!window.confirm(msg)) return;

    setDupResolveLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/licenses/resolve-duplicate-inns'), {
        method: 'POST',
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ deductEcoCoins }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка слияния дублей');
      }
      const message = (body as { message?: string }).message ?? 'Готово';
      alert(message);
      setDupModalOpen(false);
      setDupGroups([]);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка слияния дублей');
    } finally {
      setDupResolveLoading(false);
    }
  }

  async function handleBatchAiApproveAll(): Promise<void> {
    if (
      !window.confirm(
        'По очереди будут обработаны все заявки «на проверке»: проверка дубля ИНН, затем ИИ по PDF и данным; при одобрении — публикация и начисление экокоинов, при отклонении — статус «отклонено» с пометкой [ИИ]. Это может занять несколько минут и расходует лимиты Timeweb AI. Продолжить?',
      )
    ) {
      return;
    }

    setBatchAiRunning(true);
    let cursor = 0;
    const acc = {
      approved: 0,
      rejected: 0,
      skipped: 0,
      errors: 0,
    };
    let chunks = 0;
    let more = true;
    let emptyQueue = false;
    try {
      while (more) {
        chunks += 1;
        setBatchAiStatus(`Партия ${chunks}…`);
        const res = await fetch(getApiUrl('/api/admin/licenses/batch-ai-approve'), {
          method: 'POST',
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ cursor, batchSize: 10, dryRun: false }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { message?: string }).message ?? `Ошибка партии ${chunks}`);
        }
        const data = body as {
          summary?: {
            approved?: number;
            rejected?: number;
            skipped?: number;
          };
          nextCursor?: number | null;
          results?: { action?: string }[];
        };
        if (chunks === 1 && (data.results?.length ?? 0) === 0) {
          emptyQueue = true;
          alert('Нет заявок со статусом «на проверке».');
          more = false;
          break;
        }
        const s = data.summary ?? {};
        acc.approved += Number(s.approved ?? 0);
        acc.rejected += Number(s.rejected ?? 0);
        acc.skipped += Number(s.skipped ?? 0);
        for (const r of data.results ?? []) {
          if (r.action === 'error') acc.errors += 1;
        }
        const next = data.nextCursor;
        if (next == null || next === undefined) {
          more = false;
        } else {
          cursor = next;
        }
      }

      if (!emptyQueue) {
        alert(
          `Готово (${chunks} партий). Одобрено: ${acc.approved}, отклонено: ${acc.rejected}, пропущено: ${acc.skipped}, ошибок записи: ${acc.errors}.`,
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка пакетной модерации');
    } finally {
      setBatchAiStatus('');
      setBatchAiRunning(false);
      await reload();
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm('Удалить объект? Его маркер пропадёт с карты.')) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/licenses/${id}`), {
        method: 'DELETE',
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка удаления');
      }
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="glass-kicker">Moderation</div>
            <h1 className="glass-title mt-1">Объекты (лицензии)</h1>
            {stats ? (
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-bg border border-black/[0.06] text-ink">
                  <span className="text-ink-muted">Всего</span>
                  <span className="font-semibold tabular-nums">{stats.total}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-soft/80 border border-[#1f5c14]/15 text-[#1f5c14]">
                  <span className="opacity-90">На проверке</span>
                  <span className="font-semibold tabular-nums">{stats.pending}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-bg border border-black/[0.06]">
                  <span className="text-ink-muted">Одобрено</span>
                  <span className="font-semibold tabular-nums text-ink">{stats.approved}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-bg border border-black/[0.06]">
                  <span className="text-ink-muted">Отклонено</span>
                  <span className="font-semibold tabular-nums text-ink">{stats.rejected}</span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200/80 bg-amber-50 text-amber-950"
                  title="Отклонено пакетной проверкой ИИ; можно одобрить вручную в таблице ниже"
                >
                  <span className="opacity-90">Отклонено ИИ</span>
                  <span className="font-semibold tabular-nums">{stats.rejectedByAi}</span>
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            disabled={dupScanLoading}
            onClick={() => {
              void handleCheckDuplicateInns();
            }}
            className="glass-btn-soft !h-10 !px-4 whitespace-nowrap shrink-0"
          >
            {dupScanLoading ? 'Проверка…' : 'Проверить дубли по ИНН'}
          </button>
        </div>
      </div>

      {dupModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dup-modal-title"
              tabIndex={-1}
              autoFocus
              onClick={(e) => {
                if (e.target === e.currentTarget && !dupResolveLoading) {
                  setDupModalOpen(false);
                  setDupGroups([]);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !dupResolveLoading) {
                  setDupModalOpen(false);
                  setDupGroups([]);
                }
              }}
            >
              <div
                className="glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="dup-modal-title" className="glass-title">
                  Дубли по ИНН
                </h2>
                {!dupGroups.length ? (
                  <p className="mt-3 text-sm text-ink-muted">Дублей по ИНН не найдено.</p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-ink-muted">
                      Для каждой группы остаётся запись с минимальным ID (первая по времени подачи). Остальные будут
                      помечены как удалённые и скрыты с карты.
                    </p>
                    <div className="mt-4 space-y-4">
                      {dupGroups.map((g) => (
                        <div key={g.normalizedInn} className="rounded-xl border border-black/[0.08] bg-app-bg/40 p-3">
                          <div className="text-sm font-semibold text-ink">
                            ИНН {g.normalizedInn}
                            <span className="font-normal text-ink-muted">
                              {' '}
                              — оставить ID {g.keepLicenseId}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1 text-sm text-ink-muted list-disc list-inside">
                            {g.licenses.map((lic) => (
                              <li key={lic.id}>
                                <span className="text-ink font-medium">ID {lic.id}</span>
                                {lic.id === g.keepLicenseId ? ' (оставляем)' : ' (будет удалён)'} — {lic.companyName};{' '}
                                {lic.status === 'approved' ? 'одобрено' : lic.status === 'rejected' ? 'отклонено' : 'на проверке'}; владелец{' '}
                                {lic.ownerUserId ?? '—'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={dupResolveLoading}
                        onClick={() => {
                          void handleResolveDuplicates(false);
                        }}
                        className="glass-btn-soft !h-10 !px-4"
                      >
                        Удалить дубли, не списывать экокоины
                      </button>
                      <button
                        type="button"
                        disabled={dupResolveLoading}
                        onClick={() => {
                          void handleResolveDuplicates(true);
                        }}
                        className="glass-btn-dark !h-10 !px-4 !bg-[#7f1d1d] !border-[#7f1d1d] hover:!bg-[#991b1b]"
                      >
                        Удалить дубли и списать экокоины
                      </button>
                    </div>
                  </>
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={dupResolveLoading}
                    onClick={() => {
                      setDupModalOpen(false);
                      setDupGroups([]);
                    }}
                    className="glass-btn-soft !h-9 !px-4"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {!!pendingItems.length && (
        <div className="glass-panel p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="glass-kicker">Заявки на проверку</div>
              <h2 className="glass-title mt-1">Очередь модерации</h2>
            </div>
            <div className="text-sm text-ink-muted text-right">
              <div>Всего на проверке: {stats?.pending ?? pendingItems.length}</div>
              {pendingItems.length >= PENDING_QUEUE_LIMIT && (stats?.pending ?? 0) > PENDING_QUEUE_LIMIT ? (
                <div className="text-[11px] text-amber-700 mt-1">В списке ниже — первые {PENDING_QUEUE_LIMIT} заявок</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 p-3 rounded-xl bg-app-bg/50 border border-black/[0.06]">
            <button
              type="button"
              disabled={batchAiRunning}
              onClick={() => {
                void handleBatchAiApproveAll();
              }}
              className="glass-btn-dark !h-10 !px-4"
            >
              {batchAiRunning ? 'Обработка ИИ…' : 'Проверить и одобрить партиями (ИИ)'}
            </button>
            {batchAiStatus ? (
              <span className="text-sm text-ink font-medium">{batchAiStatus}</span>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {pendingItems.map((lic) => {
              const fkko = Array.isArray(lic.fkkoCodes) ? lic.fkkoCodes.filter(Boolean) : [];
              const activity = Array.isArray(lic.activityTypes) ? lic.activityTypes.filter(Boolean) : [];

              return (
                <div key={lic.id} className="glass-panel p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-[220px]">
                        <div className="text-sm text-ink-muted">ID: {lic.id}</div>
                        <div className="text-base font-semibold text-ink mt-1">{lic.companyName}</div>
                        <div className="text-sm text-ink-muted mt-1">
                          ИНН {lic.inn ?? '—'}
                        </div>
                        {lic.address ? <div className="text-sm text-ink-muted mt-1">{lic.address}</div> : null}
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="px-3 py-1 rounded-xl bg-accent-soft text-xs text-[#1f5c14] font-semibold">
                          На проверке
                        </div>
                        <div className="px-3 py-1 rounded-xl bg-app-bg border border-black/[0.06] text-xs text-ink font-semibold">
                          +{lic.reward} Экокоинов
                        </div>
                      </div>
                    </div>

                    {fkko.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-ink-muted">Коды ФККО</div>
                        <div className="flex flex-wrap gap-2">
                          {fkko.map((c) => (
                            <span key={c} className="inline-flex px-2.5 py-1 rounded-xl bg-app-bg text-sm text-ink">
                              {formatFkkoHuman(c)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-ink-muted">Виды обращения</div>
                        <div className="text-sm text-ink-muted">{activity.join(', ')}</div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleApprove(lic.id);
                        }}
                        className="glass-btn-dark !h-9 !px-4"
                      >
                        Одобрить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleReject(lic.id);
                        }}
                        className="glass-btn-soft !h-9 !px-4"
                        style={{
                          background: 'rgba(127, 29, 29, 0.42)',
                          borderColor: 'rgba(127, 29, 29, 0.35)',
                          color: '#f5fff7',
                        }}
                      >
                        Отклонить
                      </button>

                      <Link to={`/admin/licenses/${lic.id}`} className="glass-btn-soft !h-9 !px-4">
                        Открыть карточку
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && <div className="glass-panel p-4 text-slate-600 text-sm">Загрузка...</div>}
      {error && <div className="glass-panel p-4 text-red-600 text-sm">{error}</div>}
      <div className="glass-table-wrap">
        <table className="glass-table">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Организация</th>
              <th className="px-3 py-2 text-left">ИНН</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Награда</th>
              <th className="px-3 py-2 text-left">Создан</th>
              <th className="px-3 py-2 text-left">Удалён</th>
              <th className="px-3 py-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((lic) => (
              <tr key={lic.id}>
                <td className="px-3 py-1.5">{lic.id}</td>
                <td className="px-3 py-1.5">{lic.companyName}</td>
                <td className="px-3 py-1.5">{lic.inn ?? '—'}</td>
                <td className="px-3 py-1.5">
                  {lic.status === 'approved' ? 'Одобрено' : lic.status === 'rejected' ? 'Отклонено' : 'На проверке'}
                  {lic.status === 'rejected' && lic.rejectionNote ? (
                    <div className="text-[11px] text-red-600 mt-1">{lic.rejectionNote}</div>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">+{lic.reward}</td>
                <td className="px-3 py-1.5">{new Date(lic.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-1.5">
                  {lic.deletedAt ? new Date(lic.deletedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-1.5">
                  {!lic.deletedAt ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      {lic.status === 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleManualApproveRejected(lic.id);
                          }}
                          className="glass-btn-dark !h-8 !text-[11px]"
                        >
                          Одобрить вручную
                        </button>
                      ) : null}
                      <Link
                        to={`/admin/licenses/${lic.id}`}
                        className="glass-btn-soft !h-8 !text-[11px]"
                      >
                        Открыть карточку
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(lic.id);
                        }}
                        className="glass-btn-dark !h-8 !text-[11px] !bg-[#7f1d1d] !border-[#7f1d1d] hover:!bg-[#991b1b]"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={9} className="px-3 py-3 text-center text-slate-500">
                  Объектов нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 ? (
        <div className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-ink">
          <div className="text-ink-muted">
            Записей: <span className="font-semibold text-ink tabular-nums">{total}</span>
            {' · '}
            Страница <span className="font-semibold text-ink tabular-nums">{page}</span> из{' '}
            <span className="font-semibold text-ink tabular-nums">{totalPages}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="glass-btn-soft !h-9 !px-4 !text-xs"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="glass-btn-soft !h-9 !px-4 !text-xs"
            >
              Вперёд
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

