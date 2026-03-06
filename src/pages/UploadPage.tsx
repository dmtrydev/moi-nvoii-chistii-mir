import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Loader2, ArrowLeft, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import type { LicenseData } from '@/types';

// На Render (и любом продакшене) API на том же домене — всегда относительные пути. localhost только в dev.
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');
const API_HEALTH_URL = (() => {
  const base = String(API_BASE).replace(/\/$/, '');
  return base ? `${base}/api/health` : '/api/health';
})();

type Step = 'idle' | 'dragging' | 'analyzing' | 'form' | 'error' | 'published';

function getGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(address);
  return fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { Accept: 'application/json' } }
  )
    .then((r) => r.json())
    .then((arr: { lat: string; lon: string }[]) => {
      if (arr?.length && arr[0].lat && arr[0].lon) {
        return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
      }
      return null;
    })
    .catch(() => null);
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

export default function UploadPage(): JSX.Element {
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

  const handleConfirmPublish = useCallback(async (_payload: LicenseData) => {
    try {
      // TODO: отправить _payload на бэкенд для публикации на карте
      await new Promise((r) => setTimeout(r, 800));
      setStep('published');
    } catch {
      // ignore
    }
  }, []);

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
  const handlePublishClick = useCallback(async () => {
    if (!formData) return;
    setIsSubmitting(true);
    try {
      await handleConfirmPublish(formData);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, handleConfirmPublish]);

  const highlight = isDragging || step === 'dragging';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_#4caf5020,_transparent_50%)] pointer-events-none" />

      <header className="relative flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
        <Link
          to="/map"
          className="text-sm text-white/70 hover:text-white transition-colors"
        >
          Карта объектов
        </Link>
      </header>

      {apiReachable === false && (
        <div className="relative mx-4 mt-4 p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-amber-100">
                {import.meta.env.PROD
                  ? 'Сервер временно недоступен. Попробуйте обновить страницу через минуту.'
                  : 'Сервер API недоступен (ERR_CONNECTION_REFUSED)'}
              </p>
              {!import.meta.env.PROD && (
                <>
                  <p className="text-sm mt-1 text-amber-200/90">
                    Запрос идёт по адресу: <code className="bg-black/30 px-1 rounded text-xs break-all">{API_HEALTH_URL}</code>
                  </p>
                  <p className="text-sm mt-2">
                    1) Откройте новый терминал. 2) Выполните: <code className="bg-black/30 px-1 rounded">cd server</code>, затем <code className="bg-black/30 px-1 rounded">npm start</code>. 3) В .env укажите <code className="bg-black/30 px-1 rounded">VITE_API_URL=http://localhost:3001</code> или уберите переменную для прокси.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={checkApiReachable}
                className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500/30 text-amber-100 text-sm font-medium hover:bg-amber-500/50 transition-colors"
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
                rounded-2xl border-2 border-dashed transition-all duration-200
                ${highlight
                  ? 'border-[#4caf50] bg-[#4caf50]/10'
                  : 'border-white/20 bg-[#161616] hover:border-white/30 hover:bg-[#1a1a1a]'}
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
                  className={`flex items-center justify-center w-16 h-16 rounded-full transition-colors ${highlight ? 'bg-[#4caf50]/30 text-[#4caf50]' : 'bg-white/5 text-white/60'}`}
                >
                  <Upload className="w-8 h-8" />
                </span>
                <div className="text-center space-y-1">
                  <p className="text-lg font-medium text-white">
                    {highlight ? 'Отпустите файл здесь' : 'Перетащите лицензию в PDF сюда'}
                  </p>
                  <p className="text-sm text-white/50">или нажмите, чтобы выбрать файл</p>
                </div>
              </label>
            </div>
          )}

          {step === 'form' && formData && (
            <div className="rounded-2xl border border-white/10 bg-[#161616] p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4 text-white/70 text-sm">
                <CheckCircle className="w-5 h-5 text-[#4caf50]" />
                <span>Проверьте данные и при необходимости отредактируйте поля. Затем нажмите «Опубликовать».</span>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Название организации</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, companyName: e.target.value } : prev)}
                    className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-white bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4caf50]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">ИНН</label>
                  <input
                    type="text"
                    value={formData.inn}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, inn: e.target.value } : prev)}
                    className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-white bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4caf50]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Адрес</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, address: e.target.value } : prev)}
                    className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-white bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4caf50]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Коды ФККО</label>
                  <input
                    type="text"
                    value={Array.isArray(formData.fkkoCodes) ? formData.fkkoCodes.join(', ') : ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev ? { ...prev, fkkoCodes: e.target.value.split(/[,;\s]+/).map((c) => c.trim()).filter(Boolean) } : prev
                      )
                    }
                    placeholder="Через запятую или пробел"
                    className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-white bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4caf50]/60 placeholder-white/40"
                  />
                </div>
                {formData.lat != null && formData.lng != null && (
                  <p className="text-xs text-white/50">Координаты: {formData.lat.toFixed(5)}, {formData.lng.toFixed(5)}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePublishClick}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#4caf50] text-sm font-medium text-white hover:bg-[#43a047] transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                  Опубликовать
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 rounded-full border border-white/20 text-sm text-white/70 hover:bg-white/10 transition-colors"
                >
                  Загрузить другой файл
                </button>
              </div>
            </div>
          )}

          {(step === 'analyzing') && (
            <div className="rounded-2xl border border-white/10 bg-[#161616] p-12 flex flex-col items-center gap-6">
              <Loader2 className="w-12 h-12 text-[#4caf50] animate-spin" />
              <p className="text-center text-white font-medium">
                Нейросеть анализирует лицензию...
              </p>
              <p className="text-sm text-white/50">Извлечение реквизитов и кодов ФККО</p>
            </div>
          )}

          {step === 'error' && (
            <div className="rounded-2xl border border-red-500/30 bg-[#161616] p-8">
              <p className="text-red-400 font-medium mb-2">Ошибка</p>
              <p className="text-white/80 text-sm mb-6">{errorMessage}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 rounded-full bg-[#4caf50] text-sm font-medium text-white hover:bg-[#43a047] transition-colors"
                >
                  Загрузить снова
                </button>
                <Link
                  to="/"
                  className="px-4 py-2 rounded-full border border-white/20 text-sm text-white/80 hover:bg-white/10 transition-colors"
                >
                  На главную
                </Link>
              </div>
            </div>
          )}

          {step === 'published' && (
            <div className="rounded-2xl border border-[#4caf50]/30 bg-[#161616] p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#4caf50]/20 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-[#4caf50]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Объект опубликован</h2>
              <p className="text-white/70 text-sm mb-6">
                Он появится на карте после модерации.
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  to="/map"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#4caf50] text-sm font-medium text-white hover:bg-[#43a047] transition-colors"
                >
                  Перейти к карте
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="px-5 py-2.5 rounded-full border border-white/20 text-sm text-white/70 hover:bg-white/10 transition-colors"
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
