import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ContactsMenu } from '@/components/ui/ContactsMenu';
import { formatFkkoHuman, normalizeFkkoDigits } from '@/utils/fkko';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(p: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}${p.startsWith('/') ? p : `/${p}`}` : p;
}

const fieldClass = 'liquid-field';

export default function FkkoDirectoryPage(): JSX.Element {
  const sections = useMemo(() => [{ id: 'fkko', title: 'ФККО' }], []);
  const [activeSection, setActiveSection] = useState<string>('fkko');

  const [codes, setCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => normalizeFkkoDigits(query), [query]);

  const [page, setPage] = useState(0);
  const pageSize = 500;

  const [copiedCode, setCopiedCode] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError('');

    fetch(getApiUrl('/api/filters/fkko'))
      .then((r) => (r.ok ? r.json() : r.json().catch(() => ({ message: `HTTP ${r.status}` }))))
      .then((data: { fkko?: unknown }) => {
        if (!alive) return;
        const raw = Array.isArray(data.fkko) ? data.fkko : [];
        const normalized = raw
          .map((x: unknown) => normalizeFkkoDigits(String(x)))
          .filter(Boolean)
          // keep stable order from API
          .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);
        setCodes(normalized);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки кодов ФККО');
        setCodes([]);
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setPage(0);
    setCopiedCode('');
  }, [normalizedQuery]);

  const filteredCodes = useMemo(() => {
    if (!normalizedQuery) return codes;
    return codes.filter((c) => normalizeFkkoDigits(c).includes(normalizedQuery));
  }, [codes, normalizedQuery]);

  const visibleCodes = useMemo(() => {
    return filteredCodes.slice(0, (page + 1) * pageSize);
  }, [filteredCodes, page]);

  const canLoadMore = visibleCodes.length < filteredCodes.length;

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      const text = normalizeFkkoDigits(value);
      if (!text) return;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: create temporary textarea
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      setCopiedCode(text);
      window.setTimeout(() => setCopiedCode(''), 1500);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex flex-col w-full min-h-screen glass-bg page-enter">
      <main className="relative z-10 w-full max-w-[1510px] mx-auto px-4 sm:px-6 md:px-8 lg:px-[50px] py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors">
            Назад на главную
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">Справочник</span>
          </div>
        </div>

        <div className="flex gap-6 items-start">
          <aside className="w-full max-w-[320px] glass-panel p-4 sm:p-5 md:p-6">
            <h2 className="text-sm font-semibold text-ink mb-3">Разделы</h2>
            <div className="space-y-2">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all ${
                    activeSection === s.id
                      ? 'bg-accent-soft border-transparent text-[#1f5c14] font-semibold shadow-sm'
                      : 'bg-app-bg border-black/[0.06] text-ink-muted hover:bg-white'
                  }`}
                >
                  {s.title}
                </button>
              ))}
              <div className="text-xs text-ink-muted pt-2">Темы и другие разделы добавятся позже.</div>
            </div>
          </aside>

          <section className="flex-1 glass-panel p-4 sm:p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-ink">{activeSection === 'fkko' ? 'ФККО: коды отходов' : 'Раздел'}</h2>

              <div className="text-xs text-ink-muted">
                {error ? '' : isLoading ? '' : `Показано: ${visibleCodes.length} / ${filteredCodes.length}`}
              </div>
            </div>

            {activeSection === 'fkko' && (
              <>
                <div className="rounded-2xl bg-app-bg border border-black/[0.06] p-4 mb-4">
                  <p className="text-xs text-ink-muted leading-relaxed">
                    В этом разделе отображаются все коды ФККО, которые встречаются в лицензиях проекта. Описание
                    каждого кода будет подключено отдельным источником данных.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">Поиск по коду</p>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Например: 7 31 100 01 40 4"
                      className={fieldClass}
                    />
                  </div>
                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="text-sm text-ink-muted">{isLoading ? 'Загрузка...' : `Найдено: ${filteredCodes.length}`}</div>
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="text-xs text-ink-muted hover:text-ink transition-colors"
                      disabled={!query}
                    >
                      Сбросить
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm glass-danger">{error}</p>}

                {(!error && isLoading) && <p className="text-sm text-ink-muted">Загрузка списка...</p>}

                {!error && !isLoading && filteredCodes.length === 0 && (
                  <p className="text-sm text-ink-muted">По вашему запросу коды не найдены.</p>
                )}

                {!error && !isLoading && filteredCodes.length > 0 && (
                  <div className="max-h-[62vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {visibleCodes.map((c) => {
                        const human = formatFkkoHuman(c);
                        return (
                          <div
                            key={c}
                            className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-app-bg px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                                {human}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void copyToClipboard(c)}
                              className="text-xs text-ink-muted hover:text-[#1f5c14] transition-colors flex-shrink-0 font-medium"
                              aria-label={`Копировать код ФККО ${human}`}
                            >
                              {copiedCode === c ? 'Готово' : 'Копировать'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {canLoadMore && (
                      <div className="mt-5 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setPage((p) => p + 1)}
                          className="h-11 rounded-2xl text-sm font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow shadow-sm px-6"
                        >
                          Показать ещё
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <ContactsMenu />
    </div>
  );
}

