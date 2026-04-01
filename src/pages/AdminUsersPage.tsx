import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/useAuth';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

interface AdminUserRow {
  id: number;
  email: string;
  fullName: string | null;
  role: 'USER' | 'MODERATOR' | 'SUPERADMIN';
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsersPage(): JSX.Element {
  const { accessToken, user } = useAuth();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function loadUsers(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/admin/users'), {
        headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки пользователей');
      }
      const rows = (body as { items?: AdminUserRow[] }).items;
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [accessToken]);

  async function changeRole(target: AdminUserRow, role: 'USER' | 'MODERATOR'): Promise<void> {
    if (target.role === role) return;
    if (!window.confirm(`Изменить роль пользователя ${target.email} на ${role}?`)) return;
    setSavingId(target.id);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${target.id}/role`), {
        method: 'PATCH',
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка смены роли');
      }
      await loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка смены роли');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5">
        <div className="glass-kicker">Admin</div>
        <h1 className="glass-title mt-1">Пользователи</h1>
        <p className="mt-2 text-sm text-ink-muted">Только SUPERADMIN может назначать модераторов.</p>
      </div>

      {loading ? <div className="glass-panel p-4 text-sm text-ink-muted">Загрузка...</div> : null}
      {error ? <div className="glass-panel p-4 text-sm glass-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Имя</th>
                <th className="px-3 py-2 text-left">Роль</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-left">Создан</th>
                <th className="px-3 py-2 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-1.5">{row.id}</td>
                  <td className="px-3 py-1.5">{row.email}</td>
                  <td className="px-3 py-1.5">{row.fullName ?? '—'}</td>
                  <td className="px-3 py-1.5">{row.role}</td>
                  <td className="px-3 py-1.5">{row.isActive ? 'Активен' : 'Заблокирован'}</td>
                  <td className="px-3 py-1.5">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-1.5">
                    {row.role === 'SUPERADMIN' ? (
                      <span className="text-xs text-ink-muted">Нельзя изменить</span>
                    ) : row.id === user?.id ? (
                      <span className="text-xs text-ink-muted">Текущий пользователь</span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => {
                            void changeRole(row, 'USER');
                          }}
                          className="glass-btn-soft !h-8 !text-[11px]"
                        >
                          Сделать USER
                        </button>
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => {
                            void changeRole(row, 'MODERATOR');
                          }}
                          className="glass-btn-dark !h-8 !text-[11px]"
                        >
                          Сделать MODERATOR
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center text-ink-muted">
                    Пользователей нет
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
