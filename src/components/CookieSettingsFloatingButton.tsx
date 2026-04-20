import { openCookieSettings } from '@/lib/metrika';

export function CookieSettingsFloatingButton(): JSX.Element {
  return (
    <div className="fixed bottom-4 right-4 z-[1201] sm:bottom-5 sm:right-5">
      <button
        type="button"
        onClick={() => openCookieSettings()}
        className="cookie-consent-btn-soft !h-10 !px-4 shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur-md"
        aria-label="Открыть настройки cookies"
      >
        Настройки cookies
      </button>
    </div>
  );
}
