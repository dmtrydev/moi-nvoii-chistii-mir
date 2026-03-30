/** Парсинг и нормализация кодов ФККО на сервере (общий модуль для API). */

export function normalizeFkkoCode(v) {
  return String(v ?? '')
    .trim()
    .replace(/[^\d]+/g, '');
}

export function splitGluedDigitsToFkkoCodes(digitsOnly) {
  const d = normalizeFkkoCode(digitsOnly);
  if (!d) return [];
  if (d.length === 11) return /^\d{11}$/.test(d) ? [d] : [];
  if (d.length > 11 && d.length % 11 === 0) {
    const out = [];
    for (let i = 0; i < d.length; i += 11) {
      const chunk = d.slice(i, i + 11);
      if (/^\d{11}$/.test(chunk)) out.push(chunk);
    }
    return out;
  }
  const m = d.match(/\d{11}/g) ?? [];
  return m.filter((x) => /^\d{11}$/.test(x));
}

function formatFkkoTokensToCodes(tokens) {
  const t = Array.isArray(tokens) ? tokens.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  if (t.length < 6) return [];
  const out = [];
  for (let i = 0; i + 5 < t.length; i += 6) {
    const code = normalizeFkkoCode(t.slice(i, i + 6).join(' '));
    if (/^\d{11}$/.test(code)) out.push(code);
  }
  return out;
}

export function extractFkkoCodesFromText(v) {
  const s = String(v ?? '').trim();
  if (!s) return [];

  const tokens = s.match(/\d+/g) ?? [];
  const grouped = formatFkkoTokensToCodes(tokens);

  if (grouped.length === 0) {
    const chunks = s.split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);
    const out = [];
    for (const ch of chunks) {
      const digits = normalizeFkkoCode(ch);
      if (!digits) continue;
      if (/^\d{11}$/.test(digits)) {
        out.push(digits);
        continue;
      }
      out.push(...splitGluedDigitsToFkkoCodes(digits));
    }
    if (out.length > 0) return [...new Set(out)];
    return [...new Set(splitGluedDigitsToFkkoCodes(s))];
  }

  return [...new Set(grouped)];
}

export function parseFkkoInput(v) {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .map(normalizeFkkoCode)
      .filter(Boolean);
  }

  const s = String(v).trim();
  if (!s) return [];

  return extractFkkoCodesFromText(s);
}
