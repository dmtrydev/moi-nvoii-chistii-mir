import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Loader2, ArrowLeft, MapPin } from 'lucide-react';
import { VerificationScreen } from '@/components/VerificationScreen';
import type { LicenseData } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

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
        'Не удалось подключиться к серверу. Запустите API в отдельном терминале: зайдите в папку server и выполните «npm start». Убедитесь, что в корневом .env указан правильный порт (VITE_API_URL=http://localhost:3001) или уберите VITE_API_URL, чтобы использовался прокси.'
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [isDragging, setIsDragging] = useState(false);

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
        setUploadedFile(file);
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

  const handleConfirmPublish = useCallback(async (_payload: LicenseData) => {
    try {
      // TODO: отправить _payload на бэкенд для публикации на карте
      await new Promise((r) => setTimeout(r, 800));
      setStep('published');
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setErrorMessage('');
    setFormData(null);
    setUploadedFile(null);
  }, []);

  const highlight = isDragging || step === 'dragging';

  if (step === 'form' && formData && uploadedFile) {
    return (
      <VerificationScreen
        file={uploadedFile}
        formData={formData}
        onConfirm={handleConfirmPublish}
        onBack={reset}
      />
    );
  }

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
