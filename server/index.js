import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import fsPromises from 'node:fs/promises';
import https from 'node:https';
import { URL as NodeURL } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { query, getPool } from './db.js';
import { authMiddleware, requireRole, requireAuth } from './auth.js';
import { createAuditLog } from './audit.js';
import { rateLimit } from './rateLimit.js';
import adminRouter from './adminRoutes.js';
import authRouter from './authRoutes.js';
import cadastreRouter from './cadastreRoutes.js';
import userRouter from './userRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;

async function ensureDatabaseSchema() {
  // Важно для Render: там Postgres обычно отдельный сервис, и таблицы создаются
  // либо автоматически, либо руками в SQL editor. Чтобы не зависеть от ручных шагов,
  // безопасно применяем наши init/migrations при старте (в SQL есть IF NOT EXISTS).
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL не задан — пропускаю инициализацию БД');
    return;
  }

  const initSqlPath = path.join(__dirname, 'db', 'init.sql');
  const dashboardMigrationPath = path.join(__dirname, 'db', 'migrations', 'eco-auth-dashboard.sql');

  try {
    // sessions.id использует gen_random_uuid() — для этого нужна pgcrypto.
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    const initSql = await fsPromises.readFile(initSqlPath, 'utf8');
    await query(initSql);

    const dashboardSql = await fsPromises.readFile(dashboardMigrationPath, 'utf8');
    await query(dashboardSql);

    console.log('DB schema initialized/ensured');
  } catch (err) {
    console.error('DB schema initialization failed:', err instanceof Error ? err.message : err);
    throw err;
  }
}

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use((req, res, next) => {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://agent.timeweb.cloud https://api.openai.com",
    // Разрешаем загрузку внешней кадастровой подложки в iframe.
    // Нужна, чтобы VITE_CADASTRE_IFRAME_URL работал в проде.
    "frame-src 'self' https://ik8map.roscadastres.com",
    "frame-ancestors 'none'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

/** Прокси ArcGIS export ПКК6 (тайлы с того же origin, иначе CORS / canvas). */
// Важно: pkk.rosreestr.ru часто редиректит запросы /arcgis/ на nspd.gov.ru — задайте рабочий CADASTRE_EXPORT_BASE или используйте фронтовый iframe (VITE_CADASTRE_IFRAME_URL).
const CADASTRE_EXPORT_BASE =
  String(process.env.CADASTRE_EXPORT_BASE ?? '').trim() ||
  'https://pkk.rosreestr.ru/arcgis/rest/services/PKK6/CadastreObjects/MapServer/export';

function cadastreHttpsGet(targetUrl) {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(targetUrl);
    const relaxTls =
      u.hostname === 'pkk.rosreestr.ru' || String(process.env.CADASTRE_TLS_INSECURE ?? '').trim() === '1';
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || 443,
        method: 'GET',
        headers: {
          Accept: 'image/png,image/*,*/*',
          Referer: 'https://pkk.rosreestr.ru/',
        },
        rejectUnauthorized: !relaxTls,
      },
      (upstream) => {
        const chunks = [];
        upstream.on('data', (c) => chunks.push(c));
        upstream.on('end', () => {
          resolve({
            statusCode: upstream.statusCode ?? 502,
            headers: upstream.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

app.get('/api/cadastre-export', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  if (!qs) {
    return res.status(400).json({ message: 'Пустой запрос' });
  }
  const targetUrl = `${CADASTRE_EXPORT_BASE}?${qs}`;
  try {
    const upstream = await cadastreHttpsGet(targetUrl);
    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      return res.status(upstream.statusCode).end();
    }
    const ct = upstream.headers['content-type'];
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(upstream.body);
  } catch {
    res.status(502).json({ message: 'Кадастровый слой недоступен' });
  }
});

app.use('/api/cadastre', cadastreRouter);

app.use('/api/', rateLimit({ name: 'global', windowMs: 60_000, max: 100 }));

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

function normalizeFkkoCode(v) {
  // FKKO часто пишут с пробелами: "7 31 100 01 40 4"
  // Для стабильного сравнения нормализуем до "73110001404".
  return String(v ?? '')
    .trim()
    .replace(/[^\d]+/g, '');
}

function splitGluedDigitsToFkkoCodes(digitsOnly) {
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

function extractFkkoCodesFromText(v) {
  const s = String(v ?? '').trim();
  if (!s) return [];

  // Универсально: берём все группы цифр и собираем по 6 сегментов (формат X XX XXX XX XX X).
  // Это покрывает случаи, когда ИИ ошибочно вставляет запятые между каждым сегментом:
  // "4, 71, 101, 01, 52, 1, 4, 06, 110, 01, 31, 3, ..."
  const tokens = s.match(/\d+/g) ?? [];
  const grouped = formatFkkoTokensToCodes(tokens);

  // Если токенов < 6 или не получилось группировать — попробуем режим "коды разделены запятыми/точкой с запятой/переводом строки".
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

  // Дедуп + стабильный порядок
  return [...new Set(grouped)];
}

function parseFkkoInput(v) {
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

  // Принимаем как "7 31 100 01 40 4", так и список кодов.
  // Также терпим ошибочный ввод/ответ ИИ вида "7, 31, 100, 01, 40, 4, 7, 31, 110, 01, 40, 4".
  return extractFkkoCodesFromText(s);
}

// Геокодирование: используем только Яндекс Геокодер (лучше всего подходит для РФ/юр. адресов).
const YANDEX_GEOCODER_API_KEY = String(process.env.YANDEX_GEOCODER_API_KEY ?? '').trim();

function parseYandexPos(pos) {
  // Yandex returns "lon lat"
  const s = String(pos ?? '').trim();
  if (!s) return null;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lon = Number.parseFloat(parts[0]);
  const lat = Number.parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lng: lon };
}

async function geocodeAddressYandex(address) {
  if (!YANDEX_GEOCODER_API_KEY) return null;
  const a = String(address ?? '').trim();
  if (!a) return null;
  const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(
    YANDEX_GEOCODER_API_KEY
  )}&format=json&results=1&lang=ru_RU&geocode=${encodeURIComponent(a)}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      const msg = `Yandex geocoder HTTP ${r.status}${body ? `: ${body.slice(0, 500)}` : ''}`;
      throw new Error(msg);
    }
    const json = await r.json();
    const pos =
      json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos ?? '';
    return parseYandexPos(pos);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Yandex geocoder request failed');
  }
}

async function geocodeAddressBestEffort(address) {
  // Только Яндекс. Если нет ключа или адрес не найден — null.
  return await geocodeAddressYandex(address);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'application/pdf';
    const okExt = file.originalname && file.originalname.toLowerCase().endsWith('.pdf');
    if (okMime && okExt) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только файлы с расширением .pdf'));
    }
  },
});

// VirusTotal API v3 — проверка файла перед обработкой
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VT_BASE = 'https://www.virustotal.com/api/v3';

async function scanFileWithVirusTotal(buffer, filename) {
  if (!VIRUSTOTAL_API_KEY) return { skip: true };
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename || 'document.pdf');
  const uploadRes = await fetch(`${VT_BASE}/files`, {
    method: 'POST',
    headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
    body: form,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`VirusTotal upload: ${uploadRes.status} ${err}`);
  }
  const { data } = await uploadRes.json();
  const analysisId = data?.id;
  if (!analysisId) throw new Error('VirusTotal: no analysis id');

  const maxAttempts = 24;
  const pollMs = 2500;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const analysisRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
      headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
    });
    if (!analysisRes.ok) throw new Error(`VirusTotal analysis: ${analysisRes.status}`);
    const analysisJson = await analysisRes.json();
    const attrs = analysisJson?.data?.attributes;
    const status = attrs?.status;
    if (status === 'completed') {
      const stats = attrs?.stats ?? {};
      const malicious = Number(stats.malicious ?? 0);
      const suspicious = Number(stats.suspicious ?? 0);
      return { malicious, suspicious, clean: malicious === 0 && suspicious === 0 };
    }
    if (status === 'queued' || status === 'in-progress') continue;
    throw new Error(`VirusTotal: unexpected status ${status}`);
  }
  throw new Error('VirusTotal: анализ занял слишком много времени');
}

// Timeweb Cloud AI (OpenAI-совместимый endpoint)
const TIMEWEB_ACCESS_ID = process.env.TIMEWEB_ACCESS_ID;
const TIMEWEB_BEARER_TOKEN = process.env.TIMEWEB_BEARER_TOKEN || TIMEWEB_ACCESS_ID;
const TIMEWEB_BASE = TIMEWEB_ACCESS_ID
  ? `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${TIMEWEB_ACCESS_ID}/v1`
  : null;

// Проверка, что API доступен (для отладки и прокси)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'analyze-license' });
});

const EXTRACT_PROMPT = `Извлеки из текста лицензии (или документа об обращении с отходами) структурированные данные.

Ответь СТРОГО валидным JSON (без markdown-обрамления, без комментариев, без пояснений). Никакого текста до/после JSON.

Схема ответа:
{
  "companyName": "полное наименование организации (строка)",
  "inn": "ИНН (строка, только цифры если возможно)",
  "region": "регион РФ (например: Челябинская область, Республика Башкортостан, Краснодарский край). Если можно — выбери именно регион, не город.",
  "addressAliases": {
    "Адрес 1": "полный адрес из перечня адресов",
    "Адрес 2": "полный адрес из перечня адресов"
  },
  "sites": [
    {
      "address": "полный адрес площадки ИЛИ ссылка вида 'Адрес 1'",
      "entries": [
        {
          "fkkoCode": "4 71 101 01 52 1",
          "wasteName": "лампы ртутные, ртутно-кварцевые, люминесцентные, утратившие потребительские свойства",
          "hazardClass": "I",
          "activityTypes": ["Сбор"]
        },
        {
          "fkkoCode": "3 61 222 03 39 3",
          "wasteName": "шлам шлифовальный маслосодержащий",
          "hazardClass": "III",
          "activityTypes": ["Сбор", "Обезвреживание", "Транспортирование"]
        }
      ]
    }
  ]
}

ВАЖНЕЙШИЕ ПРАВИЛА:
- КАЖДАЯ строка таблицы в лицензии — это привязка одного кода ФККО к одному виду работы на одном адресе.
- Группируй по (адрес + код ФККО): все виды работ для одного кода ФККО на одном адресе объединяй в один элемент entries[] с массивом activityTypes.
- entries[].fkkoCode: код ФККО с пробелами как в исходнике (пример: 4 71 101 01 52 1). НЕ ставь запятые между частями одного кода.
- entries[].wasteName: наименование вида отхода из таблицы.
- entries[].hazardClass: класс опасности (I, II, III, IV, V).
- entries[].activityTypes: массив видов работ ТОЛЬКО для этого конкретного кода ФККО. Допустимые значения: Сбор, Транспортирование, Обезвреживание, Утилизация, Размещение, Обработка, Захоронение.
- Если в таблице в колонке адреса написано 'Адрес 1', 'Адрес 2' и т.п. — верни именно 'Адрес 1' в sites[].address и ОБЯЗАТЕЛЬНО добавь расшифровку в addressAliases.
- Если адресов несколько — создавай отдельные элементы sites[] для каждого адреса.
- НЕ ТЕРЯЙ привязку: каждый код ФККО привязан к конкретному адресу и конкретным видам работ. Не смешивай!
- Если какого-то поля нет — верни пустую строку или пустой массив.`;

function guessRegionFromAddress(address) {
  const a = String(address || '').trim();
  if (!a) return '';

  // Берём самый похожий кусок из адреса (до первой запятой), либо любой сегмент с ключевыми словами.
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean);
  const withKeywords = parts.find((p) =>
    /(область|край|республика|округ|АО|А\.О\.)/i.test(p)
  );
  if (withKeywords) return withKeywords;

  const first = parts[0] ?? '';
  return first.length <= 80 ? first : '';
}

async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text ?? '';
  } finally {
    await parser.destroy();
  }
}

function extractHeaderText(fullText) {
  const lines = fullText.split('\n');
  const headerLines = [];
  const pageBreakRe = /^--\s*\d+\s+of\s+\d+\s*--$/;
  const fkkoLineRe = /\d\s+\d{2}\s+\d{3}\s+\d{2}\s+\d{2}\s+\d|\d{11}/;
  const tableHeaderRe = /Наименование вида|Код отхода/i;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || pageBreakRe.test(trimmed)) continue;
    headerLines.push(trimmed);
    if (/^(9|10)\.\s/.test(trimmed) || /лицензируемый вид деятельности/i.test(trimmed)) {
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const next = lines[j].trim();
        if (!next || pageBreakRe.test(next)) continue;
        if (fkkoLineRe.test(next) || tableHeaderRe.test(next)) break;
        headerLines.push(next);
      }
      break;
    }
  }
  return headerLines.join('\n').slice(0, 4000);
}

const KNOWN_ACTIVITIES = ['Сбор', 'Транспортирование', 'Обезвреживание', 'Утилизация', 'Размещение', 'Обработка', 'Захоронение'];

function parseFkkoTableFromText(fullText) {
  const lines = fullText.split('\n');
  const rawEntries = [];
  const fkkoSpacedRe = /(\d)\s+(\d{2})\s+(\d{3})\s+(\d{2})\s+(\d{2})\s+(\d)/;
  const fkkoCompactRe = /(\d{11})/;
  const pageBreakRe = /^--\s*\d+\s+of\s+\d+\s*--$/;
  const addressAliases = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const aliasMatch = line.match(/^Адрес\s+(\d+)\s*:\s*(.+)/i);
    if (aliasMatch) {
      let addr = aliasMatch[2].trim();
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nl = lines[j].trim();
        if (!nl || pageBreakRe.test(nl) || /^Адрес\s+\d+\s*:/i.test(nl)) break;
        if (fkkoSpacedRe.test(nl) || fkkoCompactRe.test(nl)) break;
        addr += ' ' + nl;
      }
      addressAliases[`Адрес ${aliasMatch[1]}`] = addr.replace(/\s+/g, ' ').trim();
    }

    let fkkoMatch = line.match(fkkoSpacedRe);
    let fkkoCode = '';
    let fkkoEnd = 0;

    if (fkkoMatch) {
      fkkoCode = fkkoMatch.slice(1, 7).join('');
      fkkoEnd = fkkoMatch.index + fkkoMatch[0].length;
    } else {
      fkkoMatch = line.match(fkkoCompactRe);
      if (fkkoMatch) {
        fkkoCode = fkkoMatch[1];
        fkkoEnd = fkkoMatch.index + fkkoMatch[0].length;
      }
    }

    if (!fkkoCode || !/^\d{11}$/.test(fkkoCode)) continue;
    if (/ОГРН|регистрационный|реестр|лицензи/i.test(line)) continue;

    const afterFkko = line.substring(fkkoEnd).trim();
    const beforeFkko = line.substring(0, fkkoMatch.index).trim();

    const hazardMatch = afterFkko.match(/\b(I{1,3}V?|IV|V)\b/);
    const hazardClass = hazardMatch ? hazardMatch[1] : '';

    let activityType = '';
    for (const act of KNOWN_ACTIVITIES) {
      if (afterFkko.includes(act)) { activityType = act; break; }
    }
    if (!activityType && /Транспортирова/.test(afterFkko)) {
      activityType = 'Транспортирование';
    }
    if (!activityType) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nl = lines[j].trim();
        if (/^ние\b/.test(nl)) { activityType = 'Транспортирование'; break; }
        for (const act of KNOWN_ACTIVITIES) {
          if (nl === act || nl.startsWith(act)) { activityType = act; break; }
        }
        if (activityType) break;
      }
    }

    const addrInLine = afterFkko.match(/Адрес\s+\d+/);
    let addressRef = addrInLine ? addrInLine[0] : '';
    if (!addressRef) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nl = lines[j].trim();
        const am = nl.match(/^Адрес\s+\d+/);
        if (am) { addressRef = am[0]; break; }
      }
    }
    if (!addressRef) {
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nl = lines[j].trim();
        if (!nl || pageBreakRe.test(nl) || /^ние$/.test(nl)) continue;
        if (fkkoSpacedRe.test(nl) || fkkoCompactRe.test(nl)) break;
        if (/^\d{6}/.test(nl) || /обл[,.\s]|область|край|р-н|район/i.test(nl)) {
          const addrParts = [nl];
          for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
            const al = lines[k].trim();
            if (!al || fkkoSpacedRe.test(al) || fkkoCompactRe.test(al)) break;
            if (/Наименование вида/i.test(al)) break;
            addrParts.push(al);
          }
          addressRef = addrParts.join(', ').replace(/,\s*,/g, ',').trim();
          break;
        }
      }
    }

    let wasteName = beforeFkko;
    if (wasteName.length < 5) {
      const wasteLines = [];
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const pl = lines[j].trim();
        if (!pl || pageBreakRe.test(pl)) continue;
        if (fkkoSpacedRe.test(pl) || fkkoCompactRe.test(pl)) break;
        if (/Наименование вида|Код отхода|Класс\s*опасно|Виды работ|Место осуществления/i.test(pl)) break;
        if (/^\d+$/.test(pl) && pl.length <= 3) continue;
        if (/Адрес\s+\d+$/.test(pl)) break;
        if (/^\d{6}/.test(pl)) break;
        let isAddr = false;
        for (const act of KNOWN_ACTIVITIES) { if (pl === act || pl.startsWith(act)) { isAddr = true; break; } }
        if (isAddr) break;
        wasteLines.unshift(pl);
      }
      if (wasteLines.length > 0) {
        wasteName = (wasteLines.join(' ') + (wasteName ? ' ' + wasteName : '')).trim();
      }
    }
    wasteName = wasteName
      .replace(/\s*(I{1,3}V?|IV|V)\s*(класс)?.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    rawEntries.push({ fkkoCode, wasteName, hazardClass, activityType, addressRef });
  }

  const siteMap = {};
  for (const e of rawEntries) {
    if (!e.activityType) continue;
    const addr = e.addressRef || 'unknown';
    if (!siteMap[addr]) siteMap[addr] = {};
    if (!siteMap[addr][e.fkkoCode]) {
      siteMap[addr][e.fkkoCode] = {
        fkkoCode: e.fkkoCode,
        wasteName: e.wasteName,
        hazardClass: e.hazardClass,
        activityTypes: [],
      };
    }
    const entry = siteMap[addr][e.fkkoCode];
    if (!entry.activityTypes.includes(e.activityType)) {
      entry.activityTypes.push(e.activityType);
    }
    if (!entry.wasteName && e.wasteName) entry.wasteName = e.wasteName;
    if (!entry.hazardClass && e.hazardClass) entry.hazardClass = e.hazardClass;
  }

  const sites = [];
  for (const [addr, codes] of Object.entries(siteMap)) {
    const resolved = addressAliases[addr] || addr;
    sites.push({
      address: resolved === 'unknown' ? '' : resolved,
      addressRef: addr,
      entries: Object.values(codes),
      fkkoCodes: [...new Set(Object.keys(codes))],
      activityTypes: [...new Set(Object.values(codes).flatMap((c) => c.activityTypes))],
    });
  }

  return { sites, addressAliases };
}

function normalizeAddressAliases(v) {
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const kk = String(k ?? '').trim();
    const vv = String(val ?? '').trim();
    if (!kk || !vv) continue;
    out[kk] = vv;
  }
  return out;
}

function normalizeAiSites(sites, addressAliases) {
  if (!Array.isArray(sites)) return [];
  const out = [];
  for (const it of sites) {
    const addrRaw = String(it?.address ?? '').trim();
    const resolved = addressAliases?.[addrRaw] || addrRaw;
    const address = resolved || addrRaw;

    let entries = [];
    if (Array.isArray(it?.entries)) {
      for (const e of it.entries) {
        const fkkoRaw = String(e?.fkkoCode ?? e?.fkko_code ?? '').trim();
        const fkkoCode = normalizeFkkoCode(fkkoRaw);
        if (!fkkoCode || !/^\d{11}$/.test(fkkoCode)) continue;
        const acts = Array.isArray(e?.activityTypes ?? e?.activity_types)
          ? (e.activityTypes ?? e.activity_types).map((x) => String(x ?? '').trim()).filter(Boolean)
          : [];
        if (acts.length === 0) continue;
        entries.push({
          fkkoCode,
          wasteName: String(e?.wasteName ?? e?.waste_name ?? '').trim(),
          hazardClass: String(e?.hazardClass ?? e?.hazard_class ?? '').trim(),
          activityTypes: acts,
        });
      }
    }
    if (entries.length === 0) {
      const fkkoRaw = Array.isArray(it?.fkkoCodes)
        ? it.fkkoCodes.map((x) => String(x ?? '').trim()).filter(Boolean).join(', ')
        : String(it?.fkkoCodes ?? '');
      const fkkoCodes = fkkoRaw ? extractFkkoCodesFromText(fkkoRaw) : [];
      const activityTypes = Array.isArray(it?.activityTypes)
        ? it.activityTypes.map((x) => String(x ?? '').trim()).filter(Boolean)
        : [];
      entries = fkkoCodes.map((code) => ({
        fkkoCode: code,
        wasteName: '',
        hazardClass: '',
        activityTypes: [...activityTypes],
      }));
    }

    const fkkoCodes = [...new Set(entries.map((e) => e.fkkoCode))];
    const activityTypes = [...new Set(entries.flatMap((e) => e.activityTypes))];
    if (!address && fkkoCodes.length === 0) continue;
    out.push({ address, addressRef: addrRaw, fkkoCodes, activityTypes, entries });
  }
  return out;
}

app.post('/api/analyze-license', upload.single('file'), async (req, res) => {
  let rawContent = '';
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    // Проверка на вирусы временно отключена. Чтобы включить — раскомментируйте блок ниже и задайте VIRUSTOTAL_API_KEY.
    // try {
    //   const vtResult = await scanFileWithVirusTotal(file.buffer, file.originalname);
    //   if (!vtResult.skip && !vtResult.clean) {
    //     return res.status(422).json({
    //       message: 'Файл не прошёл проверку безопасности. Загрузите другой PDF-документ.',
    //     });
    //   }
    // } catch (scanErr) {
    //   console.error('VirusTotal scan error:', scanErr);
    //   return res.status(500).json({
    //     message: 'Не удалось проверить файл. Попробуйте другой документ.',
    //   });
    // }

    const text = await extractTextFromPdf(file.buffer);
    if (!text || text.trim().length < 50) {
      return res.status(400).json({
        message: 'Не удалось извлечь текст из PDF или документ слишком короткий',
      });
    }

    // Сохраняем PDF на диск, чтобы администратор мог скачать оригинал.
    const storedFileName = `${crypto.randomUUID()}.pdf`;
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'licenses');
    mkdirSync(uploadsDir, { recursive: true });
    await fsPromises.writeFile(path.join(uploadsDir, storedFileName), file.buffer);

    const parsed = parseFkkoTableFromText(text);
    const hasParsedEntries = parsed.sites.length > 0 &&
      parsed.sites.some((s) => s.entries.length > 0);

    if (!TIMEWEB_BASE) {
      if (hasParsedEntries) {
        console.log(`AI unavailable, using programmatic parse: ${parsed.sites.length} sites, ${parsed.sites.reduce((n, s) => n + s.entries.length, 0)} entries`);
      } else {
        return res.status(503).json({
          message: 'Сервис анализа не настроен. Укажите TIMEWEB_ACCESS_ID.',
        });
      }
    }

    const HEADER_PROMPT = `Извлеки из текста лицензии ТОЛЬКО реквизиты организации.

Ответь СТРОГО валидным JSON (без markdown, без комментариев):
{
  "companyName": "полное наименование организации",
  "inn": "ИНН (только цифры)",
  "region": "регион РФ (например: Челябинская область)"
}

Если поля нет — верни пустую строку.`;

    let companyName = '';
    let inn = '';
    let regionFromAi = '';

    if (TIMEWEB_BASE) {
      const headerText = extractHeaderText(text);
      const chatRes = await fetch(`${TIMEWEB_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TIMEWEB_BEARER_TOKEN}`,
          'x-proxy-source': process.env.TIMEWEB_PROXY_SOURCE || '',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Ты извлекаешь реквизиты из текста лицензии. Отвечай СТРОГО валидным JSON.',
            },
            {
              role: 'user',
              content: `${hasParsedEntries ? HEADER_PROMPT : EXTRACT_PROMPT}\n\nТекст документа:\n\n${hasParsedEntries ? headerText : text.slice(0, 15000)}`,
            },
          ],
          temperature: 0.1,
          max_tokens: hasParsedEntries ? 500 : 8000,
        }),
      });

      if (!chatRes.ok) {
        const errText = await chatRes.text();
        console.error('Timeweb API error:', chatRes.status, errText);
        if (!hasParsedEntries) {
          return res.status(502).json({
            message: `Ошибка ИИ (${chatRes.status}). Попробуйте загрузить файл повторно.`,
          });
        }
        console.log('AI failed but programmatic parse succeeded — using fallback');
      } else {
        const completion = await chatRes.json();
        const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
        rawContent = raw;
        try {
          const ai = JSON.parse(raw);
          companyName = String(ai.companyName ?? ai.company_name ?? '').replace(/\bне указано\b/gi, '').trim();
          inn = String(ai.inn ?? '').replace(/\bне указано\b/gi, '').trim();
          regionFromAi = String(ai.region ?? '').replace(/\bне указано\b/gi, '').trim();

          if (!hasParsedEntries) {
            const aiSites = normalizeAiSites(ai.sites, normalizeAddressAliases(ai.addressAliases));
            if (aiSites.length > 0) {
              parsed.sites = aiSites;
              parsed.addressAliases = normalizeAddressAliases(ai.addressAliases);
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse AI JSON:', parseErr.message, raw.slice(0, 500));
          if (!hasParsedEntries) {
            return res.status(502).json({
              message: 'Не удалось разобрать ответ ИИ. Попробуйте ещё раз.',
            });
          }
        }
      }
    }

    if (!companyName || !inn) {
      const nameMatch = text.match(/(?:полное\s+наименование|лицензиат)\s*[:\-—]?\s*([^\n]{5,120})/i);
      if (nameMatch && !companyName) companyName = nameMatch[1].trim();
      const innMatch = text.match(/ИНН\s*[:\-—]?\s*(\d{10,12})/);
      if (innMatch && !inn) inn = innMatch[1];
      if (!regionFromAi) {
        const regMatch = text.match(/(\S+\s+область|\S+\s+край|\S+\s+республика)/i);
        if (regMatch) regionFromAi = regMatch[1];
      }
    }

    const sites = parsed.sites;
    const mergedAliases = parsed.addressAliases || {};
    const primaryAddress = String(sites?.[0]?.address ?? '').trim();
    const fkkoCodes = [...new Set(sites.flatMap((x) => x.fkkoCodes || []))];
    const activityTypes = [...new Set(sites.flatMap((x) => x.activityTypes || []))];

    console.log(`License parsed: ${companyName}, ${sites.length} site(s), ${fkkoCodes.length} FKKO codes, ${activityTypes.length} activity types`);

    const result = {
      companyName,
      inn,
      region: regionFromAi,
      address: primaryAddress,
      fkkoCodes,
      activityTypes,
      sites: sites.map((s) => ({
        address: s.address,
        addressRef: s.addressRef,
        fkkoCodes: s.fkkoCodes,
        activityTypes: s.activityTypes,
        entries: s.entries ?? [],
      })),
      addressAliases: mergedAliases,
      fileOriginalName: file.originalname || 'license.pdf',
      fileStoredName: storedFileName,
    };

    return res.json(result);
  } catch (err) {
    console.error('analyze-license error:', err);
    if (rawContent) console.error('ИИ ответ (сырой):', rawContent.slice(0, 1500));
    return res
      .status(500)
      .json({ message: err.message || 'Ошибка при анализе лицензии' });
  }
});

app.get('/api/geocode', async (req, res) => {
  try {
    if (!YANDEX_GEOCODER_API_KEY) {
      return res.status(503).json({ message: 'YANDEX_GEOCODER_API_KEY не задан' });
    }
    const address = String(req.query.address ?? '').trim();
    if (!address) return res.status(400).json({ message: 'address обязателен' });
    const coords = await geocodeAddressBestEffort(address);
    if (!coords) return res.status(422).json({ message: 'Не удалось определить координаты по адресу' });
    return res.json(coords);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Ошибка геокодирования' });
  }
});

function parseActivityTypesInput(v) {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  const s = String(v).trim();
  if (!s) return [];
  return s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}

function normalizeEntriesInput(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const e of v) {
    const fkkoRaw = String(e?.fkkoCode ?? e?.fkko_code ?? '').trim();
    const fkkoCode = normalizeFkkoCode(fkkoRaw);
    if (!fkkoCode || !/^\d{11}$/.test(fkkoCode)) continue;
    const wasteName = String(e?.wasteName ?? e?.waste_name ?? '').trim() || null;
    const hazardClass = String(e?.hazardClass ?? e?.hazard_class ?? '').trim() || null;
    const activityTypes = parseActivityTypesInput(e?.activityTypes ?? e?.activity_types);
    if (activityTypes.length === 0) continue;
    out.push({ fkkoCode, wasteName, hazardClass, activityTypes });
  }
  return out;
}

function normalizeSitesInput(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const it of v) {
    const address = String(it?.address ?? '').trim();
    const region = it?.region == null ? null : String(it.region).trim() || null;
    const siteLabel = it?.siteLabel == null ? null : String(it.siteLabel).trim() || null;
    const lat = it?.lat == null || it.lat === '' ? null : Number(it.lat);
    const lng = it?.lng == null || it.lng === '' ? null : Number(it.lng);
    const entries = normalizeEntriesInput(it?.entries);
    const fkkoCodes = entries.length > 0
      ? [...new Set(entries.map((e) => e.fkkoCode))]
      : parseFkkoInput(it?.fkkoCodes);
    const activityTypes = entries.length > 0
      ? [...new Set(entries.flatMap((e) => e.activityTypes))]
      : parseActivityTypesInput(it?.activityTypes);
    if (!address && fkkoCodes.length === 0 && activityTypes.length === 0) continue;
    out.push({
      address: address || null,
      region,
      siteLabel,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      fkkoCodes,
      activityTypes,
      entries,
    });
  }
  return out;
}

app.post('/api/licenses', requireRole('USER'), async (req, res) => {
  try {
    const {
      companyName,
      inn,
      address,
      region,
      lat,
      lng,
      fkkoCodes,
      activityTypes,
      sites,
      fileOriginalName,
      fileStoredName,
    } = req.body ?? {};

    const companyNameStr = String(companyName ?? '').trim();
    if (!companyNameStr) {
      return res.status(400).json({ message: 'companyName обязателен' });
    }

    const sitesArr = normalizeSitesInput(sites);
    const fkkoArr = sitesArr.length > 0
      ? [...new Set(sitesArr.flatMap((s) => s.fkkoCodes))]
      : parseFkkoInput(fkkoCodes);
    if (fkkoArr.length === 0) {
      return res.status(400).json({ message: 'Хотя бы один код ФККО обязателен. Коды извлекаются из лицензии и прикрепляются к организации.' });
    }

    const activityArr = sitesArr.length > 0
      ? [...new Set(sitesArr.flatMap((s) => s.activityTypes))]
      : parseActivityTypesInput(activityTypes);

    const innStr = inn == null ? null : String(inn).trim() || null;
    const primaryFromSites = sitesArr[0]?.address ? String(sitesArr[0].address).trim() : '';
    const addressStr = primaryFromSites
      ? primaryFromSites
      : address == null ? null : String(address).trim() || null;
    const regionStrRaw = region == null ? '' : String(region).trim();
    const regionStr = regionStrRaw || guessRegionFromAddress(addressStr);
    let latNum = lat == null || lat === '' ? null : Number(lat);
    let lngNum = lng == null || lng === '' ? null : Number(lng);

    // Если координаты не переданы — определяем их по адресу через Яндекс и сохраняем в БД.
    if (!Number.isFinite(latNum)) latNum = null;
    if (!Number.isFinite(lngNum)) lngNum = null;
    if ((latNum == null || lngNum == null) && addressStr && addressStr.length >= 6) {
      if (!YANDEX_GEOCODER_API_KEY) {
        return res.status(503).json({ message: 'YANDEX_GEOCODER_API_KEY не задан' });
      }
      const coords = await geocodeAddressBestEffort(addressStr);
      if (!coords) {
        return res.status(422).json({ message: 'Не удалось определить координаты по адресу' });
      }
      latNum = coords.lat;
      lngNum = coords.lng;
    }

    const fileOriginalNameStr = fileOriginalName ? String(fileOriginalName).trim() : null;
    const fileStoredNameStr = fileStoredName ? String(fileStoredName).trim() : null;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const inserted = await client.query(
        `INSERT INTO licenses
          (company_name, inn, address, region, lat, lng, fkko_codes, activity_types, status, reward, owner_user_id, file_original_name, file_stored_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 100, $9, $10, $11)
         RETURNING id,
                   company_name AS "companyName",
                   inn,
                   address,
                   region,
                   lat,
                   lng,
                   fkko_codes AS "fkkoCodes",
                   activity_types AS "activityTypes",
                   status,
                   reward,
                   owner_user_id AS "ownerUserId",
                   file_original_name AS "fileOriginalName",
                   file_stored_name AS "fileStoredName",
                   created_at AS "createdAt"`,
        [
          companyNameStr,
          innStr,
          addressStr,
          regionStr || null,
          latNum,
          lngNum,
          fkkoArr,
          activityArr,
          Number(req.user?.id ?? null),
          fileOriginalNameStr,
          fileStoredNameStr,
        ],
      );

      const created = inserted.rows[0];
      const licenseId = Number(created?.id);

      // Пишем площадки. Если sites не пришли — создаём одну площадку из полей license.
      const sitesToInsert = sitesArr.length > 0 ? sitesArr : [{
        address: addressStr,
        region: regionStr || null,
        siteLabel: 'Основная площадка',
        lat: latNum,
        lng: lngNum,
        fkkoCodes: fkkoArr,
        activityTypes: activityArr,
      }];

      const insertedSites = [];
      for (let idx = 0; idx < sitesToInsert.length; idx++) {
        const s = sitesToInsert[idx];
        const row = await client.query(
          `INSERT INTO license_sites
             (license_id, site_label, address, region, lat, lng, fkko_codes, activity_types)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id,
                     site_label AS "siteLabel",
                     address,
                     region,
                     lat,
                     lng,
                     fkko_codes AS "fkkoCodes",
                     activity_types AS "activityTypes"`,
          [
            licenseId,
            s.siteLabel || (idx === 0 ? 'Основная площадка' : null),
            s.address,
            s.region || (regionStr || null),
            s.lat,
            s.lng,
            s.fkkoCodes,
            s.activityTypes,
          ],
        );
        const insertedSite = row.rows[0];
        if (!insertedSite) continue;
        const siteId = Number(insertedSite.id);

        const entries = Array.isArray(s.entries) && s.entries.length > 0
          ? s.entries
          : s.fkkoCodes.map((code) => ({
              fkkoCode: code,
              wasteName: null,
              hazardClass: null,
              activityTypes: [...s.activityTypes],
            }));

        const insertedEntries = [];
        for (const entry of entries) {
          for (const actType of entry.activityTypes) {
            await client.query(
              `INSERT INTO site_fkko_activities (site_id, fkko_code, waste_name, hazard_class, activity_type)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (site_id, fkko_code, activity_type) DO NOTHING`,
              [siteId, entry.fkkoCode, entry.wasteName || null, entry.hazardClass || null, actType],
            );
          }
          insertedEntries.push(entry);
        }

        insertedSite.entries = insertedEntries;
        insertedSites.push(insertedSite);
      }

      await client.query('COMMIT');

      // Заполняем координаты для ВСЕХ площадок, чтобы на карте были отдельные маркеры.
      // Координаты ставим только если Yandex ключ задан и в license_sites ещё нет lat/lng.
      if (YANDEX_GEOCODER_API_KEY) {
        for (const s of insertedSites) {
          const siteId = Number(s?.siteId ?? s?.id ?? null);
          // client.query RETURNING отдаёт id под ключом "id", а TypeScript/фронт ожидает siteId.
          const lat = s?.lat;
          const lng = s?.lng;
          const address = String(s?.address ?? '').trim();
          if (!siteId || address.length < 6) continue;
          if (typeof lat === 'number' && typeof lng === 'number') continue;

          const coords = await geocodeAddressBestEffort(address);
          if (!coords) continue;
          await client.query(`UPDATE license_sites SET lat = $2, lng = $3 WHERE id = $1`, [siteId, coords.lat, coords.lng]);
          s.lat = coords.lat;
          s.lng = coords.lng;
        }
      }
      return res.status(201).json({ ...created, sites: insertedSites });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('create license error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка сохранения лицензии' });
  }
});

app.post('/api/licenses/:id/geocode', async (req, res) => {
  try {
    if (!YANDEX_GEOCODER_API_KEY) {
      return res.status(503).json({ message: 'YANDEX_GEOCODER_API_KEY не задан' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const rows = await query(
      `SELECT id,
              company_name AS "companyName",
              inn,
              address,
              region,
              lat,
              lng,
              fkko_codes AS "fkkoCodes",
              activity_types AS "activityTypes",
              created_at AS "createdAt"
       FROM licenses
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!rows.rows.length) return res.status(404).json({ message: 'Объект не найден' });

    const it = rows.rows[0];
    if (typeof it.lat === 'number' && typeof it.lng === 'number') {
      return res.json(it);
    }

    const addressStr = String(it.address ?? '').trim();
    if (!addressStr) {
      return res.status(400).json({ message: 'У объекта нет адреса' });
    }

    const coords = await geocodeAddressBestEffort(addressStr);
    if (!coords) {
      return res.status(422).json({ message: 'Не удалось определить координаты по адресу' });
    }

    const updated = await query(
      `UPDATE licenses
       SET lat = $2, lng = $3
       WHERE id = $1
       RETURNING id,
                 company_name AS "companyName",
                 inn,
                 address,
                 region,
                 lat,
                 lng,
                 fkko_codes AS "fkkoCodes",
                 activity_types AS "activityTypes",
                 created_at AS "createdAt"`,
      [id, coords.lat, coords.lng]
    );
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('geocode license error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка геокодирования' });
  }
});

app.post('/api/licenses/:id/coords', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'lat/lng обязательны и должны быть числами' });
    }

    const updated = await query(
      `UPDATE licenses
       SET lat = $2, lng = $3
       WHERE id = $1
       RETURNING id,
                 company_name AS "companyName",
                 inn,
                 address,
                 region,
                 lat,
                 lng,
                 fkko_codes AS "fkkoCodes",
                 activity_types AS "activityTypes",
                 created_at AS "createdAt"`,
      [id, lat, lng]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: 'Объект не найден' });
    }

    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('update coords error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка сохранения координат' });
  }
});

// Маркеры на карте должны существовать по каждой площадке (address) отдельно,
// поэтому делаем отдельный endpoint по license_sites.
app.get('/api/license-sites', async (req, res) => {
  try {
    const region = String(req.query.region ?? '').trim();
    const fkko = normalizeFkkoCode(String(req.query.fkko ?? '').trim());
    const vidRaw = String(req.query.vid ?? req.query.activityType ?? '').trim();
    const vids = vidRaw ? vidRaw.split(/[,;]+/).map((x) => x.trim()).filter(Boolean) : [];

    if (!fkko || vids.length === 0) {
      return res.status(400).json({ message: 'Фильтры обязательны: код ФККО и вид обращения.' });
    }

    const params = [region, fkko, vids];
    const sql = `
      SELECT DISTINCT
        s.id AS "siteId",
        l.id,
        l.company_name AS "companyName",
        l.inn,
        s.address,
        COALESCE(s.region, l.region) AS region,
        s.lat,
        s.lng,
        s.fkko_codes AS "fkkoCodes",
        s.activity_types AS "activityTypes",
        s.site_label AS "siteLabel"
      FROM license_sites s
      JOIN licenses l ON l.id = s.license_id
      JOIN site_fkko_activities sfa ON sfa.site_id = s.id
      WHERE l.deleted_at IS NULL
        AND l.status = 'approved'
        AND ($1 = '' OR COALESCE(s.region, l.region) = $1)
        AND sfa.fkko_code = $2
        AND sfa.activity_type = ANY($3::text[])
      ORDER BY s."siteId" DESC
      LIMIT 200
    `;

    const rows = await query(sql, params);
    return res.json({ items: rows.rows });
  } catch (err) {
    console.error('list license sites error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения площадок' });
  }
});

app.get('/api/license-sites/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const rows = await query(
      `SELECT
         s.id AS "siteId",
         l.id,
         l.company_name AS "companyName",
         l.inn,
         s.address,
         COALESCE(s.region, l.region) AS region,
         s.lat,
         s.lng,
         s.fkko_codes AS "fkkoCodes",
         s.activity_types AS "activityTypes",
         s.site_label AS "siteLabel"
       FROM license_sites s
       JOIN licenses l ON l.id = s.license_id
       WHERE s.id = $1
       LIMIT 1`,
      [id],
    );

    if (!rows.rows.length) return res.status(404).json({ message: 'Площадка не найдена' });
    return res.json(rows.rows[0]);
  } catch (err) {
    console.error('get license site error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения площадки' });
  }
});

app.post('/api/license-sites/:id/geocode', async (req, res) => {
  try {
    if (!YANDEX_GEOCODER_API_KEY) {
      return res.status(503).json({ message: 'YANDEX_GEOCODER_API_KEY не задан' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const rows = await query(
      `SELECT id, address, lat, lng, license_id
       FROM license_sites
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    if (!rows.rows.length) return res.status(404).json({ message: 'Площадка не найдена' });

    const it = rows.rows[0];
    if (typeof it.lat === 'number' && typeof it.lng === 'number') {
      return res.json(await query(
        `SELECT
           s.id AS "siteId",
           l.id,
           l.company_name AS "companyName",
           l.inn,
           s.address,
           COALESCE(s.region, l.region) AS region,
           s.lat,
           s.lng,
           s.fkko_codes AS "fkkoCodes",
           s.activity_types AS "activityTypes",
           s.site_label AS "siteLabel"
         FROM license_sites s
         JOIN licenses l ON l.id = s.license_id
         WHERE s.id = $1
         LIMIT 1`,
        [id],
      ).then((r) => r.rows[0]));
    }

    const addressStr = String(it.address ?? '').trim();
    if (!addressStr) return res.status(400).json({ message: 'У площадки нет адреса' });

    const coords = await geocodeAddressBestEffort(addressStr);
    if (!coords) return res.status(422).json({ message: 'Не удалось определить координаты по адресу' });

    await query(`UPDATE license_sites SET lat = $2, lng = $3 WHERE id = $1`, [id, coords.lat, coords.lng]);

    const updated = await query(
      `SELECT
         s.id AS "siteId",
         l.id,
         l.company_name AS "companyName",
         l.inn,
         s.address,
         COALESCE(s.region, l.region) AS region,
         s.lat,
         s.lng,
         s.fkko_codes AS "fkkoCodes",
         s.activity_types AS "activityTypes",
         s.site_label AS "siteLabel"
       FROM license_sites s
       JOIN licenses l ON l.id = s.license_id
       WHERE s.id = $1
       LIMIT 1`,
      [id],
    );
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('geocode license site error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка геокодирования' });
  }
});

app.get('/api/licenses', async (req, res) => {
  try {
    const region = String(req.query.region ?? '').trim();
    const fkko = normalizeFkkoCode(String(req.query.fkko ?? '').trim());
    const vidRaw = String(req.query.vid ?? req.query.activityType ?? '').trim();
    const vids = vidRaw
      ? vidRaw
          .split(/[,;]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

    if (!fkko || vids.length === 0) {
      return res.status(400).json({
        message: 'Фильтры обязательны: код ФККО и вид обращения.',
      });
    }

    const params = [region, fkko, vids];
    const sql = `
      SELECT DISTINCT
             l.id,
             l.company_name AS "companyName",
             l.inn,
             l.address,
             l.region,
             l.lat,
             l.lng,
             l.fkko_codes AS "fkkoCodes",
             l.activity_types AS "activityTypes",
             l.created_at AS "createdAt"
      FROM licenses l
      JOIN license_sites s ON s.license_id = l.id
      JOIN site_fkko_activities sfa ON sfa.site_id = s.id
      WHERE l.deleted_at IS NULL
        AND l.status = 'approved'
        AND ($1 = '' OR COALESCE(s.region, l.region) = $1 OR l.region = $1)
        AND sfa.fkko_code = $2
        AND sfa.activity_type = ANY($3::text[])
      ORDER BY l.created_at DESC
      LIMIT 200
    `;

    const rows = await query(sql, params);
    return res.json({ items: rows.rows });
  } catch (err) {
    console.error('list licenses error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения списка' });
  }
});

app.get('/api/licenses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const rows = await query(
      `SELECT id,
              company_name AS "companyName",
              inn,
              address,
              region,
              lat,
              lng,
              fkko_codes AS "fkkoCodes",
              activity_types AS "activityTypes",
              created_at AS "createdAt"
       FROM licenses
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (!rows.rows.length) {
      return res.status(404).json({ message: 'Объект не найден' });
    }
    const base = rows.rows[0];
    const sites = await query(
      `SELECT id,
              site_label AS "siteLabel",
              address,
              region,
              lat,
              lng,
              fkko_codes AS "fkkoCodes",
              activity_types AS "activityTypes",
              created_at AS "createdAt"
       FROM license_sites
       WHERE license_id = $1
       ORDER BY id ASC`,
      [id]
    );
    const siteIds = sites.rows.map((s) => s.id);
    let entriesMap = {};
    if (siteIds.length > 0) {
      const entriesRows = await query(
        `SELECT site_id AS "siteId",
                fkko_code AS "fkkoCode",
                waste_name AS "wasteName",
                hazard_class AS "hazardClass",
                activity_type AS "activityType"
         FROM site_fkko_activities
         WHERE site_id = ANY($1::bigint[])
         ORDER BY fkko_code, activity_type`,
        [siteIds]
      );
      for (const row of entriesRows.rows) {
        const key = `${row.siteId}_${row.fkkoCode}`;
        if (!entriesMap[key]) {
          entriesMap[key] = {
            siteId: row.siteId,
            fkkoCode: row.fkkoCode,
            wasteName: row.wasteName,
            hazardClass: row.hazardClass,
            activityTypes: [],
          };
        }
        entriesMap[key].activityTypes.push(row.activityType);
      }
    }
    const sitesWithEntries = sites.rows.map((s) => {
      const entries = Object.values(entriesMap).filter((e) => e.siteId === s.id).map(({ siteId: _s, ...rest }) => rest);
      return { ...s, entries };
    });
    return res.json({ ...base, sites: sitesWithEntries });
  } catch (err) {
    console.error('get license error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения объекта' });
  }
});

// Расширенная карточка лицензии для USER (только свои) и SUPERADMIN (всё).
app.get('/api/licenses/:id/extended', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const userId = Number(req.user?.id);
    const userRole = req.user?.role ?? 'GUEST';

    const rows = await query(
      `SELECT id,
              company_name AS "companyName",
              inn,
              address,
              region,
              lat,
              lng,
              fkko_codes AS "fkkoCodes",
              activity_types AS "activityTypes",
              status,
              reward,
              owner_user_id AS "ownerUserId",
              rejection_note AS "rejectionNote",
              moderated_by AS "moderatedBy",
              moderated_at AS "moderatedAt",
              moderated_comment AS "moderatedComment",
              file_original_name AS "fileOriginalName",
              file_stored_name AS "fileStoredName",
              created_at AS "createdAt"
       FROM licenses
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    if (!rows.rows.length) {
      return res.status(404).json({ message: 'Объект не найден' });
    }

    const license = rows.rows[0];
    const isAdmin = userRole === 'SUPERADMIN';
    const isOwner = Number(license.ownerUserId) === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const sites = await query(
      `SELECT id,
              site_label AS "siteLabel",
              address,
              region,
              lat,
              lng,
              fkko_codes AS "fkkoCodes",
              activity_types AS "activityTypes",
              created_at AS "createdAt"
       FROM license_sites
       WHERE license_id = $1
       ORDER BY id ASC`,
      [id]
    );
    const siteIds = sites.rows.map((s) => s.id);
    let entriesMap = {};
    if (siteIds.length > 0) {
      const entriesRows = await query(
        `SELECT site_id AS "siteId",
                fkko_code AS "fkkoCode",
                waste_name AS "wasteName",
                hazard_class AS "hazardClass",
                activity_type AS "activityType"
         FROM site_fkko_activities
         WHERE site_id = ANY($1::bigint[])
         ORDER BY fkko_code, activity_type`,
        [siteIds]
      );
      for (const row of entriesRows.rows) {
        const key = `${row.siteId}_${row.fkkoCode}`;
        if (!entriesMap[key]) {
          entriesMap[key] = {
            siteId: row.siteId,
            fkkoCode: row.fkkoCode,
            wasteName: row.wasteName,
            hazardClass: row.hazardClass,
            activityTypes: [],
          };
        }
        entriesMap[key].activityTypes.push(row.activityType);
      }
    }
    const sitesWithEntries = sites.rows.map((s) => {
      const entries = Object.values(entriesMap).filter((e) => e.siteId === s.id).map(({ siteId: _s, ...rest }) => rest);
      return { ...s, entries };
    });
    return res.json({ ...license, sites: sitesWithEntries });
  } catch (err) {
    console.error('extended license error:', err);
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка карточки' });
  }
});

// Скачивание оригинального PDF (только SUPERADMIN или владелец).
app.get('/api/licenses/:id/file', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const userId = Number(req.user?.id);
    const userRole = req.user?.role ?? 'GUEST';

    const rows = await query(
      `SELECT id,
              owner_user_id AS "ownerUserId",
              file_original_name AS "fileOriginalName",
              file_stored_name AS "fileStoredName"
       FROM licenses
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    if (!rows.rows.length) {
      return res.status(404).json({ message: 'Объект не найден' });
    }

    const license = rows.rows[0];
    const isAdmin = userRole === 'SUPERADMIN';
    const isOwner = Number(license.ownerUserId) === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const stored = license.fileStoredName;
    if (!stored) {
      return res.status(404).json({ message: 'Файл не сохранён' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'licenses', String(stored));
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'Файл недоступен' });
    }

    const original = license.fileOriginalName || 'license.pdf';
    res.download(filePath, original);
  } catch (err) {
    console.error('license file error:', err);
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка скачивания' });
  }
});

app.get('/api/filters/regions', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT region
       FROM licenses
       WHERE region IS NOT NULL AND region <> '' AND deleted_at IS NULL
       ORDER BY region ASC`,
      []
    );
    return res.json({ regions: rows.rows.map((r) => r.region) });
  } catch (err) {
    console.error('regions error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения регионов' });
  }
});

app.get('/api/filters/fkko', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT sfa.fkko_code AS code
       FROM site_fkko_activities sfa
       JOIN license_sites s ON s.id = sfa.site_id
       JOIN licenses l ON l.id = s.license_id
       WHERE l.deleted_at IS NULL AND l.status = 'approved'
       ORDER BY code ASC`,
      []
    );
    const codes = rows.rows.map((r) => r.code).filter(Boolean);
    return res.json({ fkko: codes });
  } catch (err) {
    console.error('fkko filters error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения кодов ФККО' });
  }
});

app.get('/api/filters/activity-types', async (req, res) => {
  try {
    const fkko = normalizeFkkoCode(String(req.query.fkko ?? '').trim());
    let sql, params;
    if (fkko && /^\d{11}$/.test(fkko)) {
      sql = `SELECT DISTINCT sfa.activity_type AS activity
             FROM site_fkko_activities sfa
             JOIN license_sites s ON s.id = sfa.site_id
             JOIN licenses l ON l.id = s.license_id
             WHERE l.deleted_at IS NULL AND l.status = 'approved'
               AND sfa.fkko_code = $1
             ORDER BY activity ASC`;
      params = [fkko];
    } else {
      sql = `SELECT DISTINCT sfa.activity_type AS activity
             FROM site_fkko_activities sfa
             JOIN license_sites s ON s.id = sfa.site_id
             JOIN licenses l ON l.id = s.license_id
             WHERE l.deleted_at IS NULL AND l.status = 'approved'
             ORDER BY activity ASC`;
      params = [];
    }
    const rows = await query(sql, params);
    const types = rows.rows.map((r) => r.activity).filter(Boolean);
    return res.json({ activityTypes: types });
  } catch (err) {
    console.error('activity-types error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения видов обращения' });
  }
});

app.use('/api/admin', adminRouter);

// На деплое: раздаём собранный фронт (одна ссылка для заказчика)
const distRoot = path.join(process.cwd(), 'dist');
const distFromServer = path.join(__dirname, '..', 'dist');
const distPath = existsSync(distRoot) ? distRoot : existsSync(distFromServer) ? distFromServer : null;
if (distPath) {
  app.use(express.static(distPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

function startServer(tryPort) {
  const server = app.listen(tryPort, () => {
    console.log(`API: http://localhost:${tryPort}`);
    if (tryPort !== port) {
      console.log(`(порт ${port} был занят, использован ${tryPort})`);
      console.log(`В .env укажите: VITE_API_URL=http://localhost:${tryPort}`);
    }
    if (!TIMEWEB_ACCESS_ID) {
      console.warn('TIMEWEB_ACCESS_ID не задан — анализ лицензий через Timeweb недоступен.');
    }
    if (!process.env.JWT_ACCESS_SECRET) {
      console.warn('JWT_ACCESS_SECRET не задан — регистрация/логин может падать.');
    }
    if (!VIRUSTOTAL_API_KEY) {
      console.warn('VIRUSTOTAL_API_KEY не задан — проверка файлов на вирусы отключена.');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && tryPort < 3010) {
      console.warn(`Порт ${tryPort} занят, пробуем ${tryPort + 1}...`);
      startServer(tryPort + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

ensureDatabaseSchema()
  .then(() => startServer(port))
  .catch(() => process.exit(1));
