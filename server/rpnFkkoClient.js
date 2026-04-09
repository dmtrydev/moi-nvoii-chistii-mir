/**
 * Наименования видов отходов по коду ФККО с официального поиска Росприроднадзора:
 * POST https://rpn.gov.ru/fkko/?search=<код> + form AJAX=Y (как в компоненте Bitrix fkko.list).
 */
import { normalizeFkkoCode } from './fkkoServer.js';

const RPN_FKKO_URL = 'https://rpn.gov.ru/fkko/';
const USER_AGENT =
  'Mozilla/5.0 (compatible; moinoviichistiimir/1.0; +https://app.moinovichistimir.ru)';
const TITLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 2 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;

/** @type {Map<string, { title: string | null, exp: number }>} */
const cache = new Map();

function decodeHtmlEntities(s) {
  return String(s ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Парсинг фрагмента HTML ответа поиска: ссылки /fkko/<11 цифр>/ */
export function extractTitlesFromRpnHtml(html) {
  const out = new Map();
  const re = /<a[^>]*\bclass="fkko-item"[^>]*href="\/fkko\/(\d{11})\/"[^>]*>([^<]*)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    const title = decodeHtmlEntities(m[2]).replace(/\s+/g, ' ').trim();
    if (title) out.set(code, title);
  }
  return out;
}

function abortAfter(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, cancel: () => clearTimeout(t) };
}

/**
 * @param {string} code11
 * @returns {Promise<string | null>}
 */
export async function fetchFkkoTitleFromRpn(code11) {
  const code = normalizeFkkoCode(code11);
  if (!/^\d{11}$/.test(code)) return null;

  const now = Date.now();
  const hit = cache.get(code);
  if (hit && hit.exp > now) return hit.title;

  const url = new URL(RPN_FKKO_URL);
  url.searchParams.set('search', code);

  const { signal, cancel } = abortAfter(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ AJAX: 'Y' }).toString(),
      signal,
    });

    if (!res.ok) {
      console.warn(`RPN FKKO lookup HTTP ${res.status} for ${code}`);
      cache.set(code, { title: null, exp: now + MISS_TTL_MS });
      return null;
    }

    const html = await res.text();
    const map = extractTitlesFromRpnHtml(html);
    const title = map.get(code) ?? null;

    cache.set(code, {
      title,
      exp: now + (title ? TITLE_TTL_MS : MISS_TTL_MS),
    });
    return title;
  } catch (e) {
    console.warn(`RPN FKKO lookup failed for ${code}:`, e instanceof Error ? e.message : e);
    cache.set(code, { title: null, exp: now + MISS_TTL_MS });
    return null;
  } finally {
    cancel();
  }
}

/**
 * @param {string[]} codes
 * @param {{ concurrency?: number, delayMs?: number }} [opts]
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchFkkoTitlesBatched(codes, opts = {}) {
  const concurrency = Math.max(1, Math.min(Number(opts.concurrency) || 2, 6));
  const delayMs = Math.max(0, Number(opts.delayMs) || 280);

  const normalized = [
    ...new Set(
      codes.map((c) => normalizeFkkoCode(c)).filter((c) => /^\d{11}$/.test(c)),
    ),
  ];

  const out = /** @type {Record<string, string>} */ ({});
  let index = 0;

  async function worker() {
    for (;;) {
      const i = index++;
      if (i >= normalized.length) break;
      const code = normalized[i];
      const title = await fetchFkkoTitleFromRpn(code);
      if (title) out[code] = title;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const n = Math.min(concurrency, normalized.length);
  if (n === 0) return out;
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}
