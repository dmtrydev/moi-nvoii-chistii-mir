import { useState, useEffect, useCallback } from 'react';
import { FileText, MapPin, Loader2, CheckCircle } from 'lucide-react';
import { PdfPreviewWithHighlight } from '@/components/PdfPreviewWithHighlight';
import type { LicenseData, LicenseDataFoundTexts } from '@/types';

export type VerificationFieldKey = keyof LicenseDataFoundTexts;

const FIELD_KEYS: { key: VerificationFieldKey; label: string }[] = [
  { key: 'companyName', label: 'Название ООО' },
  { key: 'inn', label: 'ИНН' },
  { key: 'address', label: 'Адрес' },
  { key: 'fkkoCodes', label: 'Коды ФККО' },
];

interface VerificationScreenProps {
  file: File;
  formData: LicenseData;
  onConfirm: (data: LicenseData) => Promise<void>;
  onBack: () => void;
}

export function VerificationScreen({
  file,
  formData,
  onConfirm,
  onBack,
}: VerificationScreenProps): JSX.Element {
  const [activeField, setActiveField] = useState<VerificationFieldKey | null>(null);
  const [data, setData] = useState<LicenseData>(formData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const foundTexts = formData.foundTexts ?? {
    companyName: '',
    inn: '',
    address: '',
    fkkoCodes: '',
  };

  const highlightText = activeField ? (foundTexts[activeField] ?? '') : '';

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(data);
    } finally {
      setIsSubmitting(false);
    }
  }, [data, onConfirm]);

  const inputBase =
    'w-full rounded-xl border border-white/15 px-4 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]/60 focus:border-[#4caf50]/40 transition-all duration-200 bg-white/5 backdrop-blur-sm';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_#4caf5020,_transparent_50%)] pointer-events-none" />

      <header className="relative flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-white/70 hover:text-white transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-lg font-semibold text-white/90">Проверка данных (Double Check)</h1>
        <span />
      </header>

      <main className="relative flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Левая колонка: предпросмотр PDF с подсветкой */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-white/70 text-sm">
              <FileText className="w-4 h-4" />
              <span>Предпросмотр документа</span>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-12rem)] rounded-2xl">
              {fileUrl ? (
                <PdfPreviewWithHighlight
                  fileUrl={fileUrl}
                  highlightText={highlightText}
                />
              ) : (
                <div className="min-h-[400px] flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 text-white/50">
                  Загрузка…
                </div>
              )}
            </div>
          </div>

          {/* Правая колонка: форма */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-4 text-white/70 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Проверьте и при необходимости отредактируйте поля</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5 shadow-xl">
              {FIELD_KEYS.map(({ key, label }) => {
                const value =
                  key === 'fkkoCodes'
                    ? Array.isArray(data.fkkoCodes)
                      ? data.fkkoCodes.join(', ')
                      : ''
                    : (data[key] as string);
                const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
                  setData((prev) =>
                    prev
                      ? key === 'fkkoCodes'
                        ? { ...prev, fkkoCodes: e.target.value.split(/[,;\s]+/).filter(Boolean) }
                        : { ...prev, [key]: e.target.value }
                      : prev
                  );
                const inputProps = {
                  value,
                  onChange,
                  onFocus: () => setActiveField(key),
                  onBlur: () => setActiveField(null),
                  placeholder: key === 'fkkoCodes' ? 'Через запятую или пробел' : '',
                  className: key === 'address' ? `${inputBase} pl-10` : inputBase,
                };
                return (
                  <div key={key}>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">
                      {label}
                    </label>
                    {key === 'address' ? (
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input type="text" {...inputProps} />
                      </div>
                    ) : (
                      <input type="text" {...inputProps} />
                    )}
                  </div>
                );
              })}

              {data.lat != null && data.lng != null && (
                <p className="text-xs text-white/50 mt-1">
                  Координаты: {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
                </p>
              )}

              <div className="pt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-[#4caf50] text-sm font-medium text-white hover:bg-[#43a047] transition-colors disabled:opacity-60 shadow-lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5" />
                  )}
                  Подтвердить и опубликовать
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 rounded-full border border-white/20 text-sm text-white/70 hover:bg-white/10 transition-colors"
                >
                  Загрузить другой файл
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
