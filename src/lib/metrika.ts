const METRIKA_TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js';
const METRIKA_COUNTER_ID = 108683217;
const CONSENT_STORAGE_KEY = 'cookie_consent_v1';

declare global {
  interface Window {
    ym?: ((...args: unknown[]) => void) & {
      a?: unknown[][];
      l?: number;
    };
  }
}

export type CookieConsentStatus = 'accepted' | 'rejected';

export function getCookieConsentStatus(): CookieConsentStatus | null {
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (raw === 'accepted' || raw === 'rejected') return raw;
  return null;
}

export function setCookieConsentStatus(status: CookieConsentStatus): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, status);
}

function ensureYmQueue(): void {
  if (typeof window.ym === 'function') return;
  const ymQueue = (...args: unknown[]) => {
    ymQueue.a = ymQueue.a || [];
    ymQueue.a.push(args);
  };
  ymQueue.l = Date.now();
  window.ym = ymQueue;
}

function hasMetrikaScript(): boolean {
  return Array.from(document.scripts).some((s) => s.src.includes(METRIKA_TAG_SRC));
}

export function initMetrika(): void {
  if (hasMetrikaScript()) return;
  ensureYmQueue();

  const script = document.createElement('script');
  script.async = true;
  script.src = `${METRIKA_TAG_SRC}?id=${METRIKA_COUNTER_ID}`;
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  window.ym?.(METRIKA_COUNTER_ID, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

export function trackMetrikaPage(url: string): void {
  if (getCookieConsentStatus() !== 'accepted') return;
  window.ym?.(METRIKA_COUNTER_ID, 'hit', url, {
    referrer: document.referrer,
  });
}
