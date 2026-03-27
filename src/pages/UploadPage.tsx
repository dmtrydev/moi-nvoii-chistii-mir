import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Loader2, ArrowLeft, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import type { LicenseData } from '@/types';
import { formatFkkoHuman } from '@/utils/fkko';
import { useAuth } from '@/contexts/useAuth';

// На Render (и любом продакшене) API на том же домене — всегда относительные пути. localhost только в dev.
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');
const API_HEALTH_URL = (() => {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}/api/health` : '/api/health';
})();

type Step = 'idle' | 'dragging' | 'analyzing' | 'form' | 'error' | 'published';

async function getGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = getApiUrl(`/api/geocode?address=${encodeURIComponent(address)}`);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const data = (await r.json()) as { lat?: number; lng?: number };
    if (typeof data.lat === 'number' && typeof data.lng === 'number') return { lat: data.lat, lng: data.lng };
    return null;
  } catch {
    return null;
  }
}

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network error|load failed/i.test(msg);
}

async function analyzeLicense(file: File): Promise<LicenseData> {
  const formData = new FormData();
  formData.append('file', file);
  const url = getApiUrl('/api/analyze-license');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error(
        import.meta.env.PROD
          ? 'Сервер временно недоступен. Попробуйте ещё раз через минуту.'
          : 'Не удалось подключиться к серверу. Запустите API: в папке server выполните «npm start». В .env укажите VITE_API_URL=http://localhost:3001 или уберите переменную.'
      );
    }
    throw err;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message;
    if (res.status === 404) {
      throw new Error(
        'Сервер анализа недоступен (404). Запустите API: в папке server выполните «npm start». В другом терминале запустите «npm run dev».'
      );
    }
    throw new Error(msg ?? `Ошибка ${res.status}`);
  }

  const data = (await res.json()) as LicenseData;
  if (!data.companyName && !data.address) {
    throw new Error('Не удалось извлечь данные из лицензии');
  }
  return data;
}

async function publishLicense(payload: LicenseData, accessToken: string | null): Promise<LicenseData> {
  const url = getApiUrl('/api/licenses');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message;
    throw new Error(msg ?? `Ошибка публикации (${res.status})`);
  }
  return (await res.json()) as LicenseData;
}

export default function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState<LicenseData | null>(null);
  /** null = проверяем, true = API доступен, false = connection refused */
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const checkApiReachable = useCallback(() => {
    setApiReachable(null);
    fetch(API_HEALTH_URL, { method: 'GET' })
      .then((r) => setApiReachable(r.ok))
      .catch(() => setApiReachable(false));
  }, []);

  useEffect(() => {
    checkApiReachable();
  }, [checkApiReachable]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (step === 'idle') setIsDragging(true);
  }, [step]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const isPdfFile = useCallback((file: File) => {
    const okType = file.type === 'application/pdf';
    const okExt = file.name.toLowerCase().endsWith('.pdf');
    return okType && okExt;
  }, []);

  const handleConfirmPublish = useCallback(async (payload: LicenseData) => {
    try {
      const created = await publishLicense(payload, accessToken);
      const id = created.id;
      if (typeof id === 'number' && Number.isFinite(id)) {
        navigate(`/dashboard/licenses/${id}`);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки на проверку';
      setErrorMessage(msg);
      setStep('error');
    }
  }, [navigate, accessToken]);

  const processFile = useCallback(
    async (file: File) => {
      if (step !== 'idle') return;
      if (!file || !isPdfFile(file)) {
        setErrorMessage('Разрешены только файлы PDF (расширение .pdf).');
        setStep('error');
        return;
      }
      setErrorMessage('');
      setStep('analyzing');
      try {
        let data = await analyzeLicense(file);
        const coords = await getGeocode(data.address);
        if (coords) {
          data = { ...data, lat: coords.lat, lng: coords.lng };
        }
        setFormData(data);
        setStep('form');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Ошибка анализа лицензии.');
        setStep('error');
      }
    },
    [step, isPdfFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const reset = useCallback(() => {
    setStep('idle');
    setErrorMessage('');
    setFormData(null);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValidationError, setFormValidationError] = useState('');
  const handlePublishClick = useCallback(async () => {
    if (!formData) return;
    const fkko = Array.isArray(formData.fkkoCodes) ? formData.fkkoCodes : [];
    if (fkko.length === 0) {
      setFormValidationError('Укажите хотя бы один код ФККО. Коды извлекаются из лицензии и обязательно прикрепляются к организации.');
      return;
    }
    setFormValidationError('');
    setIsSubmitting(true);
    try {
      await handleConfirmPublish(formData);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, handleConfirmPublish]);

  const highlight = isDragging || step === 'dragging';

  return (
    <div className="min-h-screen glass-bg text-ink font-sans flex flex-col page-enter">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_rgba(95,217,58,0.12),_transparent_50%)] pointer-events-none" />

      <header className="relative flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white/90 backdrop-blur-md shadow-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
        <Link
          to="/map"
          className="text-sm text-ink-muted hover:text-ink transition-colors font-medium"
        >
          Карта объектов
        </Link>
      </header>

      {apiReachable === false && (
        <div className="relative mx-4 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-amber-900">
                {import.meta.env.PROD
                  ? 'Сервер временно недоступен. Попробуйте обновить страницу через минуту.'
                  : 'Сервер API недоступен (ERR_CONNECTION_REFUSED)'}
              </p>
              {!import.meta.env.PROD && (
                <>
                  <p className="text-sm mt-1 text-amber-100/85">
                    Запрос идёт по адресу: <code className="bg-black/20 px-1 rounded text-xs break-all border border-amber-300/30">{API_HEALTH_URL}</code>
                  </p>
                  <p className="text-sm mt-2 text-amber-100/85">
                    1) Откройте новый терминал. 2) Выполните: <code className="bg-black/20 px-1 rounded border border-amber-300/30">cd server</code>, затем <code className="bg-black/20 px-1 rounded border border-amber-300/30">npm start</code>. 3) В .env укажите <code className="bg-black/20 px-1 rounded border border-amber-300/30">VITE_API_URL=http://localhost:3001</code> или уберите переменную для прокси.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={checkApiReachable}
                className="mt-3 px-3 py-1.5 rounded-lg bg-amber-300/25 text-amber-50 text-sm font-medium hover:bg-amber-300/35 transition-colors border border-amber-300/30"
              >
                Проверить снова
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="relative flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {step === 'idle' && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`
                rounded-3xl border-2 border-dashed transition-all duration-200 glass-panel
                ${highlight
                  ? 'border-[#5fd93a] bg-accent-soft'
                  : 'border-black/15 hover:border-[#5fd93a]/50 hover:bg-app-bg'}
              `}
            >
              <label className="flex flex-col items-center justify-center gap-4 py-16 px-8 cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={onFileInput}
                  className="sr-only"
                />
                <span
                  className={`flex items-center justify-center w-16 h-16 rounded-full transition-colors ${highlight ? 'bg-accent-soft text-[#1f5c14]' : 'bg-app-bg text-ink-muted'}`}
                >
                  <Upload className="w-8 h-8" />
                </span>
                <div className="text-center space-y-1">
                  <p className="text-lg font-medium text-ink">
                    {highlight ? 'Отпустите файл здесь' : 'Перетащите лицензию в PDF сюда'}
                  </p>
                  <p className="text-sm text-ink-muted">или нажмите, чтобы выбрать файл</p>
                </div>
              </label>
            </div>
          )}

          {step === 'form' && formData && (
            <div className="rounded-2xl glass-panel p-6 sm:p-8">
              {formValidationError && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                  {formValidationError}
                </div>
              )}
              <div className="flex items-center gap-2 mb-4 text-ink-muted text-sm">
                <CheckCircle className="w-5 h-5 text-[#22c55e]" />
                <span>Проверьте данные и при необходимости отредактируйте поля. Затем нажмите «Отправить на проверку».</span>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink-muted mb-1.5">Название организации</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, companyName: e.target.value } : prev)}
                    className="liquid-field w-full px-4"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink-muted mb-1.5">ИНН</label>
                  <input
                    type="text"
                    value={formData.inn}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, inn: e.target.value } : prev)}
                    className="liquid-field w-full px-4"
                  />
                </div>
                {Array.isArray(formData.sites) && formData.sites.length > 0 && (
                  <div className="rounded-2xl border border-black/[0.06] bg-app-bg p-4">
                    <p className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">Площадки (из лицензии)</p>
                    <div className="space-y-3">
                      {formData.sites.map((s, idx) => (
                        <div key={idx} className="rounded-xl border border-black/[0.06] bg-surface p-3 shadow-sm">
                          <p className="text-xs text-ink">
                            <span className="text-ink-muted">Адрес:</span>{' '}
                            {s.address || s.addressRef || '—'}
                          </p>
                          {Array.isArray(s.entries) && s.entries.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                              {s.entries.map((entry, eIdx) => (
                                <div key={eIdx} className="rounded-lg border border-black/[0.05] bg-app-bg px-2.5 py-1.5">
                                  <p className="text-xs text-ink">
                                    <span className="text-ink-muted">ФККО:</span>{' '}
                                    {formatFkkoHuman(entry.fkkoCode)}
                                    {entry.hazardClass ? ` (${entry.hazardClass} класс)` : ''}
                                  </p>
                                  {entry.wasteName && (
                                    <p className="text-[11px] text-ink-muted mt-0.5 leading-tight">{entry.wasteName}</p>
                                  )}
                                  <p className="text-xs text-ink mt-0.5">
                                    <span className="text-ink-muted">Виды работ:</span>{' '}
                                    {entry.activityTypes.join(', ')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <p className="mt-1 text-xs text-ink">
                                <span className="text-ink-muted">Виды:</span>{' '}
                                {Array.isArray(s.activityTypes) && s.activityTypes.length ? s.activityTypes.join(', ') : '—'}
                              </p>
                              <p className="mt-1 text-xs text-ink">
                                <span className="text-ink-muted">ФККО:</span>{' '}
                                {Array.isArray(s.fkkoCodes) && s.fkkoCodes.length ? s.fkkoCodes.map(formatFkkoHuman).join(', ') : '—'}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-ink-muted">
                      Эти площадки будут сохранены вместе с лицензией. Каждый код ФККО привязан к конкретным видам работ.
                    </p>
                  </div>
                )}
                {formData.lat != null && formData.lng != null && (
                  <p className="text-xs text-ink-muted">Координаты: {formData.lat.toFixed(5)}, {formData.lng.toFixed(5)}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePublishClick}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow disabled:opacity-60 shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                  Отправить на проверку
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Загрузить другой файл
                </button>
              </div>
            </div>
          )}

          {(step === 'analyzing') && (
            <div className="rounded-2xl glass-panel p-12 flex flex-col items-center gap-6">
              <Loader2 className="w-12 h-12 text-[#22c55e] animate-spin" />
              <p className="text-center text-ink font-medium">
                Нейросеть анализирует лицензию...
              </p>
              <p className="text-sm text-ink-muted">Извлечение реквизитов и кодов ФККО</p>
            </div>
          )}

          {step === 'error' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
              <p className="glass-danger font-medium mb-2">Ошибка</p>
              <p className="text-red-900/90 text-sm mb-6">{errorMessage}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 rounded-2xl glass-btn-dark text-sm font-semibold"
                >
                  Загрузить снова
                </button>
                <Link
                  to="/"
                  className="glass-btn-soft px-4 py-2 !h-auto !text-sm"
                >
                  На главную
                </Link>
              </div>
            </div>
          )}

          {step === 'published' && (
            <div className="rounded-3xl border border-black/[0.06] bg-surface shadow-eco-card p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-[#1f5c14]" />
              </div>
              <h2 className="text-xl font-semibold text-ink mb-2">Заявка отправлена на проверку</h2>
              <p className="text-ink-muted text-sm mb-6">
                Мы отправили заявку администраторам. После проверки объект появится на карте.
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  to="/map"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow shadow-sm"
                >
                  Перейти к карте
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="glass-btn-soft px-5 py-2.5 !h-auto !text-sm"
                >
                  Разместить ещё объект
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
