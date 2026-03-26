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
    params.set('focus', String(item.id));
    return `/map?${params.toString()}`;
  }, [item?.id]);

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
    <div className="min-h-screen glass-bg text-[#f5fff7]">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-10 pb-12">
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            to="/"
            className="glass-btn-soft inline-flex items-center justify-center h-9 px-4 text-xs font-medium"
          >
            На главную
          </Link>
          <Link
            to={mapPath}
            className="inline-flex items-center justify-center h-9 rounded-xl bg-[#4caf50] px-4 text-xs font-medium text-white hover:bg-[#43a047] transition-colors shadow-sm"
          >
            Показать на карте
          </Link>
        </div>

        {loading && <p className="text-[#a3bcaf]">Загрузка карточки предприятия...</p>}
        {!loading && error && <p className="glass-danger">{error}</p>}

        {!loading && !error && item && (
          <div className="rounded-2xl border border-[#79c784]/28 bg-[#0f1f17]/72 shadow-2xl overflow-hidden backdrop-blur-xl">
            <header className="relative overflow-hidden bg-[#1a3527] px-5 py-8 sm:px-8 sm:py-10 text-white">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8f5bb]">Предприятие</p>
                <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight leading-tight max-w-3xl">
                  {item.companyName || 'Организация'}
                </h1>
                {(item.address || item.region) && (
                  <p className="mt-4 flex items-start gap-2 text-sm text-white/85 max-w-3xl leading-relaxed">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#b8f5bb]"
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
                    <span>
                      {[item.region, item.address].filter(Boolean).join(item.region && item.address ? ', ' : '') ||
                        'Адрес не указан'}
                    </span>
                  </p>
                )}
              </div>
            </header>

            <div className="border-b border-[#73bd7e]/24 bg-white/5 px-4 sm:px-6">
              <nav className="flex gap-1" aria-label="Разделы карточки">
                <button
                  type="button"
                  onClick={() => setTab('about')}
                  className={[
                    'relative px-4 py-3 text-sm font-medium transition-colors rounded-t-lg',
                    tab === 'about'
                      ? 'text-[#c4f5cc] bg-white/10 shadow-[0_-1px_0_0_rgba(160,240,172,0.24)]'
                      : 'text-[#9ab3a5] hover:text-[#f5fff7]',
                  ].join(' ')}
                >
                  Сводка
                  {tab === 'about' && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#4caf50]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('fkko')}
                  className={[
                    'relative px-4 py-3 text-sm font-medium transition-colors rounded-t-lg',
                    tab === 'fkko'
                      ? 'text-[#c4f5cc] bg-white/10 shadow-[0_-1px_0_0_rgba(160,240,172,0.24)]'
                      : 'text-[#9ab3a5] hover:text-[#f5fff7]',
                  ].join(' ')}
                >
                  Коды ФККО
                  {fkkoCodes.length > 0 && (
                    <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-md bg-white/12 px-1 text-[11px] font-semibold text-[#d6e7dd] tabular-nums">
                      {fkkoCodes.length}
                    </span>
                  )}
                  {tab === 'fkko' && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#4caf50]" />
                  )}
                </button>
              </nav>
            </div>

            <div className="p-5 sm:p-6 lg:p-8">
              {tab === 'about' && (
                <div className="space-y-6">
                  <section aria-labelledby="activity-strip-label">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 id="activity-strip-label" className="text-sm font-semibold text-[#ecf8ef]">
                          Виды деятельности
                        </h2>
                        <p className="mt-1 text-xs text-[#9ab3a5] max-w-xl">
                          Круги подсвечены, если в данных есть соответствующий вид работ (по ключевым словам в списке).
                        </p>
                      </div>
                      <EnterpriseActivityStrip activityTypes={item.activityTypes} variant="light" size="md" />
                    </div>
                    <p className="mt-3 text-sm text-[#d5e6dc] rounded-xl border border-[#78c483]/26 bg-white/5 px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#8faea0]">Как в лицензии</span>
                      <span className="block mt-1">{activityList}</span>
                    </p>
                  </section>

                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#78c483]/24 bg-white/5 p-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8faea0]">ИНН</h3>
                      <p className="mt-2 font-mono text-lg font-semibold text-[#ecf8ef] tabular-nums">
                        {item.inn || '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#78c483]/24 bg-white/5 p-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8faea0]">Регион</h3>
                      <p className="mt-2 text-sm font-medium text-[#ecf8ef] leading-snug">{item.region || '—'}</p>
                    </div>
                    {hazardClasses.length > 0 && (
                      <div className="rounded-xl border border-[#78c483]/24 bg-white/5 p-4 sm:col-span-2 lg:col-span-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8faea0]">
                          Классы опасности (по ФККО)
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {hazardClasses.map((hc) => (
                            <span
                              key={hc}
                              className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-[#4caf50]/20 px-2.5 text-sm font-bold text-[#d8ffe0] ring-1 ring-[#84da91]/40"
                            >
                              {hc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-[#78c483]/24 bg-white/5 p-4 sm:p-5">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8faea0]">Адрес</h3>
                    <p className="mt-2 text-sm text-[#d5e6dc] leading-relaxed">{item.address || 'не указан'}</p>
                  </section>

                  {sites.length > 1 && (
                    <section className="rounded-xl border border-[#78c483]/24 bg-white/5 p-4 sm:p-5">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8faea0]">Площадки</h3>
                      <div className="mt-3 space-y-3">
                        {sites.map((s, idx) => (
                          <div key={s.id ?? idx} className="rounded-lg border border-[#78c483]/18 bg-black/10 p-3">
                            <p className="text-sm text-[#ecf8ef] font-medium">
                              {s.siteLabel || `Площадка ${idx + 1}`}
                            </p>
                            <p className="mt-1 text-sm text-[#d5e6dc] leading-relaxed">
                              {s.address || '—'}
                            </p>
                            <p className="mt-2 text-xs text-[#a6beaf]">
                              Виды: {Array.isArray(s.activityTypes) && s.activityTypes.length ? s.activityTypes.join(', ') : '—'}
                            </p>
                            <p className="mt-1 text-xs text-[#a6beaf]">
                              ФККО: {Array.isArray(s.fkkoCodes) && s.fkkoCodes.length ? s.fkkoCodes.map(formatFkkoHuman).join(', ') : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {tab === 'fkko' && (
                <section>
                  <h2 className="text-lg font-semibold text-[#ecf8ef]">Коды ФККО с расшифровкой</h2>
                  <p className="mt-1 text-sm text-[#9ab3a5]">
                    Структура кода: класс, группа, подгруппа, вид, тип и класс опасности отхода.
                  </p>
                  {fkkoCodes.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {fkkoCodes.map((code) => (
                        <div
                          key={code}
                          className="rounded-xl border border-[#78c483]/24 bg-white/5 p-4 hover:border-[#84da91]/45 transition-colors"
                        >
                          <p className="text-sm font-semibold text-[#c8f8d0]">{formatFkkoHuman(code)}</p>
                          <p className="mt-1 text-xs text-[#a6beaf] leading-relaxed">{decodeFkko(code)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[#9ab3a5]">Коды ФККО не указаны.</p>
                  )}
                </section>
              )}

              {(item?.status || item?.reward || item?.rejectionNote || item?.fileStoredName) && (
                <section className="mt-8 rounded-xl border border-[#78c483]/24 bg-white/5 p-4 sm:p-5">
                  <h2 className="text-base font-semibold text-[#ecf8ef]">Модерация и документ</h2>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-[#c4d9cd]">
                      {item.status ? (
                        <>
                          Статус: <span className="font-semibold">{item.status === 'pending' ? 'На проверке' : item.status === 'approved' ? 'Одобрена' : 'Отклонена'}</span>
                        </>
                      ) : (
                        <span>Статус не указан</span>
                      )}
                      {typeof item.reward === 'number' ? (
                        <div className="mt-1">
                          Награда: <span className="font-semibold text-[#c8f8d0]">+{item.reward} Экокоинов</span>
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
                          className="px-4 py-2 rounded-lg bg-[#4caf50] text-white text-sm font-medium hover:bg-[#43a047] transition-colors shadow-sm"
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
                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                          >
                            Одобрить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void rejectCurrent().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
                            }}
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
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
