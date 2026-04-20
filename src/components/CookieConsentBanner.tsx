import { useState } from 'react';
import {
  getCookieConsentStatus,
  initMetrika,
  setCookieConsentStatus,
} from '@/lib/metrika';

export function CookieConsentBanner(): JSX.Element | null {
  const [status, setStatus] = useState(() => getCookieConsentStatus());
  if (status) return null;

  function accept(): void {
    setCookieConsentStatus('accepted');
    initMetrika();
    setStatus('accepted');
  }

  function reject(): void {
    setCookieConsentStatus('rejected');
    setStatus('rejected');
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] p-3 sm:p-5">
      <div className="mx-auto w-full max-w-4xl glass-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="glass-kicker">Cookies</div>
            <h2 className="typo-h2 mt-1 text-ink">Мы используем cookies</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Обязательные cookies нужны для входа и безопасности сайта. По согласию включим аналитику Яндекс.Метрики.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={reject} className="glass-btn-soft !h-10 !px-4">
              Только обязательные
            </button>
            <button type="button" onClick={accept} className="glass-btn-dark !h-10 !px-4">
              Принять все
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
