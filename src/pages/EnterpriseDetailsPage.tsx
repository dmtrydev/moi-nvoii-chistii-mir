import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { FkkoEntry, LicenseData, LicenseSiteData } from '@/types';
import { formatFkkoHuman, normalizeFkkoDigits } from '@/utils/fkko';
import { EnterpriseActivityStrip } from '@/components/licenses/EnterpriseActivityStrip';
import { RpnLicenseStateCard } from '@/components/licenses/RpnLicenseStateCard';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';
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

function cloneForEdit(data: LicenseData): LicenseData {
  return JSON.parse(JSON.stringify(data)) as LicenseData;
}

/** Площадки без записей ФККО разворачиваем в строки для удобного редактирования. */
function ensureDraftSites(d: LicenseData): LicenseData {
  const copy = cloneForEdit(d);
  if (!copy.sites || copy.sites.length === 0) {
    copy.sites = [
      {
        address: copy.address || '',
        region: copy.region ?? null,
        siteLabel: 'Основная площадка',
        lat: copy.lat ?? null,
        lng: copy.lng ?? null,
        fkkoCodes: [...(copy.fkkoCodes || [])],
        activityTypes: [...(copy.activityTypes || [])],
        entries: [],
      },
    ];
  }
  copy.sites = copy.sites.map((s) => {
    if (s.entries && s.entries.length > 0) return { ...s };
    const fc = s.fkkoCodes || [];
    const at = s.activityTypes || [];
    if (fc.length > 0) {
      return {
        ...s,
        entries: fc.map((code) => ({
          fkkoCode: code,
          wasteName: undefined,
          hazardClass: undefined,
          activityTypes: [...at],
        })),
      };
    }
    return {
      ...s,
      entries: [{ fkkoCode: '', wasteName: undefined, hazardClass: undefined, activityTypes: [''] }],
    };
  });
  return copy;
}

function buildPatchBody(d: LicenseData): Record<string, unknown> {
  const sitePayloads = (d.sites ?? []).map((s) => {
    const base: Record<string, unknown> = {
      siteLabel: s.siteLabel ?? null,
      address: s.address ?? '',
      region: s.region ?? null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
    };
    if (typeof s.id === 'number' && s.id > 0) {
      base.id = s.id;
    }
    if (s.entries && s.entries.length > 0) {
      base.entries = s.entries.map((e) => ({
        fkkoCode: e.fkkoCode,
        wasteName: e.wasteName ?? null,
        hazardClass: e.hazardClass ?? null,
        activityTypes: e.activityTypes,
      }));
    } else {
      base.fkkoCodes = s.fkkoCodes ?? [];
      base.activityTypes = s.activityTypes ?? [];
    }
    return base;
  });

  return {
    companyName: d.companyName,
    inn: d.inn,
    address: d.address ?? '',
    region: d.region ?? '',
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    fkkoCodes: d.fkkoCodes ?? [],
    activityTypes: d.activityTypes ?? [],
    sites: sitePayloads,
  };
}

const inputClass =
  'mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5fd93a]/40';

type DetailTab = 'about' | 'fkko';

function moderationStatusLabel(status: string | null | undefined): string {
  if (status === 'approved') return 'Одобрена';
  if (status === 'recheck') return 'На перепроверке';
  if (status === 'rejected') return 'Отклонена';
  return 'На проверке';
}

export default function EnterpriseDetailsPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [item, setItem] = useState<LicenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DetailTab>('about');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LicenseData | null>(null);
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState('');
  /** Ключ вида `license` или `site-0` во время запроса к /api/geocode */
  const [geocodeTarget, setGeocodeTarget] = useState<string | null>(null);
  const { user } = useAuth();
  const fromAdminList = typeof (location.state as { from?: unknown } | null)?.from === 'string'
    ? ((location.state as { from?: string }).from ?? '/admin/licenses')
    : '/admin/licenses';

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
        const r = await fetch(getApiUrl(`/api/licenses/${numId}/extended`), {
          credentials: 'include',
        });
        if (r.ok) {
          const data = (await r.json()) as LicenseData;
          if (!alive) return;
          setItem(data);
          return;
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
  }, [id]);

  const canModerate = user?.role === 'MODERATOR' || user?.role === 'SUPERADMIN';
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const display = canModerate && editing && draft ? draft : item;

  const mapPath = useMemo(() => {
    const src = display;
    if (!src?.id) return '/map';
    const params = new URLSearchParams();
    const firstFkko = Array.isArray(src.fkkoCodes) && src.fkkoCodes.length > 0 ? src.fkkoCodes[0] : '';
    const activities = Array.isArray(src.activityTypes) ? src.activityTypes.join(', ') : '';
    if (firstFkko) params.set('fkko', firstFkko);
    if (activities) params.set('vid', activities);
    const sitesList = Array.isArray(src.sites) ? src.sites : [];
    const firstSiteId = sitesList.length > 0 && typeof sitesList[0].id === 'number' ? sitesList[0].id : null;
    if (firstSiteId != null) params.set('focusSite', String(firstSiteId));
    return `/map?${params.toString()}`;
  }, [display]);

  const fkkoCodes = useMemo(
    () => (Array.isArray(display?.fkkoCodes) ? display.fkkoCodes : []),
    [display?.fkkoCodes],
  );
  const hazardClasses = useMemo(() => hazardClassesFromFkko(fkkoCodes), [fkkoCodes]);
  const activityList =
    Array.isArray(display?.activityTypes) && display.activityTypes.length > 0
      ? display.activityTypes.join(', ')
      : 'не указаны';
  const sites = Array.isArray(display?.sites) ? display.sites : [];

  const isOwner = user && item?.ownerUserId != null && Number(item.ownerUserId) === user.id;

  async function downloadPdf(): Promise<void> {
    if (!item?.id || !item.fileStoredName) return;
    const res = await fetch(getApiUrl(`/api/licenses/${item.id}/file`), {
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
    if (!item?.id) return;
    const res = await fetch(getApiUrl(`/api/admin/licenses/${item.id}/approve`), {
      method: 'POST',
      credentials: 'include',
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(body.message ?? 'Не удалось одобрить');
    // Перезагрузка данных через полный reload страницы (быстрее/надёжнее для текущего объёма).
    window.location.reload();
  }

  async function rejectCurrent(): Promise<void> {
    if (!item?.id) return;
    const note = window.prompt('Введите причину отклонения (будет отображаться заявителю):') ?? '';
    const res = await fetch(getApiUrl(`/api/admin/licenses/${item.id}/reject`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error('Не удалось отклонить');
    window.location.reload();
  }

  async function markCurrentAsRecheck(): Promise<void> {
    if (!item?.id) return;
    const res = await fetch(getApiUrl(`/api/admin/licenses/${item.id}/recheck`), {
      method: 'POST',
      credentials: 'include',
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(body.message ?? 'Не удалось отправить на перепроверку');
    window.location.reload();
  }

  async function hardDeleteCurrent(): Promise<void> {
    if (!item?.id || !isSuperAdmin) return;
    const first = window.confirm(
      'Полностью удалить карточку из БД? Данные нельзя восстановить. Это действие только для SUPERADMIN.',
    );
    if (!first) return;
    const token = window.prompt('Введите DELETE для подтверждения:') ?? '';
    if (token !== 'DELETE') {
      alert('Подтверждение не пройдено: нужно ввести DELETE');
      return;
    }
    const res = await fetch(getApiUrl(`/api/admin/licenses/${item.id}/hard`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(body.message ?? 'Не удалось удалить из БД');
    window.location.href = '/admin/licenses';
  }

  async function applyGeocodeToDraft(kind: 'license' | 'site', siteIdx?: number): Promise<void> {
    if (!draft) return;
    setPatchError('');
    const address =
      kind === 'license'
        ? String(draft.address ?? '').trim()
        : String(draft.sites?.[siteIdx ?? -1]?.address ?? '').trim();
    if (!address) {
      setPatchError(
        kind === 'license'
          ? 'Укажите адрес в поле «Адрес (строка лицензии)».'
          : 'Укажите адрес этой площадки.',
      );
      return;
    }
    const key = kind === 'license' ? 'license' : `site-${siteIdx}`;
    setGeocodeTarget(key);
    try {
      const r = await fetch(getApiUrl(`/api/geocode?address=${encodeURIComponent(address)}`));
      const data = (await r.json().catch(() => ({}))) as { lat?: number; lng?: number; message?: string };
      if (!r.ok) {
        throw new Error(data.message ?? `Ошибка ${r.status}`);
      }
      const { lat, lng } = data;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new Error('Сервер не вернул координаты');
      }
      if (kind === 'license') {
        setDraft((prev) => (prev ? { ...prev, lat, lng } : prev));
      } else if (siteIdx != null) {
        setDraft((prev) => {
          if (!prev?.sites?.[siteIdx]) return prev;
          const sites = [...prev.sites];
          sites[siteIdx] = { ...sites[siteIdx], lat, lng };
          return { ...prev, sites };
        });
      }
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : 'Не удалось определить координаты');
    } finally {
      setGeocodeTarget(null);
    }
  }

  async function saveDraft(): Promise<void> {
    if (!draft?.id) return;
    setPatchLoading(true);
    setPatchError('');
    try {
      const res = await fetch(getApiUrl(`/api/admin/licenses/${draft.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(buildPatchBody(draft)),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body?.message || `Ошибка ${res.status}`);
      setItem(body as LicenseData);
      setEditing(false);
      setDraft(null);
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setPatchLoading(false);
    }
  }

  function setDraftSite(siteIdx: number, patch: Partial<LicenseSiteData>): void {
    setDraft((prev) => {
      if (!prev?.sites) return prev;
      const next = { ...prev, sites: [...prev.sites] };
      const cur = next.sites[siteIdx];
      if (!cur) return prev;
      next.sites[siteIdx] = { ...cur, ...patch };
      return next;
    });
  }

  function setDraftEntry(siteIdx: number, entryIdx: number, patch: Partial<FkkoEntry>): void {
    setDraft((prev) => {
      if (!prev?.sites?.[siteIdx]?.entries) return prev;
      const next = { ...prev, sites: [...prev.sites] };
      const site = { ...next.sites[siteIdx], entries: [...(next.sites[siteIdx].entries ?? [])] };
      const ent = site.entries[entryIdx];
      if (!ent) return prev;
      site.entries[entryIdx] = { ...ent, ...patch };
      next.sites[siteIdx] = site;
      return next;
    });
  }

  return (
    <SitePublicPageShell>
      <SiteFrameWithTopNav>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 pb-14">
        <div className="mb-8 flex flex-wrap gap-3">
          {canModerate ? (
            <Link
              to={fromAdminList}
              className="glass-btn-soft inline-flex h-11 items-center justify-center px-5 text-sm font-medium"
            >
              Назад к списку
            </Link>
          ) : null}
          <Link
            to={mapPath}
            className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow shadow-sm"
          >
            Показать на карте
          </Link>
          {canModerate && !editing ? (
            <button
              type="button"
              onClick={() => {
                if (!item) return;
                setTab('about');
                setDraft(ensureDraftSites(cloneForEdit(item)));
                setPatchError('');
                setEditing(true);
              }}
              className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold border border-black/[0.08] bg-white/80 text-ink hover:bg-white transition-colors shadow-sm"
            >
              Редактировать карточку
            </button>
          ) : null}
          {canModerate ? (
            <button
              type="button"
              disabled={!item?.id}
              onClick={() => {
                void markCurrentAsRecheck().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
              }}
              className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50"
              title="Отправить объект на перепроверку"
            >
              Перепроверка
            </button>
          ) : null}
          {canModerate && item?.status !== 'approved' ? (
            <button
              type="button"
              disabled={!item?.id}
              onClick={() => {
                void approveCurrent().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
              }}
              className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              title="Одобрить объект"
            >
              Одобрить
            </button>
          ) : null}
          {canModerate && item?.status !== 'rejected' ? (
            <button
              type="button"
              disabled={!item?.id}
              onClick={() => {
                void rejectCurrent().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
              }}
              className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50"
              title="Отклонить объект"
            >
              Отклонить
            </button>
          ) : null}
          {isSuperAdmin ? (
            <button
              type="button"
              disabled={!item?.id}
              onClick={() => {
                void hardDeleteCurrent().catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'));
              }}
              className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold text-white bg-[#7f1d1d] hover:bg-[#991b1b] transition-colors shadow-sm disabled:opacity-50"
              title="Полное удаление карточки из БД"
            >
              Удалить из БД
            </button>
          ) : null}
          {canModerate && editing && draft ? (
            <>
              <button
                type="button"
                disabled={patchLoading}
                onClick={() => {
                  void saveDraft();
                }}
                className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
              >
                {patchLoading ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                type="button"
                disabled={patchLoading}
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                  setPatchError('');
                }}
                className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold border border-black/[0.08] bg-white/80 text-ink hover:bg-white disabled:opacity-50"
              >
                Отмена
              </button>
            </>
          ) : null}
        </div>

        {loading && <p className="text-ink-muted">Загрузка карточки предприятия...</p>}
        {!loading && error && <p className="glass-danger">{error}</p>}
        {patchError ? <p className="glass-danger mb-4 max-w-5xl mx-auto px-4 sm:px-6 lg:px-10">{patchError}</p> : null}

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
                {editing && draft ? (
                  <div className="mt-3 max-w-3xl">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Название</label>
                    <input
                      className={`${inputClass} text-xl font-bold`}
                      value={draft.companyName}
                      onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
                    />
                  </div>
                ) : (
                  <h1 className="typo-h1 mt-3 tracking-tight max-w-3xl text-ink">
                    {display?.companyName || 'Организация'}
                  </h1>
                )}
                {!(editing && draft) && (sites.length > 0 || display?.address) && (
                  <div className="mt-5 space-y-2 max-w-3xl">
                    {sites.length > 0
                      ? sites.map((s, i) => (
                          <div key={s.id ?? i} className="flex items-start gap-2 text-sm text-ink/90 leading-relaxed">
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
                            <div>
                              <span>{s.address || 'Адрес не указан'}</span>
                              {s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng) ? (
                                <p className="text-xs text-ink-muted tabular-nums mt-0.5">
                                  Координаты: {Number(s.lat).toFixed(6)}, {Number(s.lng).toFixed(6)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))
                      : display?.address && (
                          <div className="flex items-start gap-2 text-sm text-ink/90 leading-relaxed">
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
                            <div>
                              <span>{display.address}</span>
                              {display.lat != null &&
                              display.lng != null &&
                              Number.isFinite(display.lat) &&
                              Number.isFinite(display.lng) ? (
                                <p className="text-xs text-ink-muted tabular-nums mt-0.5">
                                  Координаты: {Number(display.lat).toFixed(6)}, {Number(display.lng).toFixed(6)}
                                </p>
                              ) : null}
                            </div>
                          </div>
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
              {tab === 'about' &&
                (editing && draft ? (
                  <div className="space-y-8">
                    <p className="text-sm text-ink-muted">
                      Поля карточки и площадок сохраняются на сервере. Коды ФККО — 11 цифр; виды работ — через запятую.
                    </p>
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">ИНН</label>
                        <input
                          className={inputClass}
                          value={draft.inn}
                          onChange={(e) => setDraft({ ...draft, inn: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Регион (лицензия)</label>
                        <input
                          className={inputClass}
                          value={draft.region ?? ''}
                          onChange={(e) => setDraft({ ...draft, region: e.target.value || undefined })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Адрес (строка лицензии)</label>
                        <input
                          className={inputClass}
                          value={draft.address ?? ''}
                          onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Широта (lat)</label>
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={draft.lat ?? ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              lat: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Долгота (lng)</label>
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={draft.lng ?? ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              lng: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          disabled={!!geocodeTarget || patchLoading}
                          onClick={() => void applyGeocodeToDraft('license')}
                          className="inline-flex items-center justify-center min-h-10 px-4 rounded-xl border border-black/[0.08] bg-white/90 text-sm font-semibold text-[#1f5c14] hover:bg-white disabled:opacity-50"
                        >
                          {geocodeTarget === 'license'
                            ? 'Запрос к геокодеру…'
                            : 'Подставить координаты по адресу строки лицензии'}
                        </button>
                        <p className="mt-1.5 text-xs text-ink-muted">
                          Яндекс Геокодер (ключ на сервере). Поля lat/lng обновятся в форме — нажмите «Сохранить», чтобы записать в БД.
                        </p>
                      </div>
                    </section>

                    <section className="rounded-2xl bg-app-bg p-5 sm:p-6 shadow-sm space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="typo-h3 uppercase tracking-[0.14em] text-ink-muted">
                          Площадки ({draft.sites?.length ?? 0})
                        </h3>
                        <button
                          type="button"
                          className="text-sm font-semibold text-[#1f5c14] hover:underline"
                          onClick={() => {
                            setDraft((prev) => {
                              if (!prev) return prev;
                              const ns = [...(prev.sites ?? [])];
                              const n = ns.length + 1;
                              ns.push({
                                siteLabel: `Площадка ${n}`,
                                address: '',
                                region: null,
                                lat: null,
                                lng: null,
                                fkkoCodes: [],
                                activityTypes: [],
                                entries: [
                                  {
                                    fkkoCode: '',
                                    wasteName: undefined,
                                    hazardClass: undefined,
                                    activityTypes: [''],
                                  },
                                ],
                              });
                              return { ...prev, sites: ns };
                            });
                          }}
                        >
                          + Добавить площадку
                        </button>
                      </div>
                      {(draft.sites ?? []).map((s, siteIdx) => (
                        <div
                          key={s.id ?? `new-${siteIdx}`}
                          className="rounded-xl bg-surface p-4 shadow-eco-card space-y-3 border border-black/[0.06]"
                        >
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="text-sm font-semibold text-ink">
                              {typeof s.id === 'number' ? `Площадка id ${s.id}` : 'Новая площадка'}
                            </span>
                            <button
                              type="button"
                              className="text-xs font-semibold text-amber-700 hover:underline"
                              onClick={() => {
                                setDraft((prev) => {
                                  if (!prev?.sites) return prev;
                                  const ns = prev.sites.filter((_, j) => j !== siteIdx);
                                  return { ...prev, sites: ns };
                                });
                              }}
                            >
                              Удалить площадку
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold uppercase text-ink-muted">Подпись</label>
                              <input
                                className={inputClass}
                                value={s.siteLabel ?? ''}
                                onChange={(e) => setDraftSite(siteIdx, { siteLabel: e.target.value || null })}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold uppercase text-ink-muted">Адрес</label>
                              <input
                                className={inputClass}
                                value={s.address ?? ''}
                                onChange={(e) => setDraftSite(siteIdx, { address: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-ink-muted">Регион</label>
                              <input
                                className={inputClass}
                                value={s.region ?? ''}
                                onChange={(e) => setDraftSite(siteIdx, { region: e.target.value || null })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold uppercase text-ink-muted">lat</label>
                                <input
                                  className={inputClass}
                                  type="number"
                                  step="any"
                                  value={s.lat ?? ''}
                                  onChange={(e) =>
                                    setDraftSite(siteIdx, {
                                      lat: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-ink-muted">lng</label>
                                <input
                                  className={inputClass}
                                  type="number"
                                  step="any"
                                  value={s.lng ?? ''}
                                  onChange={(e) =>
                                    setDraftSite(siteIdx, {
                                      lng: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <button
                                type="button"
                                disabled={!!geocodeTarget || patchLoading}
                                onClick={() => void applyGeocodeToDraft('site', siteIdx)}
                                className="inline-flex items-center min-h-9 px-3 rounded-xl border border-black/[0.06] bg-white/80 text-sm font-semibold text-[#1f5c14] hover:bg-white disabled:opacity-50"
                              >
                                {geocodeTarget === `site-${siteIdx}`
                                  ? 'Запрос к геокодеру…'
                                  : 'Определить координаты по адресу площадки'}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <span className="block text-xs font-bold text-ink-muted uppercase">
                              ФККО и виды на площадке
                            </span>
                            {(s.entries ?? []).map((entry, eIdx) => (
                              <div
                                key={eIdx}
                                className="rounded-lg bg-app-bg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border border-black/[0.04]"
                              >
                                <div>
                                  <label className="text-[10px] text-ink-muted">Код ФККО (11 цифр)</label>
                                  <input
                                    className={inputClass}
                                    value={entry.fkkoCode}
                                    onChange={(e) =>
                                      setDraftEntry(siteIdx, eIdx, { fkkoCode: e.target.value })
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-ink-muted">Класс опасности</label>
                                  <input
                                    className={inputClass}
                                    value={entry.hazardClass ?? ''}
                                    onChange={(e) =>
                                      setDraftEntry(siteIdx, eIdx, {
                                        hazardClass: e.target.value || undefined,
                                      })
                                    }
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[10px] text-ink-muted">Наименование отхода</label>
                                  <input
                                    className={inputClass}
                                    value={entry.wasteName ?? ''}
                                    onChange={(e) =>
                                      setDraftEntry(siteIdx, eIdx, {
                                        wasteName: e.target.value || undefined,
                                      })
                                    }
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[10px] text-ink-muted">Виды работ (через запятую)</label>
                                  <input
                                    className={inputClass}
                                    value={entry.activityTypes.join(', ')}
                                    onChange={(e) =>
                                      setDraftEntry(siteIdx, eIdx, {
                                        activityTypes: e.target.value
                                          .split(/[,;]+/)
                                          .map((x) => x.trim())
                                          .filter(Boolean),
                                      })
                                    }
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <button
                                    type="button"
                                    className="text-xs text-amber-700 hover:underline"
                                    onClick={() => {
                                      setDraft((prev) => {
                                        if (!prev?.sites?.[siteIdx]?.entries) return prev;
                                        const next = { ...prev, sites: [...prev.sites] };
                                        const site = { ...next.sites[siteIdx] };
                                        site.entries = (site.entries ?? []).filter((_, j) => j !== eIdx);
                                        next.sites[siteIdx] = site;
                                        return next;
                                      });
                                    }}
                                  >
                                    Удалить строку
                                  </button>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                className="text-xs font-semibold text-[#1f5c14] hover:underline"
                                onClick={() => {
                                  setDraft((prev) => {
                                    if (!prev?.sites?.[siteIdx]) return prev;
                                    const next = { ...prev, sites: [...prev.sites] };
                                    const site = { ...next.sites[siteIdx] };
                                    const entries = [...(site.entries ?? [])];
                                    entries.push({
                                      fkkoCode: '',
                                      wasteName: undefined,
                                      hazardClass: undefined,
                                      activityTypes: [''],
                                    });
                                    site.entries = entries;
                                    next.sites[siteIdx] = site;
                                    return next;
                                  });
                                }}
                              >
                                + Строка ФККО
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <section aria-labelledby="activity-strip-label">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 id="activity-strip-label" className="typo-h2 text-ink">
                            Виды деятельности
                          </h2>
                          <p className="mt-1 text-sm text-ink-muted max-w-xl">
                            Круги подсвечены, если в данных есть соответствующий вид работ (по ключевым словам в списке).
                          </p>
                        </div>
                        <EnterpriseActivityStrip activityTypes={display?.activityTypes} variant="light" size="md" />
                      </div>
                      <p className="mt-4 text-sm text-ink rounded-2xl bg-app-bg px-5 py-4 shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Как в лицензии</span>
                        <span className="block mt-2 leading-relaxed">{activityList}</span>
                      </p>
                    </section>

                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="rounded-2xl bg-app-bg p-5 shadow-sm">
                        <h3 className="typo-h3 uppercase tracking-[0.14em] text-ink-muted">ИНН</h3>
                        <p className="mt-3 font-mono text-xl font-semibold text-ink tabular-nums">
                          {display?.inn || '—'}
                        </p>
                      </div>
                      {hazardClasses.length > 0 && (
                        <div className="rounded-2xl bg-app-bg p-5 shadow-sm sm:col-span-2 lg:col-span-1">
                          <h3 className="typo-h3 uppercase tracking-[0.14em] text-ink-muted">
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
                      <h3 className="typo-h3 uppercase tracking-[0.14em] text-ink-muted">Адрес</h3>
                      <p className="mt-3 text-sm text-ink leading-relaxed">{display?.address || 'не указан'}</p>
                    </section>

                    {sites.length > 0 && (
                      <section className="rounded-2xl bg-app-bg p-5 sm:p-6 shadow-sm">
                        <h3 className="typo-h3 uppercase tracking-[0.14em] text-ink-muted">
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
                              {s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng) ? (
                                <p className="mt-1 text-xs text-ink-muted tabular-nums">
                                  Координаты: {Number(s.lat).toFixed(6)}, {Number(s.lng).toFixed(6)}
                                </p>
                              ) : null}
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
                ))}

              {tab === 'fkko' && (
                <section>
                  <h2 className="typo-h2 text-ink">Коды ФККО с расшифровкой</h2>
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

              {/* Состояние лицензии в реестре Росприроднадзора (видно всем посетителям). */}
              <RpnLicenseStateCard pps={item?.pps} rpnSnapshot={item?.rpnSnapshot} />

              {(item?.status ||
                item?.rejectionNote ||
                item?.fileStoredName ||
                item?.importSource) && (
                <section className="mt-10 rounded-2xl bg-app-bg p-6 sm:p-7 shadow-sm">
                  <h2 className="typo-h2 text-ink">Модерация и документ</h2>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-ink-muted">
                      {item.importSource === 'rpn_registry' && item.importRegistryInactive ? (
                        <div className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-amber-950 text-sm leading-snug">
                          В реестре Росприроднадзора эта лицензия помечена как неактивная. Объект скрыт с публичной
                          карты и из поиска по базе.
                        </div>
                      ) : null}
                      {item.status ? (
                        <>
                          Статус:{' '}
                          <span className="font-semibold text-ink">{moderationStatusLabel(item.status)}</span>
                        </>
                      ) : (
                        <span>Статус не указан</span>
                      )}
                      {item.status === 'rejected' && item.rejectionNote ? (
                        <div className="mt-1 glass-danger text-sm">Причина: {item.rejectionNote}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(canModerate || isOwner) && item.fileStoredName ? (
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

                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
