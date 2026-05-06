import { normalizeInn } from './innUtils.js';

function stripHtml(input) {
  return String(input ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInn(text) {
  const m = String(text ?? '').match(/ИНН\D*([0-9]{10,12})/i);
  return normalizeInn(m?.[1] ?? null);
}

function extractAddress(text) {
  const m = String(text ?? '').match(/\b(?:Юридический\s+адрес|Адрес)[:\s]*([^|]+?)(?=\bОГРН\b|\bИНН\b|$)/i);
  return m?.[1] ? String(m[1]).trim() : null;
}

export async function enrichFromRusprofile({ queryName, fallbackAddress }, fetchImpl = fetch) {
  const q = String(queryName ?? '').trim();
  if (!q) return null;
  const searchUrl = `https://www.rusprofile.ru/search?query=${encodeURIComponent(q)}`;
  const res = await fetchImpl(searchUrl, { headers: { Accept: 'text/html,*/*' } });
  if (!res.ok) return null;
  const html = await res.text();
  const text = stripHtml(html);
  const innNorm = extractInn(text);
  const legalAddress = extractAddress(text) || String(fallbackAddress ?? '').trim() || null;
  if (!innNorm && !legalAddress) return null;
  return { innNorm, legalAddress };
}

