import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import type { LicenseData } from '@/types';
import { formatFkkoHuman } from '@/utils/fkko';

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

  const [entQuery, setEntQuery] = useState('');
  const [entResults, setEntResults] = useState<LicenseData[]>([]);
  const [entSearching, setEntSearching] = useState(false);
  const [entError, setEntError] = useState('');
  const [entSearched, setEntSearched] = useState(false);

  const runEnterpriseSearch = useCallback(async () => {
    const q = entQuery.trim();
    if (!q) return;
    setEntSearched(true);
    setEntSearching(true);
    setEntError('');
    try {
      const isInn = /^\d{3,12}$/.test(q);
      const qs = new URLSearchParams();
      if (isInn) qs.set('inn', q);
      else qs.set('companyName', q);
      const r = await fetch(getApiUrl(`/api/search/enterprises?${qs.toString()}`));
      const data = await (r.ok ? r.json() : r.json().catch(() => ({})));
      if (!r.ok) throw new Error((data as { message?: string }).message ?? String(r.status));
      const items = (data as { items?: LicenseData[] }).items;
      setEntResults(Array.isArray(items) ? items : []);
    } catch (err) {
      setEntResults([]);
      setEntError(err instanceof Error ? err.message : 'Ошибка поиска');
    } finally {
      setEntSearching(false);
    }
  }, [entQuery]);

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
    <div className="w-full max-w-6xl mx-auto space-y-6 page-enter">
      <div className="space-y-6">
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
          <p className="text-3xl font-bold text-ink mt-1">{balance} Экокоинов</p>
        </div>

        <section className="glass-panel p-5 space-y-4">
          <div>
            <p className="glass-kicker">Enterprise Search</p>
            <h2 className="text-base font-semibold text-ink mt-1">Поиск организации</h2>
            <p className="text-xs glass-muted mt-1">Введите название компании или ИНН — достаточно одного</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              <input
                type="text"
                value={entQuery}
                onChange={(e) => { setEntQuery(e.target.value); setEntSearched(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void runEnterpriseSearch(); }}
                placeholder="ООО Экология или 7712345678"
                className="glass-input !h-10 pl-9 pr-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void runEnterpriseSearch()}
              disabled={!entQuery.trim() || entSearching}
              className="glass-btn-dark h-10 px-5 text-sm font-medium disabled:opacity-40"
            >
              {entSearching ? 'Поиск...' : 'Найти'}
            </button>
          </div>

          {entSearched && !entSearching && entError && (
            <div className="text-sm glass-danger">{entError}</div>
          )}

          {entSearched && !entSearching && !entError && entResults.length === 0 && (
            <div className="text-sm text-ink-muted">Ничего не найдено по запросу «{entQuery.trim()}»</div>
          )}

          {entResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                Найдено: {entResults.length}{entResults.length >= 200 ? '+' : ''}
              </p>
              <div className="glass-table-wrap">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-2">Организация</th>
                      <th className="text-left px-4 py-2">ИНН</th>
                      <th className="text-left px-4 py-2">Адрес площадки</th>
                      <th className="text-left px-4 py-2">ФККО</th>
                      <th className="text-left px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {entResults.slice(0, 30).map((it) => {
                      const id = typeof it.id === 'number' ? it.id : null;
                      const fkkoCodes = Array.isArray(it.fkkoCodes) ? it.fkkoCodes : [];
                      return (
                        <tr key={it.siteId ?? `${it.companyName}-${it.address}`} className="border-t border-black/[0.06]">
                          <td className="px-4 py-2.5 font-medium text-ink max-w-[220px]">
                            <span className="line-clamp-2">{it.companyName || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-ink whitespace-nowrap">
                            {it.inn || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-ink-muted max-w-[260px]">
                            <span className="line-clamp-2">{it.address || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {fkkoCodes.slice(0, 3).map((c) => (
                                <span key={c} className="rounded-lg bg-app-bg px-1.5 py-0.5 text-[11px] font-mono text-ink">
                                  {formatFkkoHuman(c)}
                                </span>
                              ))}
                              {fkkoCodes.length > 3 && (
                                <span className="text-[11px] text-ink-muted">+{fkkoCodes.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {id != null && (
                              <Link to={`/enterprise/${id}`} className="glass-link text-xs whitespace-nowrap">
                                Подробнее
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {entResults.length > 30 && (
                <p className="text-xs text-ink-muted">Показаны первые 30 результатов</p>
              )}
            </div>
          )}
        </section>

        {loading && <div className="glass-panel p-4 text-sm text-ink-muted">Загрузка данных...</div>}
        {error && <div className="glass-panel p-4 text-sm glass-danger">{error}</div>}

        {!loading && !error && (
          <>
            <section className="glass-panel p-3">
              <div className="px-3 py-2">
                <h2 className="text-base font-semibold text-ink">Мои лицензии</h2>
              </div>
              <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2">Организация</th>
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
                      <td className="px-4 py-2">
                        {item.status === 'approved'
                          ? 'Одобрена'
                          : item.status === 'recheck'
                            ? 'На перепроверке'
                            : item.status === 'rejected'
                              ? 'Отклонена'
                              : 'На проверке'}
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
                      <td colSpan={4} className="px-4 py-3 text-center text-ink-muted">
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
                <h2 className="text-base font-semibold text-ink">История начислений</h2>
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
                      <td className="px-4 py-2 text-[#1f5c14] font-semibold">+{item.amount}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-center text-ink-muted">
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
