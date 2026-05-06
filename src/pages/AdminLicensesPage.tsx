import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

type AdminImportListFilter =
  | 'all'
  | 'rpn_registry'
  | 'groro_parser'
  | 'registry_any'
  | 'manual'
  | 'registry_inactive';

interface LicenseItem {
  id: number;
  companyName: string;
  region: string | null;
  inn: string | null;
  address: string | null;
  fkkoCodes?: string[] | null;
  activityTypes?: string[] | null;
  status: 'pending' | 'recheck' | 'approved' | 'rejected';
  reward: number;
  rejectionNote: string | null;
  deletedAt: string | null;
  createdAt: string;
  importSource?: string | null;
  importNeedsReview?: boolean;
  importRegistryStatus?: string | null;
  importRegistryStatusRu?: string | null;
  importRegistryInactive?: boolean;
  groroNumber?: string | null;
  groroStatus?: string | null;
  groroStatusRu?: string | null;
  isReadonly?: boolean;
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
  recheck: number;
  approved: number;
  rejected: number;
  rejectedByAi: number;
}

const PAGE_SIZE = 25;
type AdminStatusFilter = 'all' | 'pending' | 'recheck' | 'approved' | 'rejected';
type RegistryStatusFilter =
  | 'all'
  | 'active'
  | 'annulled'
  | 'paused'
  | 'pausedpart'
  | 'terminated'
  | 'unknown';

function parseImportListFilter(v: string | null): AdminImportListFilter {
  if (
    v === 'all' ||
    v === 'rpn_registry' ||
    v === 'groro_parser' ||
    v === 'registry_any' ||
    v === 'manual' ||
    v === 'registry_inactive'
  ) {
    return v;
  }
  return 'all';
}

function parseStatusFilter(v: string | null): AdminStatusFilter {
  if (v === 'all' || v === 'pending' || v === 'recheck' || v === 'approved' || v === 'rejected') {
    return v;
  }
  return 'all';
}

function parseRegistryStatusFilter(v: string | null): RegistryStatusFilter {
  if (
    v === 'all' ||
    v === 'active' ||
    v === 'annulled' ||
    v === 'paused' ||
    v === 'pausedpart' ||
    v === 'terminated' ||
    v === 'unknown'
  ) {
    return v;
  }
  return 'all';
}

export default function AdminLicensesPage(): JSX.Element {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const initialImportFilter = parseImportListFilter(searchParams.get('listFilter'));
  const initialStatusFilter = parseStatusFilter(searchParams.get('status'));
  const initialRegistryStatusFilter = parseRegistryStatusFilter(searchParams.get('registryStatus'));
  const initialSearchQ = searchParams.get('q') ?? '';
  const [items, setItems] = useState<LicenseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [stats, setStats] = useState<LicenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupScanLoading, setDupScanLoading] = useState(false);
  const [dupResolveLoading, setDupResolveLoading] = useState(false);

  const [importListFilter, setImportListFilter] = useState<AdminImportListFilter>(initialImportFilter);
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>(initialStatusFilter);
  const [registryStatusFilter, setRegistryStatusFilter] =
    useState<RegistryStatusFilter>(initialRegistryStatusFilter);
  const [needsReviewOnly, setNeedsReviewOnly] = useState<boolean>(false);
  const [listSearchInput, setListSearchInput] = useState(initialSearchQ);
  const [listSearchQ, setListSearchQ] = useState(initialSearchQ);
  const didInitFiltersRef = useRef(false);

  function setListUrlState(next: {
    page?: number;
    listFilter?: AdminImportListFilter;
    status?: AdminStatusFilter;
    registryStatus?: RegistryStatusFilter;
    q?: string;
  }): void {
    const p = new URLSearchParams(searchParams);
    const nextPage = Math.max(1, next.page ?? page);
    const nextListFilter = next.listFilter ?? importListFilter;
    const nextStatus = next.status ?? statusFilter;
    const nextRegistryStatus = next.registryStatus ?? registryStatusFilter;
    const nextQ = next.q ?? listSearchQ;
    p.set('page', String(nextPage));
    if (nextListFilter === 'all') p.delete('listFilter');
    else p.set('listFilter', nextListFilter);
    if (nextStatus === 'all') p.delete('status');
    else p.set('status', nextStatus);
    if (nextRegistryStatus === 'all') p.delete('registryStatus');
    else p.set('registryStatus', nextRegistryStatus);
    if (nextQ.trim()) p.set('q', nextQ.trim());
    else p.delete('q');
    setSearchParams(p, { replace: true });
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      setListSearchQ(listSearchInput.trim());
    }, 400);
    return () => window.clearTimeout(t);
  }, [listSearchInput]);

  useEffect(() => {
    const urlPage = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
    const urlListFilter = parseImportListFilter(searchParams.get('listFilter'));
    const urlStatus = parseStatusFilter(searchParams.get('status'));
    const urlRegistryStatus = parseRegistryStatusFilter(searchParams.get('registryStatus'));
    const urlQ = searchParams.get('q') ?? '';
    if (page !== urlPage) setPage(urlPage);
    if (importListFilter !== urlListFilter) setImportListFilter(urlListFilter);
    if (statusFilter !== urlStatus) setStatusFilter(urlStatus);
    if (registryStatusFilter !== urlRegistryStatus) setRegistryStatusFilter(urlRegistryStatus);
    if (listSearchInput !== urlQ) setListSearchInput(urlQ);
    if (listSearchQ !== urlQ) setListSearchQ(urlQ);
  }, [searchParams]);

  async function fetchStats(): Promise<void> {
    const res = await fetch(getApiUrl('/api/admin/licenses/stats'), {
      headers: {},
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
      recheck: Number(d.recheck) || 0,
      approved: Number(d.approved) || 0,
      rejected: Number(d.rejected) || 0,
      rejectedByAi: Number(d.rejectedByAi) || 0,
    });
  }

  async function fetchTablePage(forPage: number): Promise<void> {
    const offset = (forPage - 1) * PAGE_SIZE;
    const qs = new URLSearchParams();
    qs.set('limit', String(PAGE_SIZE));
    qs.set('offset', String(offset));
    if (importListFilter === 'rpn_registry') qs.set('importSource', 'rpn_registry');
    if (importListFilter === 'groro_parser') qs.set('importSource', 'groro_parser');
    if (importListFilter === 'registry_any') qs.set('importSource', 'any');
    if (importListFilter === 'manual') qs.set('importSource', 'manual');
    if (importListFilter === 'registry_inactive') qs.set('importRegistryInactive', 'true');
    if (needsReviewOnly) qs.set('importNeedsReview', 'true');
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (registryStatusFilter !== 'all') qs.set('importRegistryStatus', registryStatusFilter);
    if (listSearchQ) qs.set('q', listSearchQ);
    const res = await fetch(getApiUrl(`/api/admin/licenses?${qs}`), {
      headers: {},
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки объектов');
    }
    const data = body as { items?: LicenseItem[]; total?: number };
    const list = Array.isArray(data.items) ? data.items : [];
    const totalValue = Number(data.total);
    const t = Number.isFinite(totalValue) ? totalValue : 0;
    setItems(list);
    setTotal(t);
    const maxPage = Math.max(1, Math.ceil(t / PAGE_SIZE) || 1);
    if (forPage > maxPage) {
      setPage(maxPage);
    }
  }

  useLayoutEffect(() => {
    if (!didInitFiltersRef.current) {
      didInitFiltersRef.current = true;
      return;
    }
    setPage(1);
    setListUrlState({ page: 1 });
  }, [importListFilter, statusFilter, registryStatusFilter, needsReviewOnly, listSearchQ]);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        await fetchStats();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      }
    }
    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await fetchTablePage(page);
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
  }, [page, importListFilter, statusFilter, registryStatusFilter, needsReviewOnly, listSearchQ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);

  async function reload(options?: { withStats?: boolean }): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await fetchTablePage(page);
      if (options?.withStats) {
        await fetchStats();
      }
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
        headers: {},
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Ошибка одобрения');
      }
      await reload({ withStats: true });
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
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Ошибка отклонения');
      }
      await reload({ withStats: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка отклонения');
    }
  }

  async function handleCheckDuplicateInns(): Promise<void> {
    setDupScanLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/licenses/duplicate-groups'), {
        headers: {},
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

  async function handleResolveDuplicates(): Promise<void> {
    if (
      !window.confirm(
        'Удалить все дубли по ИНН (оставить запись с минимальным ID)? Остальные будут помечены как удалённые.',
      )
    ) {
      return;
    }

    setDupResolveLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/licenses/resolve-duplicate-inns'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка слияния дублей');
      }
      const message = (body as { message?: string }).message ?? 'Готово';
      alert(message);
      setDupModalOpen(false);
      setDupGroups([]);
      await reload({ withStats: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка слияния дублей');
    } finally {
      setDupResolveLoading(false);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm('Удалить объект? Его маркер пропадёт с карты.')) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/licenses/${id}`), {
        method: 'DELETE',
        headers: {},
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка удаления');
      }
      await reload({ withStats: true });
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
            <h1 className="typo-h1 mt-1">Объекты (лицензии)</h1>
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
                  <span className="text-ink-muted">На перепроверке</span>
                  <span className="font-semibold tabular-nums text-ink">{stats.recheck}</span>
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
                <h2 id="dup-modal-title" className="typo-h2">
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
                                {lic.status === 'approved'
                                  ? 'одобрено'
                                  : lic.status === 'recheck'
                                    ? 'на перепроверке'
                                    : lic.status === 'rejected'
                                      ? 'отклонено'
                                      : 'на проверке'}
                                ; владелец{' '}
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
                          void handleResolveDuplicates();
                        }}
                        className="glass-btn-dark !h-10 !px-4"
                      >
                        Удалить дубли
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
      {loading && <div className="glass-panel p-4 text-slate-600 text-sm">Загрузка...</div>}
      {error && <div className="glass-panel p-4 text-red-600 text-sm">{error}</div>}
      <div className="glass-panel p-4 flex flex-col gap-3 text-sm">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Поиск по базе
          </label>
          <input
            type="search"
            value={listSearchInput}
            onChange={(e) => setListSearchInput(e.target.value)}
            placeholder="Слова, ИНН, ID, ФККО, адрес, регион..."
            className="w-full max-w-2xl rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5fd93a]/35"
            autoComplete="off"
          />
          <p className="text-xs text-ink-muted max-w-2xl">
            Несколько слов через пробел — должны встречаться все одновременно (в названии, ИНН, адресах площадок,
            кодах ФККО, видах работ, комментариях и т.д.). Регистр не важен.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <span className="text-ink-muted shrink-0">Фильтры:</span>
          <select
            className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-ink max-w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AdminStatusFilter)}
          >
            <option value="all">Все статусы</option>
            <option value="pending">На проверке</option>
            <option value="recheck">На перепроверке</option>
            <option value="approved">Одобрено</option>
            <option value="rejected">Отклонено</option>
          </select>
          <select
            className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-ink max-w-full"
            value={importListFilter}
            onChange={(e) => setImportListFilter(e.target.value as AdminImportListFilter)}
          >
            <option value="all">Все записи</option>
            <option value="rpn_registry">Импорт через парсер (реестр РПН)</option>
            <option value="groro_parser">Импорт ГРОРО</option>
            <option value="manual">Загрузка лицензии с сайта (PDF)</option>
            <option value="registry_any">Любой импорт из реестра</option>
            <option value="registry_inactive">Неактивные в реестре</option>
          </select>
          <label className="inline-flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={needsReviewOnly}
              onChange={(e) => setNeedsReviewOnly(e.target.checked)}
            />
            Только требует проверки
          </label>
          <select
            className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-ink max-w-full"
            value={registryStatusFilter}
            onChange={(e) => setRegistryStatusFilter(e.target.value as RegistryStatusFilter)}
          >
            <option value="all">Все статусы реестра</option>
            <option value="active">Действующая</option>
            <option value="annulled">Аннулирована</option>
            <option value="paused">Приостановлена</option>
            <option value="pausedpart">Частично приостановлена</option>
            <option value="terminated">Прекращена</option>
            <option value="unknown">Неизвестный</option>
          </select>
        </div>
      </div>
      <div className="glass-table-wrap">
        <table className="glass-table">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Организация</th>
              <th className="px-3 py-2 text-left">ИНН</th>
              <th className="px-3 py-2 text-left">Источник</th>
              <th className="px-3 py-2 text-left">Статус</th>
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
                <td className="px-3 py-1.5 align-top">
                  {lic.importSource ? (
                    <div className="space-y-1">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-lg bg-sky-100 text-sky-950 text-[11px] font-semibold"
                        title={lic.importSource ?? 'rpn_registry'}
                      >
                        {lic.importSource === 'groro_parser' ? 'ГРОРО' : 'Реестр'}
                      </span>
                      {lic.groroNumber ? (
                        <div className="text-[11px] text-ink-muted">ГРОРО: {lic.groroNumber}</div>
                      ) : null}
                      {lic.groroStatusRu ? (
                        <div className="text-[11px] text-ink-muted">Статус ГРОРО: {lic.groroStatusRu}</div>
                      ) : null}
                      {lic.importRegistryInactive ? (
                        <div className="text-[11px] text-rose-800 font-medium">Неактивна (реестр)</div>
                      ) : null}
                      {lic.importNeedsReview ? (
                        <div className="text-[11px] text-amber-800 font-medium">Требует проверки</div>
                      ) : null}
                      {lic.importRegistryStatusRu ? (
                        <div className="text-[11px] text-ink-muted">
                          Статус РПН: {lic.importRegistryStatusRu}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {lic.status === 'approved'
                    ? 'Одобрено'
                    : lic.status === 'recheck'
                      ? 'На перепроверке'
                      : lic.status === 'rejected'
                        ? 'Отклонено'
                        : 'На проверке'}
                  {lic.status === 'rejected' && lic.rejectionNote ? (
                    <div className="text-[11px] text-red-600 mt-1">{lic.rejectionNote}</div>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">{new Date(lic.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-1.5">
                  {lic.deletedAt ? new Date(lic.deletedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-1.5">
                  {!lic.deletedAt && lic.importSource !== 'groro_parser' ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      {lic.status !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (lic.status === 'rejected') void handleManualApproveRejected(lic.id);
                            else void handleApprove(lic.id);
                          }}
                          className="glass-btn-dark !h-8 !text-[11px]"
                        >
                          {lic.status === 'rejected' ? 'Одобрить вручную' : 'Одобрить'}
                        </button>
                      ) : null}
                      {lic.status !== 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleReject(lic.id);
                          }}
                          className="glass-btn-soft !h-8 !text-[11px]"
                          style={{
                            background: 'rgba(127, 29, 29, 0.42)',
                            borderColor: 'rgba(127, 29, 29, 0.35)',
                            color: '#f5fff7',
                          }}
                        >
                          Отклонить
                        </button>
                      ) : null}
                      <Link
                        to={lic.importSource === 'groro_parser' ? `/admin/groro/${lic.id}` : `/admin/licenses/${lic.id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
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
                  ) : lic.importSource === 'groro_parser' ? (
                    <span className="text-xs text-ink-muted">Управление в слое ГРОРО</span>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={8} className="px-3 py-3 text-center text-slate-500">
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
              onClick={() =>
                setPage((p) => {
                  const next = Math.max(1, p - 1);
                  setListUrlState({ page: next });
                  return next;
                })
              }
              className="glass-btn-soft !h-9 !px-4 !text-xs"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((p) => {
                  const next = Math.min(totalPages, p + 1);
                  setListUrlState({ page: next });
                  return next;
                })
              }
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

