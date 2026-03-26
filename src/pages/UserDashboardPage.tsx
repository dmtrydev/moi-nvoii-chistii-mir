import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

interface UserLicense {
  id: number;
  companyName: string;
  status: 'pending' | 'approved' | 'rejected';
  reward: number;
  region: string | null;
  rejectionNote: string | null;
  createdAt: string;
}

interface UserTransaction {
  id: number;
  amount: number;
  type: string;
  licenseId: number;
  companyName: string | null;
  createdAt: string;
}

export default function UserDashboardPage(): JSX.Element {
  const { accessToken, user, logout } = useAuth();
  const [balance, setBalance] = useState(0);
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: accessToken ? `Bearer ${accessToken}` : '' };
        const [balanceRes, licensesRes, txRes] = await Promise.all([
          fetch(getApiUrl('/api/user/balance'), { credentials: 'include', headers }),
          fetch(getApiUrl('/api/user/licenses'), { credentials: 'include', headers }),
          fetch(getApiUrl('/api/user/transactions'), { credentials: 'include', headers }),
        ]);

        const [balanceBody, licensesBody, txBody] = await Promise.all([
          balanceRes.json().catch(() => ({})),
          licensesRes.json().catch(() => ({})),
          txRes.json().catch(() => ({})),
        ]);

        if (!balanceRes.ok) {
          throw new Error((balanceBody as { message?: string }).message ?? 'Ошибка загрузки баланса');
        }
        if (!licensesRes.ok) {
          throw new Error((licensesBody as { message?: string }).message ?? 'Ошибка загрузки лицензий');
        }
        if (!txRes.ok) {
          throw new Error((txBody as { message?: string }).message ?? 'Ошибка загрузки транзакций');
        }

        if (!cancelled) {
          setBalance(Number((balanceBody as { balance?: number }).balance ?? 0));
          setLicenses(Array.isArray((licensesBody as { items?: UserLicense[] }).items) ? (licensesBody as { items: UserLicense[] }).items : []);
          setTransactions(Array.isArray((txBody as { items?: UserTransaction[] }).items) ? (txBody as { items: UserTransaction[] }).items : []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
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
    <div className="min-h-screen glass-bg text-[#f5fff7] p-4 md:p-6">
      <div className="max-w-6xl mx-auto glass-shell p-4 md:p-6 space-y-5">
        <div className="glass-panel p-5 flex items-center justify-between gap-4">
          <div>
            <div className="glass-kicker">Personal Space</div>
            <h1 className="glass-title mt-1">Личный кабинет</h1>
            <p className="text-sm glass-muted mt-1">{user?.email ?? 'Пользователь'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard/upload" className="glass-btn-dark">
              Загрузить лицензию
            </Link>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="glass-btn-soft"
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="glass-panel p-5">
          <p className="glass-kicker">Balance</p>
          <p className="text-3xl font-bold text-[#f5fff7] mt-1">{balance} Экокоинов</p>
        </div>

        {loading && <div className="glass-panel p-4 text-sm text-[#9ab3a5]">Загрузка данных...</div>}
        {error && <div className="glass-panel p-4 text-sm glass-danger">{error}</div>}

        {!loading && !error && (
          <>
            <section className="glass-panel p-3">
              <div className="px-3 py-2">
                <h2 className="text-base font-semibold text-[#f5fff7]">Мои лицензии</h2>
              </div>
              <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2">Организация</th>
                    <th className="text-left px-4 py-2">Регион</th>
                    <th className="text-left px-4 py-2">Статус</th>
                    <th className="text-left px-4 py-2">Награда</th>
                    <th className="text-left px-4 py-2">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <Link to={`/dashboard/licenses/${item.id}`} className="glass-link font-medium underline underline-offset-2">
                          {item.companyName}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{item.region ?? '—'}</td>
                      <td className="px-4 py-2">
                        {item.status === 'approved' ? 'Одобрена' : item.status === 'rejected' ? 'Отклонена' : 'На проверке'}
                        {item.status === 'rejected' && item.rejectionNote ? (
                          <div className="text-xs glass-danger mt-1">{item.rejectionNote}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">+{item.reward}</td>
                      <td className="px-4 py-2">{new Date(item.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {licenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-center text-[#9ab3a5]">
                        Лицензии пока не загружены
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              </div>
            </section>

            <section className="glass-panel p-3">
              <div className="px-3 py-2">
                <h2 className="text-base font-semibold text-[#f5fff7]">История начислений</h2>
              </div>
              <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2">Дата</th>
                    <th className="text-left px-4 py-2">Лицензия</th>
                    <th className="text-left px-4 py-2">Тип</th>
                    <th className="text-left px-4 py-2">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{item.companyName ?? `#${item.licenseId}`}</td>
                      <td className="px-4 py-2">{item.type}</td>
                      <td className="px-4 py-2 text-[#90e19a] font-medium">+{item.amount}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-center text-[#9ab3a5]">
                        Начислений пока нет
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
