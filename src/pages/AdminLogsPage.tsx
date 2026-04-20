import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

interface AuditLogItem {
  id: number;
  userId: number | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  severity: string;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminLogsPage(): JSX.Element {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(getApiUrl('/api/admin/logs?limit=50'), {
          headers: {},
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { message?: string }).message ?? 'Ошибка загрузки логов');
        }
        if (!cancelled) {
          const data = body as { items?: AuditLogItem[] };
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
  }, []);

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5">
        <div className="glass-kicker">Security</div>
        <h1 className="typo-h1 mt-1">Аудит-логи</h1>
      </div>
      {loading && <div className="glass-panel p-4 text-slate-600 text-sm">Загрузка...</div>}
      {error && <div className="glass-panel p-4 text-red-600 text-sm">{error}</div>}
      <div className="glass-table-wrap">
        <table className="glass-table">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Время</th>
              <th className="px-3 py-2 text-left">Пользователь</th>
              <th className="px-3 py-2 text-left">Действие</th>
              <th className="px-3 py-2 text-left">Сущность</th>
              <th className="px-3 py-2 text-left">Уровень</th>
              <th className="px-3 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={log.id}>
                <td className="px-3 py-1.5">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-3 py-1.5">{log.userId ?? '—'}</td>
                <td className="px-3 py-1.5">{log.action}</td>
                <td className="px-3 py-1.5">
                  {log.entityType ?? '—'}
                  {log.entityId ? `#${log.entityId}` : ''}
                </td>
                <td className="px-3 py-1.5">{log.severity}</td>
                <td className="px-3 py-1.5">{log.ipAddress ?? '—'}</td>
              </tr>
            ))}
            {!loading && !items.length && (
              <tr>
                <td colSpan={6} className="px-3 py-3 text-center text-slate-500">
                  Логи отсутствуют
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

