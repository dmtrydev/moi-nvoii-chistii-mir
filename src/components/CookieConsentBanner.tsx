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
    <div className="fixed bottom-4 right-4 z-[1202] w-[min(420px,calc(100vw-1.5rem))] sm:bottom-5 sm:right-5">
      <div className="cookie-consent-shell p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="cookie-consent-kicker">Настройки cookies</div>
            <h2 className="typo-h2 mt-1 text-ink">Мы используем cookies</h2>
            <p className="mt-1.5 text-xs text-ink-muted sm:text-sm">
              Обязательные cookies нужны для входа и безопасности сервиса. Аналитические cookies
              (Яндекс.Метрика) включаются только с вашего согласия.
            </p>
            <p className="mt-1.5 text-[11px] text-ink-muted sm:text-xs">
              Подробнее: <Link to="/consent/personal-data" className="glass-link">Согласие</Link>
              {' · '}
              <Link to="/privacy-policy" className="glass-link">Политика обработки ПДн</Link>
              {' · '}
              <Link to="/cookie-policy" className="glass-link">Cookie Policy</Link>
            </p>
          </div>
          {showDetails && (
            <div className="mt-1.5 rounded-xl bg-white/60 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(45,45,45,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#2b3335] sm:text-sm">Аналитические cookies</div>
                  <div className="text-[11px] text-[#5d6568] sm:text-xs">Яндекс.Метрика для статистики и улучшения сервиса</div>
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
          )}
          <div className="flex shrink-0 flex-wrap gap-1.5 sm:gap-2">
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
