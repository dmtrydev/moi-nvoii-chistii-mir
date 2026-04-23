const METRIKA_TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js';
const METRIKA_COUNTER_ID = 108683217;
const CONSENT_STORAGE_KEY = 'cookie_consent_v1';
const COOKIE_SETTINGS_EVENT = 'cookie-settings:open';
const CONSENT_VERSION = 2;
// Временный режим для проверки Метрики: грузим и трекаем сразу, без cookie consent.
const FORCE_ENABLE_METRIKA_FOR_TEST = true;

declare global {
  interface Window {
    ym?: ((...args: unknown[]) => void) & {
      a?: unknown[][];
      l?: number;
    };
  }
}

export type CookieConsentStatus = 'accepted' | 'rejected';
export type CookieConsentState = {
  version: number;
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

function normalizeConsentState(value: unknown): CookieConsentState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.necessary !== true) return null;
  if (typeof candidate.analytics !== 'boolean') return null;
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
      ? candidate.updatedAt
      : new Date().toISOString();
  return {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: candidate.analytics,
    updatedAt,
  };
}

function migrateLegacyConsent(raw: string): CookieConsentState | null {
  if (raw === 'accepted') {
    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: true,
      updatedAt: new Date().toISOString(),
    };
  }
  if (raw === 'rejected') {
    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: false,
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function getCookieConsentStatus(): CookieConsentStatus | null {
  const state = getCookieConsentState();
  if (!state) return null;
  return state.analytics ? 'accepted' : 'rejected';
}

export function getCookieConsentState(): CookieConsentState | null {
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return null;
  const migrated = migrateLegacyConsent(raw);
  if (migrated) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeConsentState(parsed);
    if (normalized) return normalized;
  } catch {
    return null;
  }
  return null;
}

export function setCookieConsentStatus(status: CookieConsentStatus): void {
  setCookieConsentState({
    version: CONSENT_VERSION,
    necessary: true,
    analytics: status === 'accepted',
    updatedAt: new Date().toISOString(),
  });
}

export function setCookieConsentState(state: CookieConsentState): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
}

export function hasConsentChoice(): boolean {
  return getCookieConsentState() !== null;
}

export function isAnalyticsEnabled(): boolean {
  if (FORCE_ENABLE_METRIKA_FOR_TEST) return true;
  return getCookieConsentState()?.analytics === true;
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
  if (!isAnalyticsEnabled()) return;
  window.ym?.(METRIKA_COUNTER_ID, 'hit', url, {
    referrer: document.referrer,
  });
}

export function applyCookieConsent(): void {
  if (!isAnalyticsEnabled()) return;
  initMetrika();
}

export function openCookieSettings(): void {
  window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT));
}

export function subscribeCookieSettingsOpen(handler: () => void): () => void {
  window.addEventListener(COOKIE_SETTINGS_EVENT, handler);
  return () => {
    window.removeEventListener(COOKIE_SETTINGS_EVENT, handler);
  };
}
