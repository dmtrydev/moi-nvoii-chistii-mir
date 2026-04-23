import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyCookieConsent,
  hasConsentChoice,
  setCookieConsentState,
} from '@/lib/metrika';

export function CookieConsentBanner(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(() => !hasConsentChoice());

  if (!isOpen) return null;

  function acceptCookies(): void {
    setCookieConsentState({
      version: 2,
      necessary: true,
      analytics: true,
      updatedAt: new Date().toISOString(),
    });
    applyCookieConsent();
    setIsOpen(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[1202] w-[min(280px,calc(100vw-1.5rem))] sm:bottom-5 sm:right-5">
      <div className="rounded-2xl border border-black/10 bg-[#f3f5f4] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.18)]">
        <p className="text-[22px] leading-tight font-semibold text-[#1f2a24]">
          Мы используем cookie и Яндекс.Метрику для аналитики
        </p>
        <p className="mt-3 text-xs leading-5 text-[#5f6763]">
          Продолжая использование сайта, вы даете согласие на обработку данных.
        </p>
        <div className="mt-2">
          <Link to="/privacy-policy" className="text-xs font-semibold text-[#4d5a53] underline underline-offset-4">
            Политика конфиденциальности
          </Link>
        </div>
        <div className="mt-4">
          <button type="button" onClick={acceptCookies} className="w-full rounded-xl bg-[#1f2328] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] transition hover:bg-[#171a1d]">
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}
