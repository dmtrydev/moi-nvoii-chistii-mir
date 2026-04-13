/**
 * Импорт записей реестра лицензий Росприроднадзора из JSON (выгрузка парсера).
 *
 * Запуск из папки server (нужен DATABASE_URL в .env):
 *   node scripts/import-rpn-licenses-json.js path/to/licenses.json
 *   node scripts/import-rpn-licenses-json.js path/to/licenses.json --dry-run
 *
 *   Координаты при импорте не заполняются (lat/lng = NULL) — задайте их вручную в админке или отдельным процессом.
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
import { fileURLToPath } from 'node:url';
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

const STATUS_LABEL_RU = {
  active: 'Действующая',
  annulled: 'Аннулирована',
  paused: 'Приостановлена',
  pausedpart: 'Частично приостановлена',
  terminated: 'Прекращена',
};

const UNKNOWN_COMPANY_PREFIX = 'Неизвестная организация (импорт РПН)';
const UNKNOWN_ADDRESS = 'Адрес не указан (импорт РПН)';
const UNKNOWN_REGION = 'Регион не указан';

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

/** Строк за один INSERT в site_fkko_activities (5 параметров на строку). */
const SITE_FKKO_ACTIVITIES_CHUNK = 800;

/**
 * @param {import('pg').Pool} pool
 * @param {string} innExpr
 * @returns {Promise<{
 *   innSet: Set<string>,
 *   dbPrefetch: {
 *     activeLicenseRows: number,
 *     innRowsWithValidInn: number,
 *     innUniqueInDb: number,
 *     innDuplicateExtraRows: number,
 *   },
 * }>}
 */
async function loadImportDuplicateSets(pool, innExpr) {
  const totalRes = await pool.query(
    `SELECT COUNT(*)::int AS n FROM licenses WHERE deleted_at IS NULL`,
  );
  const activeLicenseRows = Number(totalRes.rows[0]?.n ?? 0);

  const innRes = await pool.query(
    `SELECT ${innExpr} AS inn_norm FROM licenses
     WHERE deleted_at IS NULL AND length(${innExpr}) IN (10, 12)`,
  );
  const innSet = new Set(innRes.rows.map((r) => String(r.inn_norm ?? '').trim()).filter(Boolean));
  const innRowsWithValidInn = innRes.rows.length;
  const innUniqueInDb = innSet.size;
  const innDuplicateExtraRows = Math.max(0, innRowsWithValidInn - innUniqueInDb);

  return {
    innSet,
    dbPrefetch: {
      activeLicenseRows,
      innRowsWithValidInn,
      innUniqueInDb,
      innDuplicateExtraRows,
    },
  };
}

/**
 * @param {{
 *   activeLicenseRows: number,
 *   innRowsWithValidInn: number,
 *   innUniqueInDb: number,
 *   innDuplicateExtraRows: number,
 * }} p
 */
function printDbPrefetchBeforeImport(p) {
  console.log('');
  console.log('=== База до импорта (кэш дублей) ===');
  console.log('Активных лицензий (строк в таблице, не удалённых):', p.activeLicenseRows);
  console.log(
    'ИНН: всего строк с валидным ИНН (10–12 цифр):',
    p.innRowsWithValidInn,
    '| разных ИНН:',
    p.innUniqueInDb,
    '| лишних строк (несколько карточек на один ИНН):',
    p.innDuplicateExtraRows,
  );
  console.log('Кратко: уникальных ИНН в кэше:', p.innUniqueInDb);
  console.log('====================================');
  console.log('');
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} siteId
 * @param {Array<{ fkkoCode: string, wasteName: string | null, hazardClass: string | null, activityTypes: string[] }>} entries
 */
async function insertSiteFkkoActivitiesBatch(client, siteId, entries) {
  const rows = [];
  for (const entry of entries) {
    for (const actType of entry.activityTypes) {
      rows.push([siteId, entry.fkkoCode, entry.wasteName, entry.hazardClass, actType]);
    }
  }
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += SITE_FKKO_ACTIVITIES_CHUNK) {
    const chunk = rows.slice(i, i + SITE_FKKO_ACTIVITIES_CHUNK);
    const vals = [];
    const params = [];
    let p = 1;
    for (const [sid, fkko, waste, hazard, act] of chunk) {
      vals.push(`($${p++},$${p++},$${p++},$${p++},$${p++})`);
      params.push(sid, fkko, waste, hazard, act);
    }
    await client.query(
      `INSERT INTO site_fkko_activities (site_id, fkko_code, waste_name, hazard_class, activity_type)
       VALUES ${vals.join(',')}
       ON CONFLICT (site_id, fkko_code, activity_type) DO NOTHING`,
      params,
    );
  }
}

function parseArgs(argv) {
  const positional = [];
  let dryRun = false;
  let includeInactive = false;
  let jsonStreamPath = '';
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--geocode') {
      console.warn(
        'Флаг --geocode устарел: геокодирование при импорте отключено; lat/lng остаются пустыми до ручного заполнения.',
      );
    } else if (a === '--include-inactive') includeInactive = true;
    else if (a.startsWith('--json-path=')) jsonStreamPath = a.slice('--json-path='.length).trim();
    else if (!a.startsWith('-')) positional.push(a);
  }
  return { jsonPath: positional[0] ?? '', dryRun, includeInactive, jsonStreamPath };
}

/** Путь для JSONStream: content.* vs *.content.* */
function detectJsonStreamPath(abs) {
  const fh = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fh, buf, 0, 16384, 0);
    let head = buf.subarray(0, n).toString('utf8').trimStart();
    if (head.charCodeAt(0) === 0xfeff) head = head.slice(1);
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

/**
 * @param {unknown} entry
 * @returns {null | {
 *   companyName: string,
 *   inn: string | null,
 *   innNorm: string | null,
 *   registryStatus: string,
 *   registryStatusRu: string,
 *   registryInactive: boolean,
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
export function mapRegistryEntryToSites(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const statusRaw = String(entry.status ?? '').trim().toLowerCase();
  const registryStatus = statusRaw || 'unknown';
  const registryStatusRu = STATUS_LABEL_RU[registryStatus] || `Неизвестный статус: ${registryStatus}`;
  const registryInactive = registryStatus !== 'active';

  const org = entry.subject?.data?.organization;
  const orgObj = org && typeof org === 'object' ? org : {};

  const fallbackRef = String(entry._id ?? '').trim();
  const fallbackSuffix = fallbackRef || `row-${Date.now()}`;
  const companyNameRaw = String(orgObj.shortName ?? orgObj.fullName ?? '').trim();
  const companyName = companyNameRaw || `${UNKNOWN_COMPANY_PREFIX} ${fallbackSuffix}`;
  const innRawStr = String(orgObj.inn ?? '').trim();
  const innNorm = normalizeInn(innRawStr);
  const innRaw = innNorm ? innRawStr : null;

  const regPart = orgObj.registrationAddress?.unrecognizablePart;
  const regAddr = regPart == null ? '' : String(regPart).trim();

  const objectsRaw = entry.licensingActivityRegistryWasteRPN?.objects;
  const objects = Array.isArray(objectsRaw) ? objectsRaw : [];

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

  if (sites.length === 0) {
    sites.push({
      address: regAddr || UNKNOWN_ADDRESS,
      region: regAddr ? guessRegionFromAddress(regAddr) || UNKNOWN_REGION : UNKNOWN_REGION,
      siteLabel: 'Основная площадка',
      lat: null,
      lng: null,
      fkkoCodes: [],
      activityTypes: [],
      entries: [],
    });
  }

  const primaryAddr = sites[0]?.address || regAddr || UNKNOWN_ADDRESS;
  const primaryRegion =
    sites[0]?.region || guessRegionFromAddress(primaryAddr) || UNKNOWN_REGION;

  return {
    companyName,
    inn: innRaw,
    innNorm,
    registryStatus,
    registryStatusRu,
    registryInactive,
    sites,
    primaryAddr,
    primaryRegion,
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

async function insertLicenseBundle(client, payload) {
  const { fkkoArr, activityArr } = aggregateFkkoAndActivityFromSites(payload.sites);
  if (fkkoArr.length === 0) return { ok: false, reason: 'no_fkko' };

  const moderatedComment = `Импорт ${IMPORT_SOURCE} (${new Date().toISOString().slice(0, 10)})`;

  const latNum = null;
  const lngNum = null;
  const sitesForInsert = payload.sites.map((s) => ({ ...s }));

  const inserted = await client.query(
    `INSERT INTO licenses
      (company_name, inn, address, region, lat, lng, fkko_codes, activity_types,
       status, reward, owner_user_id, moderated_at, moderated_comment,
       file_original_name, file_stored_name,
       import_source, import_needs_review, import_registry_inactive,
       import_registry_status, import_registry_status_ru)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       'approved', 100, NULL, NOW(), $9,
       NULL, NULL,
       $10, TRUE, $11, $12, $13)
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
      Boolean(payload.registryInactive),
      payload.registryStatus,
      payload.registryStatusRu,
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

    await insertSiteFkkoActivitiesBatch(client, siteId, s.entries);
  }

  return { ok: true, licenseId };
}

/**
 * @param {{
 *   sourceEntries: number,
 *   skippedUnmapped: number,
 *   skippedNoFkko: number,
 *   skippedNoData: number,
 *   parsed: number,
 *   parsedWithoutValidInn: number,
 *   skippedDupInn: number,
 *   skippedDupInnFromDb: number,
 *   skippedDupInnFromSameFile: number,
 *   inserted: number,
 *   errors: number,
 * }} stats
 * @param {Set<string>} uniqueInnsInMapped
 * @param {boolean} dryRun
 */
function printImportStatistics(stats, uniqueInnsInMapped, dryRun) {
  const u = uniqueInnsInMapped.size;
  const innRedundantRows = Math.max(0, stats.parsed - stats.parsedWithoutValidInn - u);

  console.log('');
  console.log('=== Статистика импорта ===');
  console.log('Записей в файле (элементов JSON):', stats.sourceEntries);
  console.log(
    'Отброшено: сломанные записи (необъект/битый JSON-элемент):',
    stats.skippedUnmapped,
  );
  console.log('Отброшено: нет кодов ФККО после сборки:', stats.skippedNoFkko);
  console.log('Итого отброшено по данным (unmapped + no_fkko):', stats.skippedNoData);
  console.log('');
  console.log('Пригодных записей после проверки полей (попали в разбор):', stats.parsed);
  console.log('  Из них без валидного ИНН (оставлены с заглушками):', stats.parsedWithoutValidInn);
  if (dryRun) {
    console.log('(DRY-RUN: дубликаты по БД не проверялись, «вставлено» завышено)');
  }
  console.log('  Разных ИНН среди этих записей:', u);
  console.log(
    '  Строк с повтором ИНН внутри файла (только среди записей с валидным ИНН):',
    innRedundantRows,
  );
  console.log('Пропуск: ИНН уже был в базе до импорта:', stats.skippedDupInnFromDb);
  console.log(
    'Пропуск: тот же ИНН повторился в файле или только что вставлен в этом прогоне:',
    stats.skippedDupInnFromSameFile,
  );
  console.log('Пропуск по ИНН, всего:', stats.skippedDupInn);
  console.log('');
  console.log(dryRun ? 'Условно «импортировано» (dry-run):' : 'Новых записей в БД:', stats.inserted);
  console.log('Ошибок при записи:', stats.errors);
  console.log('==========================');
  console.log('');
}

/**
 * @param {unknown} entry
 * @param {{
 *   stats: object,
 *   pool: import('pg').Pool | null,
 *   dryRun: boolean,
 *   dupSets: { innSet: Set<string> } | null,
 *   innDbSnapshot: Set<string> | null,
 *   uniqueInnsInMapped: Set<string>,
 * }} ctx
 */
async function importSingleEntry(entry, ctx) {
  const { stats, pool, dryRun, dupSets, innDbSnapshot, uniqueInnsInMapped } = ctx;
  stats.sourceEntries += 1;

  const payload = mapRegistryEntryToSites(entry);
  if (!payload) {
    stats.skippedUnmapped += 1;
    stats.skippedNoData += 1;
    return;
  }
  stats.parsed += 1;
  if (!payload.innNorm) stats.parsedWithoutValidInn += 1;
  if (payload.innNorm) uniqueInnsInMapped.add(payload.innNorm);

  if (dryRun) {
    stats.inserted += 1;
    return;
  }

  if (dupSets) {
    if (payload.innNorm && dupSets.innSet.has(payload.innNorm)) {
      stats.skippedDupInn += 1;
      if (innDbSnapshot?.has(payload.innNorm)) stats.skippedDupInnFromDb += 1;
      else stats.skippedDupInnFromSameFile += 1;
      return;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await insertLicenseBundle(client, payload);
    if (!result.ok) {
      await client.query('ROLLBACK');
      stats.skippedNoFkko += 1;
      stats.skippedNoData += 1;
      return;
    }

    await client.query('COMMIT');
    stats.inserted += 1;
    if (payload.innNorm) dupSets?.innSet.add(payload.innNorm);
    if (stats.inserted % 50 === 0) {
      console.log('Импортировано:', stats.inserted);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    stats.errors += 1;
    console.error('Ошибка записи:', err instanceof Error ? err.message : err);
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
  const { jsonPath, dryRun, includeInactive, jsonStreamPath } = parseArgs(process.argv.slice(2));
  if (!jsonPath) {
    console.error(
      'Укажите путь к JSON: node scripts/import-rpn-licenses-json.js <file.json> [--dry-run] [--json-path=content.*]',
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

  const stats = {
    sourceEntries: 0,
    skippedUnmapped: 0,
    skippedNoFkko: 0,
    skippedNoData: 0,
    parsed: 0,
    parsedWithoutValidInn: 0,
    skippedDupInn: 0,
    skippedDupInnFromDb: 0,
    skippedDupInnFromSameFile: 0,
    inserted: 0,
    errors: 0,
  };

  const uniqueInnsInMapped = new Set();

  const pool = dryRun ? null : getPool();
  const innExpr = LICENSE_INN_NORMALIZED_EXPR;
  let dupSets = null;
  /** Снимок ИНН в БД на старт импорта (для расшифровки «уже в базе» vs «повтор в файле»). */
  let innDbSnapshot = null;
  /** Счётчики БД на момент старта (дублируются в JSON в конце). */
  let dbPrefetchAtStart = null;
  if (pool) {
    const loaded = await loadImportDuplicateSets(pool, innExpr);
    dupSets = { innSet: loaded.innSet };
    innDbSnapshot = new Set(loaded.innSet);
    dbPrefetchAtStart = loaded.dbPrefetch;
    printDbPrefetchBeforeImport(loaded.dbPrefetch);
  }
  const ctx = {
    stats,
    pool,
    dryRun,
    dupSets,
    innDbSnapshot,
    uniqueInnsInMapped,
  };

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

  printImportStatistics(stats, uniqueInnsInMapped, dryRun);

  const statsForJson = {
    ...stats,
    uniqueInnsAmongMapped: uniqueInnsInMapped.size,
    mappedRowsWithRepeatedInnInFile: Math.max(0, stats.parsed - uniqueInnsInMapped.size),
    ...(dbPrefetchAtStart ? { dbPrefetchAtStart } : {}),
  };

  console.log(
    dryRun ? 'DRY-RUN (записей в БД нет).' : 'Готово.',
    JSON.stringify(statsForJson, null, 0),
  );
}

const __filename = fileURLToPath(import.meta.url);
const ranAsMain =
  process.argv[1] != null && path.resolve(process.argv[1]) === path.resolve(__filename);
if (ranAsMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
