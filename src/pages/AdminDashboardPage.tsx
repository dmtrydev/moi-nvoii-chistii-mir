import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

export default function AdminDashboardPage(): JSX.Element {
  const { accessToken } = useAuth();
  const [data, setData] = useState<{ licensesByDay: LicensesByDay[]; moderation: ModerationSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      {loading && <div className="glass-panel p-4 text-[#9ab3a5] text-sm">Загрузка...</div>}
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
        </div>
      )}
    </div>
  );
}

