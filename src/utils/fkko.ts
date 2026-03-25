export function normalizeFkkoDigits(v: string): string {
  return String(v ?? '').trim().replace(/[^\d]+/g, '');
}

function groupTokensToCodes(tokens: string[]): string[] {
  const t = tokens.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (t.length < 6) return [];
  const out: string[] = [];
  for (let i = 0; i + 5 < t.length; i += 6) {
    const code = normalizeFkkoDigits(t.slice(i, i + 6).join(' '));
    if (code) out.push(code);
  }
  return out;
}

export function parseFkkoCodesFromText(v: string): string[] {
  const s = String(v ?? '').trim();
  if (!s) return [];

  const tokens = s.match(/\d+/g) ?? [];
  const grouped = groupTokensToCodes(tokens);
  if (grouped.length) return [...new Set(grouped)];

  const chunks = s
    .split(/[,\n;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(normalizeFkkoDigits)
    .filter(Boolean);
  return [...new Set(chunks)];
}

export function formatFkkoHuman(codeDigits: string): string {
  const s = normalizeFkkoDigits(codeDigits);
  // Типовой формат ФККО: X XX XXX XX XX X (11 цифр)
  if (/^\d{11}$/.test(s)) {
    return `${s.slice(0, 1)} ${s.slice(1, 3)} ${s.slice(3, 6)} ${s.slice(6, 8)} ${s.slice(8, 10)} ${s.slice(10)}`;
  }
  return s;
}

