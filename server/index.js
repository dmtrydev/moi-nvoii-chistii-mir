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
import { query } from './db.js';
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
    "frame-ancestors 'none'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

app.use(express.json());
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

function formatFkkoTokensToCodes(tokens) {
  const t = Array.isArray(tokens) ? tokens.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  if (t.length < 6) return [];
  const out = [];
  for (let i = 0; i + 5 < t.length; i += 6) {
    const code = normalizeFkkoCode(t.slice(i, i + 6).join(' '));
    if (code) out.push(code);
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
    return chunks.map(normalizeFkkoCode).filter(Boolean);
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

const EXTRACT_PROMPT = `Извлеки из текста лицензии (или документа об обращении с отходами) следующие данные.

Ответь строго в таком формате — по одной строке на поле, без лишнего текста и без JSON:

НАЗВАНИЕ_ОРГАНИЗАЦИИ: полное наименование организации
ИНН: числовой код ИНН
РЕГИОН: регион РФ (например: Московская область, Республика Башкортостан, Краснодарский край). Если можно — выбери именно регион, не город.
АДРЕС: полный адрес объекта
КОДЫ_ФККО: перечисли коды ФККО. Внутри одного кода ставь пробелы как в исходнике (пример: 7 31 100 01 40 4). Разделяй между собой ТОЛЬКО разные коды (лучше запятой). НЕ ставь запятые между частями одного кода.
ВИД_ОБРАЩЕНИЯ: виды деятельности по обращению с отходами из лицензии. Укажи через запятую один или несколько: Сбор, Транспортирование, Обезвреживание, Утилизация, Размещение, Обработка, Захоронение, Иное. Только те, что указаны в документе.

Если какого-то поля нет в документе — оставь после двоеточия пустое место или напиши «не указано».`;

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

    if (!TIMEWEB_BASE) {
      return res.status(503).json({
        message: 'Сервис анализа не настроен. Укажите TIMEWEB_ACCESS_ID.',
      });
    }

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
            content:
              'Ты извлекаешь данные из текста лицензии. Отвечай только в формате строк с метками НАЗВАНИЕ_ОРГАНИЗАЦИИ:, ИНН:, РЕГИОН:, АДРЕС:, КОДЫ_ФККО:, ВИД_ОБРАЩЕНИЯ: — без JSON и без лишнего текста.',
          },
          {
            role: 'user',
            content: `${EXTRACT_PROMPT}\n\nТекст документа:\n\n${text.slice(0, 12000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error('Timeweb API error:', chatRes.status, errText);
      return res.status(502).json({
        message: `Ошибка ИИ (${chatRes.status}). Проверьте TIMEWEB_ACCESS_ID и доступ к Timeweb Cloud AI.`,
      });
    }

    const completion = await chatRes.json();
    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    rawContent = raw;

    function extractLine(prefix) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${escaped}\\s*[:：]?\\s*(.*)`, 'im');
      const m = raw.match(re);
      return m ? String(m[1] ?? '').trim() : '';
    }

    const companyName = extractLine('НАЗВАНИЕ_ОРГАНИЗАЦИИ').replace(/\bне указано\b/gi, '').trim();
    const inn = extractLine('ИНН').replace(/\bне указано\b/gi, '').trim();
    const regionFromAi = extractLine('РЕГИОН').replace(/\bне указано\b/gi, '').trim();
    const address = extractLine('АДРЕС').replace(/\bне указано\b/gi, '').trim();
    const fkkoRaw = extractLine('КОДЫ_ФККО').replace(/\bне указано\b/gi, '').trim();
    const fkkoCodes = fkkoRaw ? extractFkkoCodesFromText(fkkoRaw) : [];
    const activityRaw = extractLine('ВИД_ОБРАЩЕНИЯ').replace(/\bне указано\b/gi, '').trim();
    const activityTypes = activityRaw
      ? activityRaw.split(/[,;]+/).map((x) => x.trim()).filter(Boolean)
      : [];

    const result = {
      companyName,
      inn,
      region: regionFromAi,
      address,
      fkkoCodes,
      activityTypes,
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
      fileOriginalName,
      fileStoredName,
    } = req.body ?? {};

    const companyNameStr = String(companyName ?? '').trim();
    if (!companyNameStr) {
      return res.status(400).json({ message: 'companyName обязателен' });
    }

    const fkkoArr = parseFkkoInput(fkkoCodes);
    if (fkkoArr.length === 0) {
      return res.status(400).json({ message: 'Хотя бы один код ФККО обязателен. Коды извлекаются из лицензии и прикрепляются к организации.' });
    }

    const activityArr = parseActivityTypesInput(activityTypes);

    const innStr = inn == null ? null : String(inn).trim() || null;
    const addressStr = address == null ? null : String(address).trim() || null;
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

    const inserted = await query(
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

    return res.status(201).json(inserted.rows[0]);
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

app.get('/api/licenses', async (req, res) => {
  try {
    const region = String(req.query.region ?? '').trim();
    const fkko = normalizeFkkoCode(String(req.query.fkko ?? '').trim());
    const vid = String(req.query.vid ?? req.query.activityType ?? '').trim();

    if (!region || !fkko || !vid) {
      return res.status(400).json({
        message: 'Все фильтры обязательны: регион, код ФККО и вид обращения. Заполните все поля.',
      });
    }

    const params = [region, fkko, fkko, vid];
    const sql = `
      SELECT id,
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
      WHERE deleted_at IS NULL
        AND region = $1
        AND ($2 = ANY(fkko_codes) OR array_to_string(fkko_codes, '') = $3)
        AND (array_length(activity_types, 1) IS NULL OR $4 = ANY(activity_types))
      ORDER BY created_at DESC
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
    return res.json(rows.rows[0]);
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

    return res.json(license);
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
      `SELECT DISTINCT unnest(fkko_codes) AS code
       FROM licenses
       WHERE array_length(fkko_codes, 1) > 0 AND deleted_at IS NULL
       ORDER BY code ASC`,
      []
    );
    const codes = rows.rows.map((r) => r.code).filter(Boolean);
    return res.json({ fkko: [...new Set(codes)] });
  } catch (err) {
    console.error('fkko filters error:', err);
    return res.status(500).json({ message: err.message || 'Ошибка получения кодов ФККО' });
  }
});

app.get('/api/filters/activity-types', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT unnest(activity_types) AS activity
       FROM licenses
       WHERE array_length(activity_types, 1) > 0 AND deleted_at IS NULL
       ORDER BY activity ASC`,
      []
    );
    const types = rows.rows.map((r) => r.activity).filter(Boolean);
    const unique = [...new Set(types)];
    return res.json({ activityTypes: unique });
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

startServer(port);
