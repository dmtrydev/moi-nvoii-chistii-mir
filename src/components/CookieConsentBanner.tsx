import { useEffect, useState } from 'react';
import {
  getCookieConsentStatus,
  setCookieConsentStatus,
  subscribeCookieSettingsOpen,
} from '@/lib/metrika';

export function CookieConsentBanner(): JSX.Element | null {
  const [status, setStatus] = useState(() => getCookieConsentStatus());
  const [isOpen, setIsOpen] = useState(() => status === null);

  useEffect(() => {
    return subscribeCookieSettingsOpen(() => {
      setIsOpen(true);
    });
  }, []);

  if (!isOpen) return null;

  function closeBanner(): void {
    // Используем существующий статус как маркер, что пользователь видел уведомление.
    setCookieConsentStatus('accepted');
    setStatus('accepted');
    setIsOpen(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] p-3 sm:p-5">
      <div className="cookie-consent-shell mx-auto w-full max-w-5xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="cookie-consent-kicker">Настройки cookies</div>
            <h2 className="typo-h2 mt-1 text-ink">Мы используем cookies</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Используем обязательные cookies и Яндекс.Метрику для технической статистики и улучшения работы сервиса.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={closeBanner} className="cookie-consent-btn-accept">
              Понятно
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
