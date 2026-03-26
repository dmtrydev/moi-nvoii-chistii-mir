import { useEffect, useState } from 'react';
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

export default function AdminLicensesPage(): JSX.Element {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<LicenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(getApiUrl('/api/admin/licenses?limit=100'), {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки объектов');
        }
        if (!cancelled) {
          const data = body as { items?: LicenseItem[] };
          setItems(Array.isArray(data.items) ? data.items : []);
        }
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

  const pendingItems = items.filter((lic) => lic.status === 'pending' && !lic.deletedAt);

  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/admin/licenses?limit=100'), {
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки объектов');
      }
      const data = body as { items?: LicenseItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
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
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, deletedAt: (body as LicenseItem).deletedAt } : x)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5">
        <div className="glass-kicker">Moderation</div>
        <h1 className="glass-title mt-1">Объекты (лицензии)</h1>
      </div>
      {!!pendingItems.length && (
        <div className="glass-panel p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="glass-kicker">Заявки на проверку</div>
              <h2 className="glass-title mt-1">Очередь модерации</h2>
            </div>
            <div className="text-sm text-[#9ab3a5]">Всего: {pendingItems.length}</div>
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
                        <div className="text-sm text-[#9ab3a5]">ID: {lic.id}</div>
                        <div className="text-base font-semibold text-[#f5fff7] mt-1">{lic.companyName}</div>
                        <div className="text-sm text-[#9ab3a5] mt-1">
                          ИНН {lic.inn ?? '—'}
                        </div>
                        {lic.address ? <div className="text-sm text-[#c3d7cb] mt-1">{lic.address}</div> : null}
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="px-3 py-1 rounded-lg border border-[#72b77d]/25 bg-white/5 text-xs text-[#d9ffe0] font-semibold">
                          На проверке
                        </div>
                        <div className="px-3 py-1 rounded-lg border border-[#72b77d]/25 bg-white/5 text-xs text-[#c8f8d0] font-semibold">
                          +{lic.reward} Экокоинов
                        </div>
                      </div>
                    </div>

                    {fkko.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#8faea0]">Коды ФККО</div>
                        <div className="flex flex-wrap gap-2">
                          {fkko.map((c) => (
                            <span key={c} className="inline-flex px-2.5 py-1 rounded-lg border border-[#78c483]/24 bg-white/5 text-sm text-[#d8ffe0]">
                              {formatFkkoHuman(c)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#8faea0]">Виды обращения</div>
                        <div className="text-sm text-[#c3d7cb]">{activity.join(', ')}</div>
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
    </div>
  );
}

