import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyCookieConsent,
  getCookieConsentState,
  hasConsentChoice,
  setCookieConsentState,
  subscribeCookieSettingsOpen,
} from '@/lib/metrika';

export function CookieConsentBanner(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(() => !hasConsentChoice());
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    () => getCookieConsentState()?.analytics ?? false,
  );

  useEffect(() => {
    return subscribeCookieSettingsOpen(() => {
      setAnalyticsEnabled(getCookieConsentState()?.analytics ?? false);
      setShowDetails(true);
      setIsOpen(true);
    });
  }, []);

  if (!isOpen) return null;

  function saveConsent(analytics: boolean): void {
    setCookieConsentState({
      version: 2,
      necessary: true,
      analytics,
      updatedAt: new Date().toISOString(),
    });
    applyCookieConsent();
    setIsOpen(false);
    setShowDetails(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] p-3 sm:p-5">
      <div className="cookie-consent-shell mx-auto w-full max-w-5xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="cookie-consent-kicker">Настройки cookies</div>
            <h2 className="typo-h2 mt-1 text-ink">Мы используем cookies</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Обязательные cookies нужны для входа и безопасности сервиса. Аналитические cookies
              (Яндекс.Метрика) включаются только с вашего согласия.
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Подробнее: <Link to="/consent/personal-data" className="glass-link">Согласие</Link>
              {' · '}
              <Link to="/privacy-policy" className="glass-link">Политика обработки ПДн</Link>
              {' · '}
              <Link to="/cookie-policy" className="glass-link">Cookie Policy</Link>
            </p>
          </div>
          {showDetails && (
            <div className="mt-2 rounded-2xl bg-white/70 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(45,45,45,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#2b3335]">Аналитические cookies</div>
                  <div className="text-xs text-[#5d6568]">Яндекс.Метрика для статистики и улучшения сервиса</div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#7dbf38]"
                    checked={analyticsEnabled}
                    onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!showDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="cookie-consent-btn-soft"
              >
                Настроить
              </button>
            )}
            {showDetails ? (
              <button
                type="button"
                onClick={() => saveConsent(analyticsEnabled)}
                className="cookie-consent-btn-soft"
              >
                Сохранить выбор
              </button>
            ) : (
              <button
                type="button"
                onClick={() => saveConsent(false)}
                className="cookie-consent-btn-soft"
              >
                Только обязательные
              </button>
            )}
            <button type="button" onClick={() => saveConsent(true)} className="cookie-consent-btn-accept">
              Принять все
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
