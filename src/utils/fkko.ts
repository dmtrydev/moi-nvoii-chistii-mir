export function normalizeFkkoDigits(v: string): string {
  return String(v ?? '').trim().replace(/[^\d]+/g, '');
}

function uniqueStable(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!it) continue;
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}

function splitGluedDigitsToFkkoCodes(digitsOnly: string): string[] {
  const d = normalizeFkkoDigits(digitsOnly);
  if (!d) return [];
  if (d.length === 11) return [/^\d{11}$/.test(d) ? d : ''].filter(Boolean);
  if (d.length > 11 && d.length % 11 === 0) {
    const out: string[] = [];
    for (let i = 0; i < d.length; i += 11) {
      const chunk = d.slice(i, i + 11);
      if (/^\d{11}$/.test(chunk)) out.push(chunk);
    }
    return out;
  }
  const matches = d.match(/\d{11}/g) ?? [];
  return matches.filter((x) => /^\d{11}$/.test(x));
}

function groupTokensToCodes(tokens: string[]): string[] {
  const t = tokens.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (t.length < 6) return [];
  const out: string[] = [];
  for (let i = 0; i + 5 < t.length; i += 6) {
    const code = normalizeFkkoDigits(t.slice(i, i + 6).join(' '));
    if (/^\d{11}$/.test(code)) out.push(code);
  }
  return out;
}

export function parseFkkoCodesFromText(v: string): string[] {
  const s = String(v ?? '').trim();
  if (!s) return [];

  const tokens = s.match(/\d+/g) ?? [];
  const grouped = groupTokensToCodes(tokens);
  if (grouped.length) return uniqueStable(grouped);

  // Фолбэк: коды могут быть перечислены через запятую/перевод строки,
  // либо ошибочно "склеены" в одну строку цифр.
  const roughChunks = s.split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const ch of roughChunks) {
    const digits = normalizeFkkoDigits(ch);
    if (!digits) continue;
    if (/^\d{11}$/.test(digits)) {
      out.push(digits);
      continue;
    }
    out.push(...splitGluedDigitsToFkkoCodes(digits));
  }
  if (out.length > 0) return uniqueStable(out);

  // Последний шанс: если вообще нет разделителей, но есть цифры.
  return uniqueStable(splitGluedDigitsToFkkoCodes(s));
}

export function formatFkkoHuman(codeDigits: string): string {
  const s = normalizeFkkoDigits(codeDigits);
  // Типовой формат ФККО: X XX XXX XX XX X (11 цифр)
  if (/^\d{11}$/.test(s)) {
    return `${s.slice(0, 1)} ${s.slice(1, 3)} ${s.slice(3, 6)} ${s.slice(6, 8)} ${s.slice(8, 10)} ${s.slice(10)}`;
  }
  return s;
}

/** Уникальные валидные 11-значные коды из списка строк. */
export function normalizeFkkoCodeList(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of codes) {
    const d = normalizeFkkoDigits(String(x));
    if (/^\d{11}$/.test(d) && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

/** Парсинг параметра fkko из URL/запроса (одна строка, один или несколько кодов). */
export function parseFkkoCodesFromQuery(s: string): string[] {
  return normalizeFkkoCodeList(parseFkkoCodesFromText(s));
}

/** Сериализация массива кодов в строку для query (через запятую). */
export function fkkoCodesToQueryParam(codes: string[]): string {
  return normalizeFkkoCodeList(codes).join(',');
}

/** Краткая подпись на кнопке мультивыбора ФККО: «Выбрано: N …». */
export function formatFkkoSelectionSummary(codes: string[]): string {
  const n = normalizeFkkoCodeList(codes).length;
  if (n === 0) return '';
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word: string;
  if (mod100 >= 11 && mod100 <= 14) word = 'кодов ФККО';
  else if (mod10 === 1) word = 'код ФККО';
  else if (mod10 >= 2 && mod10 <= 4) word = 'кода ФККО';
  else word = 'кодов ФККО';
  return `Выбрано: ${n} ${word}`;
}

