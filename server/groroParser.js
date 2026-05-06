import { normalizeFkkoCode } from './fkkoServer.js';

const DEFAULT_ACTIVITY = 'Размещение';

function stripHtml(input) {
  return String(input ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '"')
    .replace(/&raquo;/g, '"')
    .replace(/&#171;/g, '"')
    .replace(/&#187;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) != null) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    if (cells.length < 2) continue;
    rows.push([stripHtml(cells[0][1]), stripHtml(cells[1][1])]);
  }
  return rows;
}

function parseWasteRows(rows) {
  const out = [];
  for (const [c1, c2, c3] of rows) {
    const fkko = normalizeFkkoCode(c1);
    if (!/^\d{11}$/.test(fkko)) continue;
    const wasteName = String(c3 ?? c2 ?? '').trim();
    if (!wasteName) continue;
    out.push({
      fkkoCode: fkko,
      wasteName,
      hazardClass: fkko[10] || null,
      activityTypes: [DEFAULT_ACTIVITY],
    });
  }
  return out;
}

function parseWasteTable(html) {
  const tableRe =
    /Размещаемые\s+отходы[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i;
  const match = html.match(tableRe);
  if (!match) return [];

  const tableHtml = match[1];
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(tableHtml)) != null) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      stripHtml(c[1]),
    );
    if (cells.length >= 2) rows.push(cells);
  }
  return parseWasteRows(rows);
}

function pickByLabel(rows, label) {
  const found = rows.find((r) => r[0].toLowerCase() === label.toLowerCase());
  return found?.[1] ? String(found[1]).trim() : null;
}

function parseCardTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripHtml(title[1]) : '';
}

export function parseGroroCardHtml(html) {
  const rows = parseRows(html);
  const wastes = parseWasteTable(html);

  const groroNumber = pickByLabel(rows, 'Номер объекта');
  const registryStatusRu = pickByLabel(rows, 'Статус');
  const registryStatus = String(registryStatusRu ?? '')
    .toLowerCase()
    .includes('действ')
    ? 'active'
    : 'unknown';
  const region = pickByLabel(rows, 'Регион ОРО');
  const objectName = parseCardTitle(html);
  const operatorName = pickByLabel(rows, 'Наименование');
  const operatorInn = pickByLabel(rows, 'ИНН');
  const operatorAddress =
    pickByLabel(rows, 'Юридический адрес') ?? pickByLabel(rows, 'Почтовый адрес');

  return {
    groroNumber,
    registryStatus,
    registryStatusRu,
    objectName,
    region,
    operatorName,
    operatorInn,
    operatorAddress,
    wastes,
  };
}

export async function fetchGroroCard(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { headers: { Accept: 'text/html,*/*' } });
  if (!res.ok) {
    throw new Error(`GRORO card fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  return parseGroroCardHtml(html);
}

