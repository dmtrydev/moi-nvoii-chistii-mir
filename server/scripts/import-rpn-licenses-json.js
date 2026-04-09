/**
 * Импорт записей реестра лицензий Росприроднадзора из JSON (выгрузка парсера).
 *
 * Запуск из папки server (нужен DATABASE_URL в .env):
 *   node scripts/import-rpn-licenses-json.js path/to/licenses.json
 *   node scripts/import-rpn-licenses-json.js path/to/licenses.json --dry-run
 *   node scripts/import-rpn-licenses-json.js path/to/licenses.json --geocode
 *
 *   Файлы >256 МБ: потоковое чтение (без readFileSync целиком — лимит строки в Node).
 *   Путь в JSON по умолчанию: content.* (корень { "content": [ ... ] }) или *.content.* (корень [ { "content": [ ] }, ... ]).
 *   Явно: --json-path=content.*  или  --json-path=*.content.*
 *
 *   (Флаг --include-inactive устарел: неактивные по реестру импортируются по умолчанию и помечаются в БД.)
 *
 * Большие файлы: увеличьте лимит памяти Node, например:
 *   set NODE_OPTIONS=--max-old-space-size=8192
 * или разбейте JSON на части.
 */
import 'dotenv/config';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { getPool } from '../db.js';

const require = createRequire(import.meta.url);
const JSONStream = require('JSONStream');
import { normalizeInn, LICENSE_INN_NORMALIZED_EXPR } from '../innUtils.js';
import { normalizeFkkoCode } from '../fkkoServer.js';
import { aggregateFkkoAndActivityFromSites } from '../licensePayloadNormalize.js';

const IMPORT_SOURCE = 'rpn_registry';

/** Соответствие флагов XSD и подписей в UI (EnterpriseActivityStrip). */
const RPN_FLAG_TO_ACTIVITY = [
  ['piking', 'Сбор'],
  ['transportation', 'Транспортирование'],
  ['processing', 'Обработка'],
  ['utilization', 'Утилизация'],
  ['neutralization', 'Обезвреживание'],
  ['accommodation', 'Размещение'],
];

function guessRegionFromAddress(address) {
  const a = String(address || '').trim();
  if (!a) return '';
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean);
  const withKeywords = parts.find((p) => /(область|край|республика|округ|АО|А\.О\.)/i.test(p));
  if (withKeywords) return withKeywords;
  const first = parts[0] ?? '';
  return first.length <= 80 ? first : '';
}

function activityTypesFromRpnRow(row) {
  if (!row || typeof row !== 'object') return [];
  const out = [];
  for (const [key, label] of RPN_FLAG_TO_ACTIVITY) {
    if (row[key] === true) out.push(label);
  }
  return [...new Set(out)];
}

function fkkoFromWasteTypes(wt) {
  if (!wt || typeof wt !== 'object') return null;
  const raw = wt.wasteKode ?? wt.waste_kode ?? wt.code;
  const code = normalizeFkkoCode(raw);
  return /^\d{11}$/.test(code) ? code : null;
}

/** Выше этого размера — только поток (иначе ERR_STRING_TOO_LONG в V8). */
const STREAM_IMPORT_MIN_BYTES = 256 * 1024 * 1024;

function parseArgs(argv) {
  const positional = [];
  let dryRun = false;
  let geocode = false;
  let includeInactive = false;
  let jsonStreamPath = '';
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--geocode') geocode = true;
    else if (a === '--include-inactive') includeInactive = true;
    else if (a.startsWith('--json-path=')) jsonStreamPath = a.slice('--json-path='.length).trim();
    else if (!a.startsWith('-')) positional.push(a);
  }
  return { jsonPath: positional[0] ?? '', dryRun, geocode, includeInactive, jsonStreamPath };
}

/** Путь для JSONStream: content.* vs *.content.* */
function detectJsonStreamPath(abs) {
  const fh = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fh, buf, 0, 16384, 0);
    const head = buf.subarray(0, n).toString('utf8').trimStart();
    if (head.startsWith('[')) return '*.content.*';
    return 'content.*';
  } finally {
    fs.closeSync(fh);
  }
}

/** Позиция из сообщения V8/Node: "... at position 123" */
function extractJsonErrorPosition(message) {
  const m = String(message ?? '').match(/position\s+(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function printJsonParseDiagnostics(raw, err) {
  const msg = err instanceof Error ? err.message : String(err);
  const pos = extractJsonErrorPosition(msg);
  const len = raw.length;
  console.error('Подсказка: чаще всего это обрезанный при передаче файл, склейка двух JSON или битая выгрузка. Проверьте размер на ПК и на VPS (должны совпадать), при необходимости перекачайте через scp/rsync.');
  if (pos != null) {
    console.error(`Позиция ошибки (символ): ${pos}, длина файла (символов): ${len}`);
    if (pos >= len) {
      console.error('Похоже, файл обрезан: позиция ошибки не меньше длины файла.');
      const tail = raw.slice(Math.max(0, len - 400));
      console.error('…хвост файла (последние ~400 символов):\n', tail);
      return;
    }
    const from = Math.max(0, pos - 120);
    const to = Math.min(len, pos + 120);
    const snippet = raw.slice(from, to);
    const rel = pos - from;
    console.error('Фрагмент вокруг ошибки (между линиями):');
    console.error('---');
    console.error(snippet);
    console.error('---');
    console.error(`${' '.repeat(Math.min(rel, snippet.length))}^ (ориентировочно)`);
  }
}

function parseYandexPos(pos) {
  const s = String(pos ?? '').trim();
  if (!s) return null;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lon = Number.parseFloat(parts[0]);
  const lat = Number.parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lng: lon };
}

async function geocodeAddressYandex(address, apiKey) {
  if (!apiKey) return null;
  const a = String(address ?? '').trim();
  if (!a || a.length < 6) return null;
  const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(
    apiKey,
  )}&format=json&results=1&lang=ru_RU&geocode=${encodeURIComponent(a)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) return null;
  const json = await r.json();
  const pos =
    json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos ?? '';
  return parseYandexPos(pos);
}

/**
 * @param {unknown} entry
 * @returns {null | {
 *   companyName: string,
 *   inn: string | null,
 *   registryInactive: boolean,
 *   externalRef: string,
 *   sites: Array<{
 *     address: string | null,
 *     region: string | null,
 *     siteLabel: string | null,
 *     lat: number | null,
 *     lng: number | null,
 *     fkkoCodes: string[],
 *     activityTypes: string[],
 *     entries: Array<{ fkkoCode: string, wasteName: string | null, hazardClass: string | null, activityTypes: string[] }>,
 *   }>,
 * }}
 */
function mapRegistryEntryToSites(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const statusRaw = String(entry.status ?? '').toLowerCase();
  const registryInactive = Boolean(statusRaw && statusRaw !== 'active');

  const org = entry.subject?.data?.organization;
  if (!org || typeof org !== 'object') return null;

  const companyName = String(org.shortName ?? org.fullName ?? '').trim();
  if (!companyName) return null;

  const innRaw = org.inn == null ? null : String(org.inn).trim();
  const innNorm = normalizeInn(innRaw);
  if (!innNorm) return null;

  const externalRef = String(entry.number ?? '').trim();
  if (!externalRef) return null;

  const regPart = org.registrationAddress?.unrecognizablePart;
  const regAddr = regPart == null ? '' : String(regPart).trim();

  const objects = entry.licensingActivityRegistryWasteRPN?.objects;
  if (!Array.isArray(objects) || objects.length === 0) return null;

  const sites = [];
  for (let idx = 0; idx < objects.length; idx++) {
    const obj = objects[idx];
    const fullAddress = obj?.address?.fullAddress == null ? '' : String(obj.address.fullAddress).trim();
    const regionName = obj?.region?.name == null ? null : String(obj.region.name).trim() || null;
    const wasteRows = obj?.xsdData?.WasteActivityTypes;
    if (!Array.isArray(wasteRows)) continue;

    const entries = [];
    for (const row of wasteRows) {
      const wt = row?.wasteTypes;
      const fkkoCode = fkkoFromWasteTypes(wt);
      if (!fkkoCode) continue;
      const activityTypes = activityTypesFromRpnRow(row);
      if (activityTypes.length === 0) continue;
      const hazardClass = wt?.klassOpasnosti == null ? null : String(wt.klassOpasnosti).trim() || null;
      const wasteName =
        wt?.name == null ? null : String(wt.name).trim() || null;
      entries.push({ fkkoCode, wasteName, hazardClass, activityTypes });
    }

    if (entries.length === 0) continue;

    const fkkoCodes = [...new Set(entries.map((e) => e.fkkoCode))];
    const activityTypes = [...new Set(entries.flatMap((e) => e.activityTypes))];
    const address = fullAddress || null;
    const region = regionName || (address ? guessRegionFromAddress(address) : '') || null;

    sites.push({
      address,
      region,
      siteLabel: idx === 0 ? 'Основная площадка' : `Площадка ${idx + 1}`,
      lat: null,
      lng: null,
      fkkoCodes,
      activityTypes,
      entries,
    });
  }

  if (sites.length === 0) return null;

  const primaryAddr = sites[0]?.address || regAddr || null;
  if (!primaryAddr) return null;

  return {
    companyName,
    inn: innRaw,
    innNorm,
    registryInactive,
    externalRef,
    sites,
    primaryAddr,
    primaryRegion: sites[0]?.region || guessRegionFromAddress(primaryAddr) || null,
  };
}

function flattenRootDocuments(root) {
  const docs = Array.isArray(root) ? root : [root];
  const entries = [];
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const content = doc.content;
    if (Array.isArray(content)) {
      for (const e of content) entries.push(e);
    }
  }
  return entries;
}

async function insertLicenseBundle(client, payload, opts) {
  const { fkkoArr, activityArr } = aggregateFkkoAndActivityFromSites(payload.sites);
  if (fkkoArr.length === 0) return { ok: false, reason: 'no_fkko' };

  const moderatedComment = `Импорт ${IMPORT_SOURCE} (${new Date().toISOString().slice(0, 10)})`;

  let latNum = null;
  let lngNum = null;
  const sitesForInsert = payload.sites.map((s) => ({ ...s }));

  if (opts.geocode && opts.yandexKey) {
    const addr = String(payload.primaryAddr ?? '').trim();
    if (addr.length >= 6) {
      const c = await geocodeAddressYandex(addr, opts.yandexKey);
      if (c) {
        latNum = c.lat;
        lngNum = c.lng;
      }
    }
    for (const s of sitesForInsert) {
      const a = String(s.address ?? '').trim();
      if (a.length < 6) continue;
      if (s.lat != null && s.lng != null) continue;
      const c = await geocodeAddressYandex(a, opts.yandexKey);
      if (c) {
        s.lat = c.lat;
        s.lng = c.lng;
      }
    }
  }

  const inserted = await client.query(
    `INSERT INTO licenses
      (company_name, inn, address, region, lat, lng, fkko_codes, activity_types,
       status, reward, owner_user_id, moderated_at, moderated_comment,
       file_original_name, file_stored_name,
       import_source, import_external_ref, import_needs_review, import_registry_inactive)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       'approved', 100, NULL, NOW(), $9,
       NULL, NULL,
       $10, $11, TRUE, $12)
     RETURNING id`,
    [
      payload.companyName,
      payload.inn,
      payload.primaryAddr,
      payload.primaryRegion,
      latNum,
      lngNum,
      fkkoArr,
      activityArr,
      moderatedComment,
      IMPORT_SOURCE,
      payload.externalRef,
      Boolean(payload.registryInactive),
    ],
  );

  const licenseId = Number(inserted.rows[0]?.id);
  if (!Number.isFinite(licenseId) || licenseId <= 0) {
    throw new Error('INSERT licenses не вернул id');
  }

  for (let idx = 0; idx < sitesForInsert.length; idx++) {
    const s = sitesForInsert[idx];
    const row = await client.query(
      `INSERT INTO license_sites
         (license_id, site_label, address, region, lat, lng, fkko_codes, activity_types)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        licenseId,
        s.siteLabel || (idx === 0 ? 'Основная площадка' : null),
        s.address,
        s.region,
        s.lat,
        s.lng,
        s.fkkoCodes,
        s.activityTypes,
      ],
    );
    const siteId = Number(row.rows[0]?.id);
    if (!Number.isFinite(siteId)) continue;

    for (const entry of s.entries) {
      for (const actType of entry.activityTypes) {
        await client.query(
          `INSERT INTO site_fkko_activities (site_id, fkko_code, waste_name, hazard_class, activity_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (site_id, fkko_code, activity_type) DO NOTHING`,
          [siteId, entry.fkkoCode, entry.wasteName, entry.hazardClass, actType],
        );
      }
    }
  }

  return { ok: true, licenseId };
}

/**
 * @param {unknown} entry
 * @param {{
 *   stats: { parsed: number, skippedNoData: number, skippedDupInn: number, skippedDupRef: number, inserted: number, errors: number },
 *   pool: import('pg').Pool | null,
 *   dryRun: boolean,
 *   geocode: boolean,
 *   yandexKey: string,
 *   innExpr: string,
 * }} ctx
 */
async function importSingleEntry(entry, ctx) {
  const { stats, pool, dryRun, geocode, yandexKey, innExpr } = ctx;
  const payload = mapRegistryEntryToSites(entry);
  if (!payload) {
    stats.skippedNoData += 1;
    return;
  }
  stats.parsed += 1;

  if (dryRun) {
    stats.inserted += 1;
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dupRef = await client.query(
      `SELECT id FROM licenses WHERE deleted_at IS NULL AND import_external_ref = $1 LIMIT 1`,
      [payload.externalRef],
    );
    if (dupRef.rows.length > 0) {
      await client.query('ROLLBACK');
      stats.skippedDupRef += 1;
      return;
    }

    const dupInn = await client.query(
      `SELECT id FROM licenses
       WHERE deleted_at IS NULL
         AND ${innExpr} = $1
         AND length(${innExpr}) IN (10, 12)
       LIMIT 1`,
      [payload.innNorm],
    );
    if (dupInn.rows.length > 0) {
      await client.query('ROLLBACK');
      stats.skippedDupInn += 1;
      return;
    }

    const result = await insertLicenseBundle(client, payload, { geocode, yandexKey });
    if (!result.ok) {
      await client.query('ROLLBACK');
      stats.skippedNoData += 1;
      return;
    }

    await client.query('COMMIT');
    stats.inserted += 1;
    if (stats.inserted % 50 === 0) {
      console.log('Импортировано:', stats.inserted);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    stats.errors += 1;
    console.error('Ошибка записи:', payload.externalRef, err instanceof Error ? err.message : err);
  } finally {
    client.release();
  }
}

/**
 * Большие файлы: JSONStream по пути content.* или *.content.* (без загрузки всего файла в строку).
 */
async function runStreamingImport(abs, jsonStreamPath, ctx) {
  const pattern = jsonStreamPath || detectJsonStreamPath(abs);
  console.log('Потоковое чтение JSON, JSONStream path:', pattern);

  const readStream = fs.createReadStream(abs, { encoding: 'utf8' });
  const parser = JSONStream.parse(pattern);

  let tail = Promise.resolve();
  let streamItems = 0;

  await new Promise((resolve, reject) => {
    const fail = (err) => {
      readStream.destroy();
      reject(err);
    };

    readStream.on('error', fail);
    parser.on('error', fail);

    parser.on('data', (entry) => {
      streamItems += 1;
      tail = tail.then(() => importSingleEntry(entry, ctx)).catch(fail);
    });

    parser.on('end', () => {
      tail.then(() => resolve()).catch(fail);
    });

    readStream.pipe(parser);
  });

  console.log('Событий из потока (элементов по пути):', streamItems);
  if (streamItems === 0) {
    console.warn(
      'Поток не вернул ни одной записи. Проверьте структуру JSON: ожидается { "content": [ ... ] } или [ { "content": [ ... ] }, ... ]. Укажите путь вручную: --json-path=content.* или --json-path=*.content.*',
    );
  }
}

async function main() {
  const { jsonPath, dryRun, geocode, includeInactive, jsonStreamPath } = parseArgs(process.argv.slice(2));
  if (!jsonPath) {
    console.error(
      'Укажите путь к JSON: node scripts/import-rpn-licenses-json.js <file.json> [--dry-run] [--geocode] [--json-path=content.*]',
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(abs)) {
    console.error('Файл не найден:', abs);
    process.exit(1);
  }

  const st = fs.statSync(abs);
  const useStream =
    st.size >= STREAM_IMPORT_MIN_BYTES || String(process.env.STREAM_IMPORT ?? '').trim() === '1';

  if (includeInactive) {
    console.warn(
      'Параметр --include-inactive устарел: неактивные записи реестра импортируются по умолчанию (import_registry_inactive).',
    );
  }

  const yandexKey = String(process.env.YANDEX_GEOCODER_API_KEY ?? '').trim();
  if (geocode && !yandexKey) {
    console.warn('Предупреждение: --geocode без YANDEX_GEOCODER_API_KEY — координаты не заполняются.');
  }

  const stats = {
    parsed: 0,
    skippedNoData: 0,
    skippedDupInn: 0,
    skippedDupRef: 0,
    inserted: 0,
    errors: 0,
  };

  const pool = dryRun ? null : getPool();
  const innExpr = LICENSE_INN_NORMALIZED_EXPR;
  const ctx = { stats, pool, dryRun, geocode, yandexKey, innExpr };

  if (useStream) {
    console.log('Файл', (st.size / (1024 * 1024)).toFixed(1), 'МБ — режим потока.');
    await runStreamingImport(abs, jsonStreamPath, ctx);
  } else {
    console.log('Чтение JSON…', abs);
    const raw = fs.readFileSync(abs, 'utf8');
    let root;
    try {
      root = JSON.parse(raw);
    } catch (e) {
      console.error('Ошибка JSON.parse:', e instanceof Error ? e.message : e);
      printJsonParseDiagnostics(raw, e);
      process.exit(1);
    }

    const flat = flattenRootDocuments(root);
    console.log('Записей content (всего):', flat.length);

    for (const entry of flat) {
      await importSingleEntry(entry, ctx);
    }
  }

  if (!dryRun && pool) {
    await pool.end();
  }

  console.log(
    dryRun ? 'DRY-RUN (записей в БД нет).' : 'Готово.',
    JSON.stringify(stats, null, 0),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
