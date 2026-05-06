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

function clean(v) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function parseStatusRuToCode(statusRu) {
  const s = String(statusRu ?? '').toLowerCase();
  if (s.includes('действ')) return 'active';
  if (s.includes('исключ')) return 'excluded';
  return 'unknown';
}

function parseWastesFromRawTail(tail) {
  const block = String(tail ?? '').replace(/^~+/, '');
  if (!block) return [];
  return block
    .split('*')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const cells = row.split('~');
      const fkkoCode = normalizeFkkoCode(cells[0]);
      const wasteName = clean(cells[2] ?? cells[1]);
      if (!/^\d{11}$/.test(fkkoCode) || !wasteName) return null;
      return {
        fkkoCode,
        wasteName,
        hazardClass: fkkoCode.at(-1) ?? null,
        activityTypes: [DEFAULT_ACTIVITY],
      };
    })
    .filter(Boolean);
}

export function parseGroroObjectRaw(raw, sourceObjectId = null) {
  const [head, tail = ''] = String(raw ?? '').split('&');
  const p = String(head).split('~');
  if (p.length < 15) return null;
  const objectName = clean(p[0]);
  const regionRaw = clean(p[1]);
  const groroNumber = clean(p[2]);
  const statusRu = clean(p[3]) ?? 'Неизвестный';
  const status = parseStatusRuToCode(statusRu);
  const operatorName = clean(p[p.length - 6]) ?? clean(p[14]) ?? objectName;
  const operatorInn = clean(p[p.length - 5]) ?? clean(p[15]);
  const operatorAddress = clean(p[p.length - 4]) ?? clean(p[16]);
  const wastes = parseWastesFromRawTail(tail);
  if (!objectName || !groroNumber || wastes.length === 0) return null;
  return {
    sourceObjectId: sourceObjectId == null ? null : String(sourceObjectId),
    groroNumber,
    registryStatus: status,
    registryStatusRu: statusRu,
    objectName,
    region: regionRaw ? regionRaw.replace(/\s*\(\d+\)\s*$/, '') : null,
    operatorName,
    operatorInn,
    operatorAddress,
    wastes,
  };
}

export async function fetchGroroObjectById(idObject, fetchImpl = fetch) {
  const body = new URLSearchParams({
    function: 'getObjectItem',
    idObject: String(idObject),
  });
  const res = await fetchImpl('https://www.airsoft-bit.ru/media/eco_catalog/groro/groroGetData.php', {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`GRORO id fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const parsed = parseGroroObjectRaw(text, idObject);
  if (!parsed) throw new Error('GRORO raw object parse failed');
  return parsed;
}

