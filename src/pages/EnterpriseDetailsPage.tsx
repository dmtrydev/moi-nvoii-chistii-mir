import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LicenseData } from '@/types';
import { formatFkkoHuman, normalizeFkkoDigits } from '@/utils/fkko';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { useAuth } from '@/contexts/useAuth';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

function decodeFkko(code: string): string {
  const digits = normalizeFkkoDigits(code);
  if (!/^\d{11}$/.test(digits)) return 'Расшифровка недоступна для этого формата кода';
  return `Класс: ${digits[0]}, группа: ${digits.slice(1, 3)}, подгруппа: ${digits.slice(3, 6)}, вид: ${digits.slice(6, 8)}, тип: ${digits.slice(8, 10)}, класс опасности: ${digits[10]}`;
}

function hazardClassesFromFkko(codes: string[]): string[] {
  const set = new Set<string>();
  for (const c of codes) {
    const digits = normalizeFkkoDigits(c);
    if (/^\d{11}$/.test(digits)) set.add(digits[10]);
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

type DetailTab = 'about' | 'fkko';

export default function EnterpriseDetailsPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<LicenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DetailTab>('about');
  const { accessToken, user } = useAuth();

  useEffect(() => {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      setLoading(false);
      setError('Некорректный идентификатор предприятия.');
      return;
    }
    let alive = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        if (accessToken) {
          const r = await fetch(getApiUrl(`/api/licenses/${numId}/extended`), {
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: 'include',
          });
          if (r.ok) {
            const data = (await r.json()) as LicenseData;
            if (!alive) return;
            setItem(data);
            return;
          }
        }

        const r2 = await fetch(getApiUrl(`/api/licenses/${numId}`));
        if (!r2.ok) throw new Error(`Ошибка ${r2.status}`);
        const data2 = (await r2.json()) as LicenseData;
        if (!alive) return;
        setItem(data2);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить карточку предприятия');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [id, accessToken]);

  const mapPath = useMemo(() => {
    if (!item?.id) return '/map';
    const params = new URLSearchParams();
    const firstFkko = Array.isArray(item.fkkoCodes) && item.fkkoCodes.length > 0 ? item.fkkoCodes[0] : '';
    const activities = Array.isArray(item.activityTypes) ? item.activityTypes.join(', ') : '';
    if (firstFkko) params.set('fkko', firstFkko);
    if (activities) params.set('vid', activities);
    const sites = Array.isArray(item.sites) ? item.sites : [];
    const firstSiteId = sites.length > 0 && typeof sites[0].id === 'number' ? sites[0].id : null;
    if (firstSiteId != null) params.set('focusSite', String(firstSiteId));
    return `/map?${params.toString()}`;
  }, [item]);

  const fkkoCodes = useMemo(() => (Array.isArray(item?.fkkoCodes) ? item.fkkoCodes : []), [item?.fkkoCodes]);
  const hazardClasses = useMemo(() => hazardClassesFromFkko(fkkoCodes), [fkkoCodes]);
  const activityList =
    Array.isArray(item?.activityTypes) && item.activityTypes.length > 0
      ? item.activityTypes.join(', ')
      : 'не указаны';
  const sites = Array.isArray(item?.sites) ? item.sites : [];

  const isAdmin = user?.role === 'SUPERADMIN';
  const isOwner = user && item?.ownerUserId != null && Number(item.ownerUserId) === user.id;

  async function downloadPdf(): Promise<void> {
    if (!accessToken || !item?.id || !item.fileStoredName) return;
    const res = await fetch(getApiUrl(`/api/licenses/${item.id}/file`), {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Не удалось скачать файл');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileOriginalName || 'license.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function approveCurrent(): Promise<void> {
    if (!accessToken || !item?.id) return;
    const res = await fetch(getApiUrl(`/api/admin/licenses/${item.id}/approve`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Не удалось одобрить');
    const body = await res.json().catch(() => ({}));
    if (!body?.license) {
      // ничего не делаем, просто обновим карточку
    }
    // Перезагрузка данных через полный reload страницы (быстрее/надёжнее для текущего объёма).
    window.location.reload();
  }

  async function rejectCurrent(): Promise<void> {
    if (!accessToken || !item?.id) return;
    const note = window.prompt('Введите причину отклонения (будет отображаться заявителю):') ?? '';
    const res = await fetch(getApiUrl(`/api/admin/licenses/${item.id}/reject`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error('Не удалось отклонить');
    window.location.reload();
  }

  return (
    <div className="min-h-screen glass-bg text-ink page-enter">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-10 pb-14">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            to="/"
            className="glass-btn-soft inline-flex items-center justify-center h-11 px-5 text-sm font-medium"
          >
            На главную
          </Link>
          <Link
            to={mapPath}
            className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow shadow-sm"
          >
            Показать на карте
          </Link>
        </div>

        {loading && <p className="text-ink-muted">Загрузка карточки предприятия...</p>}
        {!loading && error && <p className="glass-danger">{error}</p>}

        {!loading && !error && item && (
          <div className="rounded-3xl bg-surface shadow-eco-card overflow-hidden">
            <header className="relative overflow-hidden bg-gradient-to-br from-white via-app-bg to-[#f0fce8] px-6 py-10 sm:px-10 sm:py-12">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%235fd93a' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f5c14]">Предприятие</p>
                <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight leading-tight max-w-3xl text-ink">
                  {item.companyName || 'Организация'}
                </h1>
                {(sites.length > 0 || item.address) && (
                  <div className="mt-5 space-y-2 max-w-3xl">
                    {sites.length > 0
                      ? sites.map((s, i) => (
                          <p key={s.id ?? i} className="flex items-start gap-2 text-sm text-ink/90 leading-relaxed">
                            <svg
                              className="mt-0.5 h-4 w-4 shrink-0 text-[#3d9a2f]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden
                            >
                              <path
                                d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle cx="12" cy="10" r="2.5" />
                            </svg>
                            <span>{s.address || 'Адрес не указан'}</span>
                          </p>
                        ))
                      : item.address && (
                          <p className="flex items-start gap-2 text-sm text-ink/90 leading-relaxed">
                            <svg
                              className="mt-0.5 h-4 w-4 shrink-0 text-[#3d9a2f]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden
                            >
                              <path
                                d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle cx="12" cy="10" r="2.5" />
                            </svg>
                            <span>{item.address}</span>
                          </p>
                        )}
                  </div>
                )}
              </div>
            </header>

            <div className="border-b border-black/[0.06] bg-app-bg/50 px-4 sm:px-8">
              <nav className="flex gap-2 pt-2" aria-label="Разделы карточки">
                <button
                  type="button"
                  onClick={() => setTab('about')}
                  className={[
                    'relative px-5 py-3.5 text-sm font-semibold transition-all rounded-t-2xl',
                    tab === 'about'
                      ? 'text-ink bg-surface shadow-[0_-4px_20px_rgba(15,23,42,0.06)]'
                      : 'text-ink-muted hover:text-ink hover:bg-white/60',
                  ].join(' ')}
                >
                  Сводка
                  {tab === 'about' && (
                    <span className="absolute bottom-0 left-4 right-4 h-1 rounded-full bg-gradient-to-r from-accent-from to-accent-to" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('fkko')}
                  className={[
                    'relative px-5 py-3.5 text-sm font-semibold transition-all rounded-t-2xl',
                    tab === 'fkko'
                      ? 'text-ink bg-surface shadow-[0_-4px_20px_rgba(15,23,42,0.06)]'
                      : 'text-ink-muted hover:text-ink hover:bg-white/60',
                  ].join(' ')}
                >
                  Коды ФККО
                  {fkkoCodes.length > 0 && (
                    <span className="ml-2 inline-flex min-w-[1.35rem] justify-center rounded-lg bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-[#1f5c14] tabular-nums">
                      {fkkoCodes.length}
                    </span>
                  )}
                  {tab === 'fkko' && (
                    <span className="absolute bottom-0 left-4 right-4 h-1 rounded-full bg-gradient-to-r from-accent-from to-accent-to" />
                  )}
                </button>
              </nav>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              {tab === 'about' && (
                <div className="space-y-8">
                  <section aria-labelledby="activity-strip-label">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 id="activity-strip-label" className="text-base font-semibold text-ink">
                          Виды деятельности
                        </h2>
                        <p className="mt-1 text-sm text-ink-muted max-w-xl">
                          Круги подсвечены, если в данных есть соответствующий вид работ (по ключевым словам в списке).
                        </p>
                      </div>
                      <EnterpriseActivityStrip activityTypes={item.activityTypes} variant="light" size="md" />
                    </div>
                    <p className="mt-4 text-sm text-ink rounded-2xl bg-app-bg px-5 py-4 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Как в лицензии</span>
                      <span className="block mt-2 leading-relaxed">{activityList}</span>
                    </p>
                  </section>

                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-app-bg p-5 shadow-sm">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">ИНН</h3>
                      <p className="mt-3 font-mono text-xl font-semibold text-ink tabular-nums">
                        {item.inn || '—'}
                      </p>
                    </div>
                    {hazardClasses.length > 0 && (
                      <div className="rounded-2xl bg-app-bg p-5 shadow-sm sm:col-span-2 lg:col-span-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                          Классы опасности (по ФККО)
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hazardClasses.map((hc) => (
                            <span
                              key={hc}
                              className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl bg-accent-soft px-3 text-sm font-bold text-[#1f5c14]"
                            >
                              {hc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl bg-app-bg p-5 sm:p-6 shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">Адрес</h3>
                    <p className="mt-3 text-sm text-ink leading-relaxed">{item.address || 'не указан'}</p>
                  </section>

                  {sites.length > 0 && (
                    <section className="rounded-2xl bg-app-bg p-5 sm:p-6 shadow-sm">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                        Площадки ({sites.length})
                      </h3>
                      <div className="mt-4 space-y-4">
                        {sites.map((s, idx) => (
                          <div key={s.id ?? idx} className="rounded-xl bg-surface p-4 shadow-eco-card">
                            <p className="text-sm text-ink font-semibold">
                              {s.siteLabel || `Площадка ${idx + 1}`}
                            </p>
                            <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                              {s.address || '—'}
                            </p>
                            {Array.isArray(s.entries) && s.entries.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {s.entries.map((entry, eIdx) => (
                                  <div key={eIdx} className="rounded-xl bg-app-bg px-3 py-2.5">
                                    <p className="text-xs text-[#1f5c14] font-mono font-medium">
                                      {formatFkkoHuman(entry.fkkoCode)}
                                      {entry.hazardClass ? ` — ${entry.hazardClass} класс` : ''}
                                    </p>
                                    {entry.wasteName && (
                                      <p className="text-[11px] text-ink-muted mt-1 leading-tight">{entry.wasteName}</p>
                                    )}
                                    <p className="text-xs text-ink mt-1">
                                      {entry.activityTypes.join(', ')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                <p className="mt-2 text-xs text-ink-muted">
                                  Виды: {Array.isArray(s.activityTypes) && s.activityTypes.length ? s.activityTypes.join(', ') : '—'}
                                </p>
                                <p className="mt-1 text-xs text-ink-muted">
                                  ФККО: {Array.isArray(s.fkkoCodes) && s.fkkoCodes.length ? s.fkkoCodes.map(formatFkkoHuman).join(', ') : '—'}
                                </p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {tab === 'fkko' && (
                <section>
                  <h2 className="text-xl font-semibold text-ink">Коды ФККО с расшифровкой</h2>
                  <p className="mt-2 text-sm text-ink-muted">
                    Структура кода: класс, группа, подгруппа, вид, тип и класс опасности отхода.
                  </p>
                  {fkkoCodes.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      {fkkoCodes.map((code) => (
                        <div
                          key={code}
                          className="rounded-2xl bg-app-bg p-5 shadow-sm hover:shadow-eco-card transition-shadow"
                        >
                          <p className="text-sm font-semibold text-[#1f5c14]">{formatFkkoHuman(code)}</p>
                          <p className="mt-2 text-xs text-ink-muted leading-relaxed">{decodeFkko(code)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-ink-muted">Коды ФККО не указаны.</p>
                  )}
                </section>
              )}

              {(item?.status || item?.reward || item?.rejectionNote || item?.fileStoredName) && (
                <section className="mt-10 rounded-2xl bg-app-bg p-6 sm:p-7 shadow-sm">
                  <h2 className="text-lg font-semibold text-ink">Модерация и документ</h2>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-ink-muted">
                      {item.status ? (
                        <>
                          Статус:{' '}
                          <span className="font-semibold text-ink">
                            {item.status === 'pending' ? 'На проверке' : item.status === 'approved' ? 'Одобрена' : 'Отклонена'}
                          </span>
                        </>
                      ) : (
                        <span>Статус не указан</span>
                      )}
                      {typeof item.reward === 'number' ? (
                        <div className="mt-1">
                          Награда: <span className="font-semibold text-[#1f5c14]">+{item.reward} Экокоинов</span>
                        </div>
                      ) : null}
                      {item.status === 'rejected' && item.rejectionNote ? (
                        <div className="mt-1 glass-danger text-sm">Причина: {item.rejectionNote}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(isAdmin || isOwner) && item.fileStoredName ? (
                        <button
                          type="button"
                          onClick={() => {
                            void downloadPdf();
                          }}
                          className="px-5 py-2.5 rounded-2xl glass-btn-dark text-sm font-semibold"
                        >
                          Скачать файл (PDF)
                        </button>
                      ) : null}

                      {isAdmin && item.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void approveCurrent().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
                            }}
                            className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            Одобрить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void rejectCurrent().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
                            }}
                            className="px-5 py-2.5 rounded-2xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
                          >
                            Отклонить
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
