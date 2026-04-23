import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyCookieConsent,
  isAnalyticsEnabled,
  setCookieConsentState,
} from '@/lib/metrika';

export function CookieConsentBanner(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(() => !isAnalyticsEnabled());

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
    <div className="fixed bottom-4 right-4 z-[1202] w-[min(360px,calc(100vw-1.5rem))] sm:bottom-5 sm:right-5">
      <div className="relative overflow-hidden rounded-[24px] border-[none] bg-[#ffffff4c] p-5 backdrop-blur-[10px] backdrop-brightness-[100%] shadow-[0_18px_40px_rgba(15,23,42,0.16)] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[24px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
        <div className="relative z-[2]">
        <p className="font-nunito text-[20px] leading-tight font-semibold text-[#2b3335]">
          Мы используем cookie и Яндекс.Метрику для аналитики
        </p>
        <p className="mt-2.5 font-nunito text-sm leading-5 text-[#5e6567]">
          Продолжая использование сайта, вы даете согласие на обработку данных.
        </p>
        <div className="mt-2">
          <Link to="/privacy-policy" className="font-nunito text-xs font-semibold text-[#5e6567] underline underline-offset-4 transition-colors hover:text-[#2b3335]">
            Политика конфиденциальности
          </Link>
        </div>
        <div className="mt-4">
          <button type="button" onClick={acceptCookies} className="group relative home-find-button z-[2] flex h-[60px] w-full min-w-0 items-center justify-center overflow-hidden rounded-[20px] border-[none] cursor-pointer before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2">
            <span className="relative z-[2] font-nunito text-xl font-semibold text-[#2b3335]">Принять</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
