import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
      {loading && <div className="glass-panel p-4 text-slate-600 text-sm">Загрузка...</div>}
      {error && <div className="glass-panel p-4 text-red-600 text-sm">{error}</div>}
      <div className="glass-table-wrap">
        <table className="glass-table">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Организация</th>
              <th className="px-3 py-2 text-left">Регион</th>
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
                <td className="px-3 py-1.5">{lic.region ?? '—'}</td>
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

